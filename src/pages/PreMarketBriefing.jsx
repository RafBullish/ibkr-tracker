// ═══════════════════════════════════════════════════════════════
//  PRE-MARKET BRIEFING — « Le poste du matin » (brique 2.C1)
//  /premarket (⌘0)
//
//  Test de la première seconde : « dans combien de temps ça ouvre,
//  dans quel régime, et qu'est-ce qui réclame mon attention avant la
//  cloche ». Architecture (§4.1), de haut en bas :
//    1. BANDEAU DE COMMANDEMENT — countdown = valeur reine (tick 1 s).
//    2. ÉTAGE RÉGIME — UNE grille au cordeau (le chevauchement des deux
//       anciennes bandes 56 px meurt à la racine : hauteur auto,
//       min-width:0, hairlines verticales).
//    3. HÉROS — REVUE DES POSITIONS · GATES au classifieur UNIQUE
//       (deriveAttention → CRITICAL / ARMED / SAFE, comme la bande
//       décision et Positions).
//    4. ÉTAGE DE CLÔTURE, 2 colonnes — AGENDA DU JOUR | ROUTINE. Le vide
//       bas d'écran meurt par composition ; jour creux → prochain
//       catalyseur (donnée déjà servie par useCalendarFeeds).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import useMarketQuotes from '../hooks/useMarketQuotes';
import useSniperGates from '../hooks/useSniperGates';
import useDailyKillSwitch from '../hooks/useDailyKillSwitch';
import { useFx } from '../hooks/useFx';
import useCalendarFeeds from '../hooks/useCalendarFeeds';
import useApiStatus from '../hooks/useApiStatus';
import { useOpenPositions, useSettings } from '../store/useStore';
import { generateAlerts } from '../utils/alerts';
import { deriveAttention } from '../components/dashboard/decision/model';
import { toFloat } from '../utils/math';
import { macroEventsInRange } from '../data/macroEvents2026';
import { MAJOR_US_TICKERS } from '../utils/majorTickers';
import { TickValue } from '../components/dashboard/decision/parts';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../theme/animationVariants';

const ROUTINE_ITEMS = [
  { id: 'macro', label: 'Calendrier macro' },
  { id: 'futures', label: 'Futures + DXY overnight' },
  { id: 'news', label: 'News flow positions + watchlist' },
  { id: 'earnings', label: 'Earnings BMO / AMC' },
  { id: 'positions', label: 'Review positions ouvertes' },
  { id: 'watchlist', label: 'Setups watchlist' },
];

const PREMARKET_INDICES = ['^VIX', '^GSPC', 'QQQ'];
const DXY_SYMBOL = 'DX-Y.NYB';
const FUTURES = [
  { sym: 'ES=F', label: 'ES' },
  { sym: 'NQ=F', label: 'NQ' },
  { sym: 'YM=F', label: 'YM' },
];
const QUOTE_SYMBOLS = [...PREMARKET_INDICES, DXY_SYMBOL, ...FUTURES.map((f) => f.sym)];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STORAGE_KEY_PREFIX = 'qc:premarket:checks:';

function readChecks(dateKey) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + dateKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeChecks(dateKey, checks) {
  try {
    window.localStorage.setItem(STORAGE_KEY_PREFIX + dateKey, JSON.stringify(checks));
  } catch {
    /* quota / private mode */
  }
}

function fmtClock(date, tz) {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function tzMinutes(date, tz) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value, 10);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  return { hour, minute, weekday, total: hour * 60 + minute };
}

// Libellé français de la prochaine bascule (la valeur reine du bandeau).
const NEXT_WHAT = {
  OPEN: 'OUVERTURE DANS',
  AFTER: 'CLÔTURE RTH DANS',
  CLOSED: 'FIN AFTER-HOURS DANS',
  PRE: 'PRÉ-MARCHÉ DANS',
};

const pad2 = (n) => String(n).padStart(2, '0');

function nextPhase(now) {
  const ny = tzMinutes(now, 'America/New_York');
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(ny.weekday);
  if (!isWeekday) {
    return { phase: 'closed', label: 'WEEKEND', countdownWhat: 'MARCHÉ FERMÉ', countdownHMS: '——' };
  }
  // 04:00 → pre, 09:30 → open, 16:00 → after, 20:00 → closed
  let phase = 'closed';
  let next = null;
  if (ny.total >= 4 * 60 && ny.total < 9 * 60 + 30) {
    phase = 'pre';
    next = { name: 'OPEN', minutes: 9 * 60 + 30 };
  } else if (ny.total >= 9 * 60 + 30 && ny.total < 16 * 60) {
    phase = 'open';
    next = { name: 'AFTER', minutes: 16 * 60 };
  } else if (ny.total >= 16 * 60 && ny.total < 20 * 60) {
    phase = 'after';
    next = { name: 'CLOSED', minutes: 20 * 60 };
  } else {
    phase = 'closed';
    next = { name: 'PRE', minutes: 4 * 60 + 24 * 60 }; // demain 04:00 NY
  }
  // Secondes réelles (indépendantes du fuseau) → countdown au 1 s près.
  let totalSecs = next.minutes * 60 - (ny.total * 60 + now.getSeconds());
  if (totalSecs < 0) totalSecs += 24 * 3600;
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return {
    phase,
    label: phase.toUpperCase(),
    countdownWhat: NEXT_WHAT[next.name] || 'PROCHAINE BASCULE',
    countdownHMS: `${pad2(h)}:${pad2(m)}:${pad2(s)}`,
  };
}

function fmtIndex(q) {
  if (!q || !Number.isFinite(q.price)) return '——';
  if (q.price >= 1000) return q.price.toLocaleString('de-CH', { maximumFractionDigits: 0 });
  return q.price.toFixed(2);
}

function fmtIndexChg(q) {
  if (!q || !Number.isFinite(q.changePercent)) return null;
  const sign = q.changePercent > 0 ? '+' : q.changePercent < 0 ? '−' : '';
  return `${sign}${Math.abs(q.changePercent).toFixed(2)}%`;
}

function chgToneAttr(q) {
  if (!q || !Number.isFinite(q.changePercent) || q.changePercent === 0) return undefined;
  return q.changePercent > 0 ? 'up' : 'down';
}

function vixRegime(vix) {
  if (!vix || !Number.isFinite(vix.price)) return { label: '——', tone: undefined };
  if (vix.price < 15) return { label: 'LOW VOL', tone: undefined };
  if (vix.price < 20) return { label: 'NORMAL', tone: undefined };
  if (vix.price < 30) return { label: 'ELEVATED', tone: 'warn' };
  return { label: 'STRESSED', tone: 'warn' };
}

function sessionDateStr(now, phase) {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  let d = new Date(ymd + 'T12:00:00Z');
  const inSession = phase === 'pre' || phase === 'open';
  if (!inSession) d = new Date(d.getTime() + 86400000);
  let guard = 0;
  while ((d.getUTCDay() === 0 || d.getUTCDay() === 6) && guard < 7) {
    d = new Date(d.getTime() + 86400000);
    guard += 1;
  }
  return d.toISOString().slice(0, 10);
}

function monthRangeIso(year, month) {
  const pad = (n) => String(n).padStart(2, '0');
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month + 2, 0));
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: iso(from), to: iso(to) };
}

function earningsWhen(hour) {
  if (hour === 'bmo') return { label: 'BMO', tone: 'bmo' };
  if (hour === 'amc') return { label: 'AMC', tone: 'amc' };
  if (hour === 'dmh') return { label: 'SÉANCE', tone: 'dmh' };
  return null;
}

function fmtEpsEstimate(v) {
  if (v == null || !Number.isFinite(v)) return null;
  const sign = v < 0 ? '−' : '';
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtRevenueEstimate(v) {
  if (v == null || !Number.isFinite(v) || v === 0) return null;
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
}

// ETA en jours calendaires entre une date ISO et aujourd'hui.
function etaDays(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const today = new Date();
  const diff = Math.round((d.getTime() - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
  if (!Number.isFinite(diff)) return '';
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return 'demain';
  return `dans ${diff} j`;
}

// ── Cellule-MONDE (bandeau + régime) : label + valeur + méta collés à
// gauche, min-width:0. TickValue = micro-mouvement 1.F (sauf countdown). ──
function Cell({ label, value, meta, tone, marker, live, className }) {
  return (
    <div className={`pf-c pm-cell${className ? ` ${className}` : ''}`} data-tone={tone || undefined}>
      <span className="pf-c__label pm-cell__label">
        {label}
        {marker || null}
      </span>
      {live ? (
        <span className={`pf-c__val pm-cell__val${tone ? ` pf-c__val--${tone}` : ''}`}>{value}</span>
      ) : (
        <TickValue text={value} className={`pf-c__val pm-cell__val${tone ? ` pf-c__val--${tone}` : ''}`} />
      )}
      <span className="pf-c__meta pm-cell__meta">{meta || ' '}</span>
    </div>
  );
}

export default function PreMarketBriefing() {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(() => new Date());
  const [dateKey] = useState(todayKey);
  const [checks, setChecks] = useState(() => readChecks(dateKey));

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { quotes } = useMarketQuotes(QUOTE_SYMBOLS);
  const sniperGates = useSniperGates();
  const kill = useDailyKillSwitch();
  const { rate: fxRate, formatRate: formatFxRate } = useFx();
  const openPositions = useOpenPositions();
  const settings = useSettings();
  const apiStatus = useApiStatus();
  const lr = toFloat(settings?.liveRate) || 1;

  const phaseInfo = useMemo(() => nextPhase(now), [now]);
  const vixInfo = useMemo(() => vixRegime(quotes?.['^VIX']), [quotes]);

  const allOpenOptions = useMemo(() => sniperGates?.rows || [], [sniperGates]);

  // ── Classifieur UNIQUE (§4.1) : deriveAttention, à l'identique de
  //    Positions.jsx. Fini le vocabulaire hook (armed/imminent/safe) ;
  //    verdict par position CRITICAL / ARMED (sinon SAFE). ──
  const actionableAlerts = useMemo(() => {
    // greeksMap non lu par generateAlerts (facteurs = dte/pctChg/daysHeld) →
    // Map() vide suffit ; classification byte-identique à Positions.jsx.
    const alerts = generateAlerts(openPositions || [], new Map(), lr);
    return alerts.filter((a) => a.severity === 'red' || a.severity === 'orange');
  }, [openPositions, lr]);

  const gateByPos = useMemo(() => {
    const att = deriveAttention({
      alerts: actionableAlerts,
      gateRows: sniperGates?.rows || [],
      watchedCount: 0,
      kill: { triggered: kill.triggered, dailyPnlUsd: kill.dailyPnlUsd, maxLoss: kill.maxLoss },
      maxLines: Infinity,
    });
    return new Map(att.lines.map((l) => [l.id, l]));
  }, [actionableAlerts, sniperGates, kill.triggered, kill.dailyPnlUsd, kill.maxLoss]);

  const gateCounts = useMemo(() => {
    let critical = 0;
    let armed = 0;
    for (const l of gateByPos.values()) {
      if (l.severity === 'critique') critical++;
      else armed++;
    }
    return { critical, armed, total: critical + armed };
  }, [gateByPos]);

  const heldTickers = useMemo(
    () =>
      Array.from(
        new Set((openPositions || []).map((p) => String(p.tk || '').toUpperCase()).filter(Boolean))
      ),
    [openPositions]
  );

  const calTickers = useMemo(
    () => Array.from(new Set([...MAJOR_US_TICKERS, ...heldTickers])),
    [heldTickers]
  );

  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  const { earnings, macro } = useCalendarFeeds({
    viewYear: calYear,
    viewMonth: calMonth,
    myTickers: calTickers,
    minImpact: 'medium',
    enabled: true,
  });

  const sessionDate = useMemo(() => sessionDateStr(now, phaseInfo.phase), [now, phaseInfo.phase]);
  const sessionLabel = useMemo(() => {
    const [, mm, dd] = sessionDate.split('-');
    return `${dd}/${mm}`;
  }, [sessionDate]);

  const finnhubDown = apiStatus?.finnhub?.status === 'inactive';

  // Macro effectif (Finnhub ∪ fallback local FOMC/CPI/NFP), plage month±1.
  const effectiveMacro = useMemo(() => {
    const { from, to } = monthRangeIso(calYear, calMonth);
    const fallback = finnhubDown || macro.length === 0 ? macroEventsInRange(from, to) : [];
    return fallback.length > 0 ? fallback : macro;
  }, [macro, finnhubDown, calYear, calMonth]);

  const macroToday = useMemo(
    () => effectiveMacro.filter((ev) => ev?.time && String(ev.time).slice(0, 10) === sessionDate),
    [effectiveMacro, sessionDate]
  );

  const earningsToday = useMemo(() => {
    const held = new Set(heldTickers);
    const order = { bmo: 0, dmh: 1, amc: 2 };
    return (earnings || [])
      .filter((e) => e?.symbol && e?.date === sessionDate)
      .map((e) => {
        const sym = String(e.symbol).toUpperCase();
        return {
          symbol: sym,
          when: earningsWhen(e.hour),
          eps: fmtEpsEstimate(e.epsEstimate),
          rev: fmtRevenueEstimate(e.revenueEstimate),
          held: held.has(sym),
        };
      })
      .sort((a, b) => {
        if (a.held !== b.held) return a.held ? -1 : 1;
        const ao = order[a.when?.tone] ?? 3;
        const bo = order[b.when?.tone] ?? 3;
        if (ao !== bo) return ao - bo;
        return a.symbol.localeCompare(b.symbol);
      });
  }, [earnings, sessionDate, heldTickers]);

  const heldEarnCount = useMemo(() => earningsToday.filter((e) => e.held).length, [earningsToday]);

  // Prochain catalyseur (jour creux) — donnée DÉJÀ servie (macro ∪ earnings
  // futurs), aucune requête nouvelle. Sert à ne jamais laisser l'agenda vide.
  const nextCatalyst = useMemo(() => {
    const pool = [];
    for (const ev of effectiveMacro) {
      const d = ev?.time ? String(ev.time).slice(0, 10) : null;
      if (d && d > sessionDate) {
        pool.push({ date: d, label: ev.event, type: 'macro', impact: ev.impact });
      }
    }
    for (const e of earnings || []) {
      if (e?.date && e.date > sessionDate && e?.symbol) {
        const sym = String(e.symbol).toUpperCase();
        if (heldTickers.includes(sym) || MAJOR_US_TICKERS.includes(sym)) {
          pool.push({ date: e.date, label: `${sym} · résultats`, type: 'earn' });
        }
      }
    }
    pool.sort((a, b) => a.date.localeCompare(b.date));
    return pool[0] || null;
  }, [effectiveMacro, earnings, sessionDate, heldTickers]);

  const checkedCount = Object.values(checks).filter(Boolean).length;
  const allReady = checkedCount === ROUTINE_ITEMS.length;

  const toggleCheck = (id) => {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    writeChecks(dateKey, next);
  };
  const resetChecks = () => {
    setChecks({});
    writeChecks(dateKey, {});
  };
  const confirmReady = () => {
    if (!allReady) return;
    const next = { ...checks, _readyAt: new Date().toISOString() };
    setChecks(next);
    writeChecks(dateKey, next);
  };
  const readyAt = checks?._readyAt;

  const agendaEmpty = macroToday.length === 0 && earningsToday.length === 0;

  // Régime — 8 cellules-MONDE (l'ordre = la lecture : vol, indices, futures, fx).
  const regimeCells = [
    { label: 'VIX', value: fmtIndex(quotes?.['^VIX']), meta: vixInfo.label, tone: vixInfo.tone },
    { label: 'SPX', value: fmtIndex(quotes?.['^GSPC']), meta: fmtIndexChg(quotes?.['^GSPC']) || '——', metaTone: chgToneAttr(quotes?.['^GSPC']) },
    { label: 'QQQ', value: fmtIndex(quotes?.QQQ), meta: fmtIndexChg(quotes?.QQQ) || '——', metaTone: chgToneAttr(quotes?.QQQ) },
    { label: 'ES', value: fmtIndex(quotes?.['ES=F']), meta: fmtIndexChg(quotes?.['ES=F']) || '——', metaTone: chgToneAttr(quotes?.['ES=F']) },
    { label: 'NQ', value: fmtIndex(quotes?.['NQ=F']), meta: fmtIndexChg(quotes?.['NQ=F']) || '——', metaTone: chgToneAttr(quotes?.['NQ=F']) },
    { label: 'YM', value: fmtIndex(quotes?.['YM=F']), meta: fmtIndexChg(quotes?.['YM=F']) || '——', metaTone: chgToneAttr(quotes?.['YM=F']) },
    { label: 'USD/CHF', value: fxRate > 0 ? formatFxRate(fxRate) : '——', meta: 'spot' },
    { label: 'DXY', value: fmtIndex(quotes?.[DXY_SYMBOL]), meta: fmtIndexChg(quotes?.[DXY_SYMBOL]) || '——', metaTone: chgToneAttr(quotes?.[DXY_SYMBOL]) },
  ];

  return (
    <motion.div
      className="page-container premarket-page"
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      {/* 1 — BANDEAU DE COMMANDEMENT : countdown = valeur reine. */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final pm-command"
        aria-label="Commandement — ouverture, phase, gates"
      >
        <div className="pm-command__grid">
          <div className="pf-c pm-cell pm-command__countdown">
            <span className="pf-c__label pm-cell__label">{phaseInfo.countdownWhat}</span>
            {/* Countdown = tick 1 s natif (pas de TickValue). */}
            <span className="pm-command__countdown-val">{phaseInfo.countdownHMS}</span>
            <span className="pf-c__meta pm-cell__meta">séance US · NY</span>
          </div>
          {/* PHASE US = état de séance (scheduling), PAS un gain d'argent →
              encre NEUTRE (loi de couleur ; l'état est porté par le libellé). */}
          <Cell
            label="PHASE US"
            value={phaseInfo.label}
            meta={phaseInfo.phase === 'open' ? 'marché ouvert' : phaseInfo.phase === 'pre' ? 'pré-marché' : phaseInfo.phase === 'after' ? 'after-hours' : 'fermé'}
          />
          <Cell label="GENÈVE" value={fmtClock(now, 'Europe/Zurich')} meta="CET" live />
          <Cell label="NEW YORK" value={fmtClock(now, 'America/New_York')} meta="ET" live />
          <Cell
            label="GATES"
            value={`${gateCounts.total} / ${allOpenOptions.length}`}
            meta={
              gateCounts.total > 0
                ? [gateCounts.critical ? `${gateCounts.critical} CRITICAL` : null, gateCounts.armed ? `${gateCounts.armed} ARMED` : null].filter(Boolean).join(' · ')
                : 'aucune attention'
            }
          />
        </div>
      </motion.section>

      {/* 2 — ÉTAGE RÉGIME : UNE grille au cordeau (chevauchement mort). */}
      <motion.section
        variants={RISE_TILE_VARIANTS}
        className="lh-final pm-regime"
        aria-label="Régime de marché"
      >
        <div className="pm-regime__grid">
          {regimeCells.map((c) => (
            <div key={c.label} className="pf-c pm-cell pm-regime__cell" data-tone={c.tone || undefined}>
              <span className="pf-c__label pm-cell__label">{c.label}</span>
              <TickValue text={c.value} className="pf-c__val pm-cell__val pm-regime__val" />
              <span className={`pf-c__meta pm-cell__meta${c.metaTone ? ` pm-cell__meta--${c.metaTone}` : ''}`}>
                {c.meta}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 3 — HÉROS : REVUE DES POSITIONS · GATES (classifieur unique). */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <div className="pm-panel pm-hero">
          <div className="pm-panel__head">
            <span className="mk-title">Revue des positions · Gates</span>
            <span className="pm-panel__hint">
              {gateCounts.total > 0
                ? `${gateCounts.total} attention requise · ${allOpenOptions.length} option${allOpenOptions.length > 1 ? 's' : ''} ouverte${allOpenOptions.length > 1 ? 's' : ''}`
                : `${allOpenOptions.length} option${allOpenOptions.length > 1 ? 's' : ''} ouverte${allOpenOptions.length > 1 ? 's' : ''} · aucune gate critique`}
            </span>
          </div>
          {allOpenOptions.length === 0 ? (
            <div className="pm-empty">
              <span className="pm-empty__title">Aucune option ouverte</span>
              <span className="pm-empty__sub">
                Les gates Sniper s'affichent ici dès qu'une option est en portefeuille ce matin.
              </span>
            </div>
          ) : (
            <div className="pm-gtable">
              <div className="pm-gtable__head" role="row">
                <span className="pm-gtable__h" data-align="left">Ticker</span>
                <span className="pm-gtable__h" data-align="left">Strat</span>
                <span className="pm-gtable__h" data-align="right">Strike</span>
                <span className="pm-gtable__h" data-align="right">DTE</span>
                <span className="pm-gtable__h" data-align="right">Unreal</span>
                <span className="pm-gtable__h" data-align="left">Signal</span>
                <span className="pm-gtable__h" data-align="left">Gate</span>
              </div>
              {allOpenOptions.map((row) => {
                const g = gateByPos.get(row.id);
                const sev = g ? g.severity : null;
                const badge = sev === 'critique' ? 'CRITICAL' : sev === 'arme' ? 'ARMED' : 'SAFE';
                const badgeSev = sev === 'critique' ? 'critique' : sev === 'arme' ? 'arme' : 'safe';
                const unrealTone = row.unrealPct > 0 ? 'profit' : row.unrealPct < 0 ? 'loss' : 'neutral';
                return (
                  <div
                    key={row.id}
                    className="pm-gtable__row"
                    role="row"
                    onClick={() => navigate(`/trading/positions?focus=${encodeURIComponent(row.id)}`)}
                  >
                    <span className="pm-gtable__c mono pm-gtable__ticker" data-align="left">{row.ticker}</span>
                    <span className="pm-gtable__c mono" data-align="left">
                      {row.dir === 'Short' ? 'S' : 'L'}{row.type === 'PUT' ? 'P' : row.type === 'CALL' ? 'C' : '—'}
                    </span>
                    <span className="pm-gtable__c mono" data-align="right">{row.strike ? `$${row.strike}` : '—'}</span>
                    <span className="pm-gtable__c mono" data-align="right">{row.dte != null ? `${row.dte} j` : '—'}</span>
                    <span className={`pm-gtable__c mono text-${unrealTone}`} data-align="right">
                      {row.unrealPct == null ? '——' : `${row.unrealPct > 0 ? '+' : ''}${row.unrealPct.toFixed(1)}%`}
                    </span>
                    <span className="pm-gtable__c mono pm-gtable__signal" data-align="left">
                      {g ? g.metric : '—'}
                    </span>
                    <span className="pm-gtable__c" data-align="left">
                      <span className={`db-badge db-badge--${badgeSev}`} title={g ? `${g.metric}${g.others > 0 ? ` · +${g.others} signal${g.others > 1 ? 'aux' : ''}` : ''}` : 'aucune gate active'}>
                        {badge}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* 4 — ÉTAGE DE CLÔTURE : AGENDA | ROUTINE (2 colonnes, vide bas mort). */}
      <motion.section variants={RISE_TILE_VARIANTS} className="lh-final pm-close" aria-label="Agenda et routine">
        <div className="pm-close__grid">
          {/* AGENDA DU JOUR */}
          <div className="pm-close__zone pm-close__zone--agenda">
            <div className="mk-title">Agenda du jour · {sessionLabel}</div>
            {agendaEmpty ? (
              <div className="pm-agenda-empty">
                <span className="pm-agenda-empty__title">Séance sans catalyseur programmé</span>
                {nextCatalyst ? (
                  <span className="pm-agenda-empty__next">
                    Prochain catalyseur — <strong>{nextCatalyst.label}</strong>{' '}
                    <span className="pm-agenda-empty__eta">{etaDays(nextCatalyst.date)}</span>
                  </span>
                ) : (
                  <span className="pm-agenda-empty__sub">Aucune annonce macro ni résultat à venir dans la fenêtre.</span>
                )}
              </div>
            ) : (
              <div className="pm-agenda">
                {/* MACRO */}
                <div className="pm-agenda__group">
                  <div className="pm-agenda__group-title">Macro</div>
                  {macroToday.length === 0 ? (
                    <div className="pm-agenda__none">Aucune annonce macro</div>
                  ) : (
                    macroToday.map((ev, i) => (
                      <div key={`m${i}`} className="pm-agenda__row">
                        <span className="pm-agenda__country mono">{ev.country || '—'}</span>
                        <span className="pm-agenda__label">{ev.event}</span>
                        {ev.impact && (
                          <span className="pm-agenda__impact" data-impact={ev.impact}>
                            {ev.impact === 'high' ? 'FORT' : ev.impact === 'medium' ? 'MOYEN' : 'FAIBLE'}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
                {/* EARNINGS */}
                <div className="pm-agenda__group">
                  <div className="pm-agenda__group-title">
                    Earnings{heldEarnCount > 0 ? ` · ${heldEarnCount} sur tes positions` : ''}
                  </div>
                  {earningsToday.length === 0 ? (
                    <div className="pm-agenda__none">Aucun résultat publié</div>
                  ) : (
                    earningsToday.map((e, i) => (
                      <div key={`e${i}`} className="pm-agenda__row" data-held={e.held || undefined}>
                        <span className="pm-agenda__country mono">{e.symbol}</span>
                        <span className="pm-agenda__label">
                          {e.eps ? `EPS ${e.eps}` : '—'}{e.rev ? ` · CA ${e.rev}` : ''}
                          {e.held && <span className="pm-agenda__held">position</span>}
                        </span>
                        {e.when && <span className="pm-agenda__impact" data-when={e.when.tone}>{e.when.label}</span>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ROUTINE PRÉ-MARCHÉ */}
          <div className="pm-close__zone pm-close__zone--routine">
            <div className="mk-title">
              Routine pré-marché
              <span className="pm-close__routine-count">
                {readyAt
                  ? `confirmée ${new Date(readyAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`
                  : `${checkedCount} / ${ROUTINE_ITEMS.length}`}
              </span>
            </div>
            <div className="pm-checklist">
              {ROUTINE_ITEMS.map((item) => (
                <label key={item.id} className="pm-check-row" data-checked={!!checks[item.id] || undefined}>
                  <input
                    type="checkbox"
                    className="pm-check-input"
                    checked={!!checks[item.id]}
                    onChange={() => toggleCheck(item.id)}
                  />
                  <span className="pm-check-box" aria-hidden="true">{checks[item.id] ? '✓' : ''}</span>
                  <span className="pm-check-label">{item.label}</span>
                </label>
              ))}
            </div>
            <div className="pm-actions">
              <button
                type="button"
                className="pm-btn pm-btn--ghost"
                onClick={resetChecks}
                disabled={checkedCount === 0 && !readyAt}
              >
                Reset
              </button>
              <button
                type="button"
                className="pm-btn pm-btn--primary"
                onClick={confirmReady}
                disabled={!allReady || !!readyAt}
              >
                {readyAt ? 'Confirmée ✓' : 'Confirm Ready'}
              </button>
            </div>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
