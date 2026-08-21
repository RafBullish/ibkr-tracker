// ═══════════════════════════════════════════════════════════════
//  useSupabaseLive — sondeur du flux Supabase (Phase B, D1 sans dépendance).
//
//  Remplace useIbkrLive (bridge HTTP local, RETIRÉ, D3). Supabase est la
//  source UNIQUE du live ; le repli est l'estimateur « est. » avec son âge,
//  pas un second chemin dormant.
//
//  Cadence alignée sur la séance que le cockpit connaît déjà :
//    open → 20 s · pre/after → 90 s · closed → AUCUN sondage (arrêt complet).
//  Pause quand l'onglet est caché (document.hidden). Un fetch qui échoue
//  fait basculer la pastille (ok=false) au lieu de la laisser verte.
//
//  HÉROS 1 LIVE (brique 1) — la courbe 1D exige la séance ENTIÈRE :
//    · AMORCE (au montage ou au changement de jour de séance) : toutes les
//      lignes nlv_snapshots + fx_rates depuis 04:00 NY (paginé, une séance
//      dépasse le plafond PostgREST de ~1 000 lignes) + une ligne fx ANCRE
//      antérieure à la fenêtre (jointure as-of du tout premier point).
//    · INCRÉMENTAL (chaque sondage) : uniquement les lignes plus récentes
//      que le dernier point connu — 1-2 lignes par cycle.
//    · Marché fermé : l'amorce UNIQUE a lieu (le poste montre la dernière
//      séance, « MARCHÉ FERMÉ · dernier tick »), puis AUCUN sondage.
//
//  Un seul canal alimente le compte : SET_IBKR_LIVE → settings.ibkrLiveData
//  (consommé par LIQUIDITÉ DISPO, badge NLV, fraîcheur du writer pic). La
//  série NLV, la série FX, les marks bridge vont dans le store éphémère
//  liveFeed — valeurs broker AVEC leur devise, jamais converties (la
//  conversion par point se fait à l'affichage, utils/liveNlvSeries).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useDispatch } from '../store/useStore';
import useMarketSession from './useMarketSession';
import { useLiveFeed } from '../store/liveFeed';
import { fetchLatest, fetchAllSince, supabaseConfigured } from '../services/supabaseRest';
import { sessionWindow } from '../utils/marketPhase';

const CADENCE_MS = { open: 20_000, pre: 90_000, after: 90_000, closed: 60_000 };
const NLV_SELECT = 'captured_at,nlv,total_cash,settled_cash,currency';
const FX_SELECT = 'mid,captured_at';

const num = (x) => {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// account_state (dernier) + nlv_snapshots (dernier) → shape ibkrLiveData que
// les consommateurs existants lisent déjà. On RECOPIE les valeurs du broker,
// on ne convertit RIEN (la conversion CHF→USD se fait à l'affichage).
export function toIbkrLive(nlv, acct) {
  const timestamp = nlv?.captured_at || acct?.captured_at;
  if (!timestamp) return null;
  return {
    source: 'supabase',
    timestamp,
    currency: nlv?.currency ?? acct?.currency ?? null,
    netLiquidation: num(nlv?.nlv),
    totalCashValue: num(nlv?.total_cash),
    settledCash: num(nlv?.settled_cash),
    // availableFunds : écrit par le bridge depuis la migration 001.
    // Absent → LIQUIDITÉ DISPO retombe sur l'estimateur « est. » (repli voulu).
    availableFunds: num(acct?.available_funds),
    buyingPower: num(acct?.buying_power),
    excessLiquidity: num(acct?.excess_liquidity),
    maintMargin: num(acct?.maint_margin),
    cushion: num(acct?.cushion),
  };
}

// Points NLV : valeur broker + devise, JAMAIS convertis dans le store.
export function toSeries(rows) {
  return (rows || [])
    .map((r) => ({ t: new Date(r.captured_at).getTime(), nlv: num(r.nlv), currency: r.currency || null }))
    .filter((p) => Number.isFinite(p.t) && p.nlv != null)
    .sort((a, b) => a.t - b.t);
}

export function toFxSeries(rows) {
  return (rows || [])
    .map((r) => ({ t: new Date(r.captured_at).getTime(), mid: num(r.mid) }))
    .filter((p) => Number.isFinite(p.t) && p.mid != null)
    .sort((a, b) => a.t - b.t);
}

// Pic bridge par signature = max mid observé (source affichée, jamais armée
// par la barrière dure P2 tant que la devise n'est pas confirmée — D8).
export function toMarks(rows) {
  const out = {};
  for (const r of rows || []) {
    const sig = r.signature;
    const mid = num(r.mid);
    if (!sig || mid == null) continue;
    const markAt = new Date(r.mark_at).getTime();
    if (!out[sig] || mid > out[sig].pic) {
      out[sig] = { pic: mid, source: r.source || 'bridge', markAt };
    }
  }
  return out;
}

// Ajoute des lignes asc à une série existante en écartant tout point ≤ au
// dernier connu (le curseur ISO perd les µs → une ligne frontière peut
// revenir ; jamais de doublon dans la série).
const appendNew = (series, incoming) => {
  if (!incoming.length) return series;
  const lastT = series.length ? series[series.length - 1].t : -Infinity;
  const fresh = incoming.filter((p) => p.t > lastT);
  return fresh.length ? [...series, ...fresh] : series;
};

export default function useSupabaseLive() {
  const dispatch = useDispatch();
  const setFeed = useLiveFeed((s) => s.setFeed);
  const markStale = useLiveFeed((s) => s.markStale);
  const { phase } = useMarketSession();

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const aliveRef = useRef(true);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);
  const lastNlvRawRef = useRef(null); // dernière ligne nlv_snapshots BRUTE (SET_IBKR_LIVE)

  useEffect(() => {
    if (!supabaseConfigured) return undefined; // dégradation gracieuse (repli « est. »)
    aliveRef.current = true;

    const poll = async () => {
      if (inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const win = sessionWindow(new Date());
      const st = useLiveFeed.getState();
      const needAmorce = st.sessionKey !== win.dayKey;
      // Marché fermé : UNE amorce (montrer la dernière séance), zéro sondage.
      if (phaseRef.current === 'closed' && !needAmorce) return;
      inFlightRef.current = true;
      try {
        let nlvSeries;
        let fxSeries;
        if (needAmorce) {
          const startIso = new Date(win.startMs).toISOString();
          const [nlvRows, fxAnchor, fxRows] = await Promise.all([
            fetchAllSince('nlv_snapshots', { select: NLV_SELECT, sinceIso: startIso, inclusive: true }),
            fetchLatest('fx_rates', {
              select: FX_SELECT,
              filters: { pair: 'eq.USD.CHF', captured_at: `lt.${startIso}` },
              order: 'captured_at.desc', limit: 1,
            }),
            fetchAllSince('fx_rates', {
              select: FX_SELECT, sinceIso: startIso, inclusive: true,
              filters: { pair: 'eq.USD.CHF' },
            }),
          ]);
          nlvSeries = toSeries(nlvRows);
          fxSeries = [...toFxSeries(fxAnchor), ...toFxSeries(fxRows)];
          lastNlvRawRef.current = nlvRows?.length ? nlvRows[nlvRows.length - 1] : null;
        } else {
          const sinceNlv = st.nlvSeries.length
            ? new Date(st.nlvSeries[st.nlvSeries.length - 1].t).toISOString()
            : new Date(win.startMs).toISOString();
          const sinceFx = st.fxSeries.length
            ? new Date(st.fxSeries[st.fxSeries.length - 1].t).toISOString()
            : new Date(win.startMs).toISOString();
          const [nlvRows, fxRows] = await Promise.all([
            fetchAllSince('nlv_snapshots', { select: NLV_SELECT, sinceIso: sinceNlv }),
            fetchAllSince('fx_rates', {
              select: FX_SELECT, sinceIso: sinceFx, filters: { pair: 'eq.USD.CHF' },
            }),
          ]);
          nlvSeries = appendNew(st.nlvSeries, toSeries(nlvRows));
          fxSeries = appendNew(st.fxSeries, toFxSeries(fxRows));
          if (nlvRows?.length) lastNlvRawRef.current = nlvRows[nlvRows.length - 1];
        }

        const [acctRows, markRows] = await Promise.all([
          fetchLatest('account_state', { order: 'captured_at.desc', limit: 1 }),
          fetchLatest('position_marks', {
            select: 'signature,mid,mark_at,source', order: 'mark_at.desc', limit: 500,
          }),
        ]);
        if (!aliveRef.current) return;

        const acct = acctRows?.[0] || null;
        const lastFx = fxSeries.length ? fxSeries[fxSeries.length - 1] : null;

        const live = toIbkrLive(lastNlvRawRef.current, acct);
        if (live) dispatch({ type: 'SET_IBKR_LIVE', payload: live });

        const caps = [
          nlvSeries.length ? nlvSeries[nlvSeries.length - 1].t : null,
          acct?.captured_at ? new Date(acct.captured_at).getTime() : null,
          lastFx?.t ?? null,
        ].filter((t) => Number.isFinite(t));
        setFeed({
          nlvSeries,
          fxSeries,
          marks: toMarks(markRows),
          fx: lastFx ? { pair: 'USD.CHF', mid: lastFx.mid, capturedAt: new Date(lastFx.t).toISOString() } : null,
          sessionKey: win.dayKey,
          lastCapturedAt: caps.length ? Math.max(...caps) : null,
          ok: true,
        });
      } catch {
        // Réseau coupé, Gateway en réauth hebdo, machine éteinte → la pastille
        // bascule (ok=false). On ne fabrique aucun point : le trou est réel.
        markStale();
      } finally {
        inFlightRef.current = false;
      }
    };

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const delay = CADENCE_MS[phaseRef.current] ?? 60_000;
      timerRef.current = setTimeout(async () => {
        await poll();
        if (aliveRef.current) schedule();
      }, delay);
    };

    // Kick immédiat puis boucle auto-reschedulée (cadence relue à chaque tour).
    poll().finally(() => { if (aliveRef.current) schedule(); });

    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      } else {
        poll().finally(() => { if (aliveRef.current) schedule(); });
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      aliveRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [dispatch, setFeed, markStale]);
}
