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
//  Un seul canal alimente le compte : SET_IBKR_LIVE → settings.ibkrLiveData
//  (consommé par LIQUIDITÉ DISPO, badge NLV, fraîcheur du writer pic). La
//  série NLV, les marks bridge et le FX vont dans le store éphémère liveFeed.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'react';
import { useDispatch } from '../store/useStore';
import useMarketSession from './useMarketSession';
import { useLiveFeed } from '../store/liveFeed';
import { fetchLatest, supabaseConfigured } from '../services/supabaseRest';

const CADENCE_MS = { open: 20_000, pre: 90_000, after: 90_000, closed: 60_000 };

const num = (x) => {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};

// account_state (dernier) + nlv_snapshots (dernier) → shape ibkrLiveData que
// les consommateurs existants lisent déjà. On RECOPIE les valeurs du broker,
// on ne convertit RIEN (la conversion CHF→USD se fait à l'affichage).
function toIbkrLive(nlv, acct) {
  const timestamp = nlv?.captured_at || acct?.captured_at;
  if (!timestamp) return null;
  return {
    source: 'supabase',
    timestamp,
    currency: nlv?.currency ?? acct?.currency ?? null,
    netLiquidation: num(nlv?.nlv),
    totalCashValue: num(nlv?.total_cash),
    settledCash: num(nlv?.settled_cash),
    // availableFunds : le bridge (collect.py) doit l'ajouter à account_state.
    // Absent → LIQUIDITÉ DISPO retombe sur l'estimateur « est. » (repli voulu).
    availableFunds: num(acct?.available_funds),
    buyingPower: num(acct?.buying_power),
    excessLiquidity: num(acct?.excess_liquidity),
    maintMargin: num(acct?.maint_margin),
    cushion: num(acct?.cushion),
  };
}

function toSeries(rows) {
  return (rows || [])
    .map((r) => ({ t: new Date(r.captured_at).getTime(), nlv: num(r.nlv) }))
    .filter((p) => Number.isFinite(p.t) && p.nlv != null)
    .sort((a, b) => a.t - b.t);
}

// Pic bridge par signature = max mid observé (source affichée, jamais armée
// par la barrière dure P2 tant que la devise n'est pas confirmée — D8).
function toMarks(rows) {
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

  useEffect(() => {
    if (!supabaseConfigured) return undefined; // dégradation gracieuse (repli « est. »)
    aliveRef.current = true;

    const poll = async () => {
      if (inFlightRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      if (phaseRef.current === 'closed') return; // marché fermé → aucun sondage
      inFlightRef.current = true;
      try {
        const [nlvRows, acctRows, markRows, fxRows] = await Promise.all([
          fetchLatest('nlv_snapshots', {
            select: 'captured_at,nlv,total_cash,settled_cash,currency',
            order: 'captured_at.desc', limit: 180,
          }),
          fetchLatest('account_state', { order: 'captured_at.desc', limit: 1 }),
          fetchLatest('position_marks', {
            select: 'signature,mid,mark_at,source', order: 'mark_at.desc', limit: 500,
          }),
          fetchLatest('fx_rates', {
            select: 'mid,captured_at', filters: { pair: 'eq.USD.CHF' },
            order: 'captured_at.desc', limit: 1,
          }),
        ]);
        if (!aliveRef.current) return;

        const nlvLatest = nlvRows?.[0] || null;
        const acct = acctRows?.[0] || null;
        const fx = fxRows?.[0] || null;

        const live = toIbkrLive(nlvLatest, acct);
        if (live) dispatch({ type: 'SET_IBKR_LIVE', payload: live });

        const caps = [nlvLatest?.captured_at, acct?.captured_at, fx?.captured_at]
          .filter(Boolean)
          .map((s) => new Date(s).getTime())
          .filter((t) => Number.isFinite(t));
        setFeed({
          nlvSeries: toSeries(nlvRows),
          marks: toMarks(markRows),
          fx: fx ? { pair: 'USD.CHF', mid: num(fx.mid), capturedAt: fx.captured_at } : null,
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
