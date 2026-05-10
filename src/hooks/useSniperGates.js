// ═══════════════════════════════════════════════════════════════
//  useSniperGates v5 Sprint 2.1 — 6-gate snapshot per open position
//
//  Returns one row per open option position (stocks skipped) with the
//  six Sniper OTM v1.0 Finale gates :
//
//     SL35    : DTE-based stop, fires when DTE <= 35
//     DTE45   : Close-window, fires when DTE <= 45
//     EARN-J2 : Pre-earnings dead zone, fires when next earnings <= 2d
//     EARN+J30: Post-earnings cooldown, eligible when last earnings >= 30d
//     TP      : Take-profit, fires at unrealized % >= 50 (short premium)
//     TR      : Trailing roll, conditional follow-up to TP (placeholder)
//
//  Each gate is shaped :
//     {
//       gate: 'SL35' | 'DTE45' | 'EARN-J2' | 'EARN+J30' | 'TP' | 'TR'
//       fillPct: 0..100   // intensity 0=safe, 100=triggered
//       label: string     // human-readable status
//       status: 'safe' | 'normal' | 'imminent' | 'armed' | 'pending'
//       hasData: boolean  // false when computation needs missing inputs
//     }
//
//  Sprint 2.1 wires SL35 / DTE45 / TP. EARN-J2 / EARN+J30 / TR are
//  rendered as 'pending' until earnings calendar matching (Sprint 5/6)
//  and TP/TR chain (Sprint 2.x) are wired.
// ═══════════════════════════════════════════════════════════════

import { useMemo } from 'react';
import { useOpenPositions } from '../store/useStore';
import { unrealizedPnlPct, dteFromExp, daysHeld } from '../utils/positions';

const SL35_THRESHOLD = 35;
const DTE45_THRESHOLD = 45;
const TP_TARGET_PCT = 50;
const SAFE_BUFFER = 60; // baseline DTE for "well clear" of any expiry gate

function clamp01(v) {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}

function statusFromFill(fillPct) {
  if (fillPct >= 95) return 'armed';
  if (fillPct >= 70) return 'imminent';
  if (fillPct >= 30) return 'normal';
  return 'safe';
}

function buildGates(pos, ref) {
  const dte = dteFromExp(pos.ex, ref);
  const isShort = pos.dir === 'Short';
  const unrealPct = unrealizedPnlPct(pos);

  // SL35 : intensity = (60 - dte) / (60 - 0). At dte=60 → 0%, dte=35 → 42%,
  // dte=10 → 83%, dte=0 → 100%.
  let sl35Fill = 0;
  let sl35Status = 'safe';
  let sl35Label = '—';
  if (dte != null) {
    sl35Fill = clamp01(((SAFE_BUFFER - dte) / SAFE_BUFFER) * 100);
    sl35Status = dte <= SL35_THRESHOLD ? 'armed' : statusFromFill(sl35Fill);
    sl35Label = dte <= SL35_THRESHOLD ? `DTE ${dte}d ≤ 35 ARMED` : `DTE ${dte}d (35)`;
  }

  // DTE45 : same baseline of 60d. Triggered at DTE <= 45.
  let dte45Fill = 0;
  let dte45Status = 'safe';
  let dte45Label = '—';
  if (dte != null) {
    dte45Fill = clamp01(((SAFE_BUFFER - dte) / SAFE_BUFFER) * 100);
    dte45Status = dte <= DTE45_THRESHOLD ? 'armed' : statusFromFill(dte45Fill);
    dte45Label = dte <= DTE45_THRESHOLD ? `DTE ${dte}d ≤ 45 ARMED` : `DTE ${dte}d (45)`;
  }

  // TP : for short premium, captured % == unrealized % (positive).
  // Long positions don't have a Sniper TP gate — render as 'pending'.
  let tpFill = 0;
  let tpStatus = isShort ? 'safe' : 'pending';
  let tpLabel = isShort ? `0% / ${TP_TARGET_PCT}` : 'long n/a';
  let tpHasData = isShort;
  if (isShort && Number.isFinite(unrealPct)) {
    const captured = Math.max(0, unrealPct);
    tpFill = clamp01((captured / TP_TARGET_PCT) * 100);
    tpStatus = captured >= TP_TARGET_PCT ? 'armed' : statusFromFill(tpFill);
    tpLabel = `${captured.toFixed(0)}% / ${TP_TARGET_PCT}`;
  }

  // EARN-J2 / EARN+J30 / TR : pending until subsequent sprints wire data.
  const pendingGate = (gate, label) => ({
    gate,
    fillPct: 0,
    label,
    status: 'pending',
    hasData: false,
  });

  return [
    {
      gate: 'SL35',
      fillPct: sl35Fill,
      label: sl35Label,
      status: sl35Status,
      hasData: dte != null,
    },
    {
      gate: 'DTE45',
      fillPct: dte45Fill,
      label: dte45Label,
      status: dte45Status,
      hasData: dte != null,
    },
    pendingGate('EARN-J2', 'earn calendar'),
    pendingGate('EARN+J30', 'earn calendar'),
    {
      gate: 'TP',
      fillPct: tpFill,
      label: tpLabel,
      status: tpStatus,
      hasData: tpHasData,
    },
    pendingGate('TR', 'tp chain'),
  ];
}

export default function useSniperGates(options = {}) {
  const positions = useOpenPositions();
  const ref = options.now;
  const positionsKey = (positions || []).map((p) => p.id).join('|');

  return useMemo(() => {
    if (!positions || positions.length === 0) return { rows: [], count: 0 };

    const rows = positions
      .filter((p) => p.as !== 'Action')
      .map((p) => {
        const dte = dteFromExp(p.ex, ref);
        const days = daysHeld(p.di, ref);
        return {
          id: p.id,
          ticker: p.tk,
          type: p.ty || '—',
          dir: p.dir,
          strike: p.st || null,
          dte,
          daysIn: days,
          unrealPct: unrealizedPnlPct(p),
          gates: buildGates(p, ref),
        };
      });

    return { rows, count: rows.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionsKey, ref]);
}

// Export pure builder for tests + future /__playground (none in v5).
export function buildSniperGatesRows(positions, options = {}) {
  const ref = options.now;
  const rows = (positions || [])
    .filter((p) => p.as !== 'Action')
    .map((p) => ({
      id: p.id,
      ticker: p.tk,
      type: p.ty || '—',
      dir: p.dir,
      strike: p.st || null,
      dte: dteFromExp(p.ex, ref),
      daysIn: daysHeld(p.di, ref),
      unrealPct: unrealizedPnlPct(p),
      gates: buildGates(p, ref),
    }));
  return { rows, count: rows.length };
}
