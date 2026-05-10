// ═══════════════════════════════════════════════════════════════
//  ALERTS ENGINE — Sniper OTM strategy alerts
// ═══════════════════════════════════════════════════════════════

import { daysToExpiration } from './dates';
import { calculateOpenPositionPnl } from './calculations';
import { toFloat } from './math';

const SEVERITY_ORDER = { red: 0, orange: 1, green: 2 };

/**
 * Generate alerts for all open option positions.
 * Returns sorted array: red first, then orange, then green.
 */
export function generateAlerts(positions, greeksMap, fxRate) {
  const alerts = [];

  for (const pos of positions) {
    if (pos.as !== 'Option') continue;

    const dte = daysToExpiration(pos.ex);
    if (typeof dte !== 'number') continue;

    const r = calculateOpenPositionPnl(pos, fxRate);
    const costBasis = Math.abs(r.costBasisUsd);
    const pctChg = costBasis > 0 ? (r.unrealizedPnlUsd / costBasis) * 100 : 0;
    const strike = toFloat(pos.st);
    const label = `${pos.tk} ${pos.ty} ${strike > 0 ? '$' + strike.toFixed(0) : ''}`;

    // Days held (from entry date to now)
    let daysHeld = 0;
    if (pos.di) {
      const entry = new Date(pos.di + 'T12:00:00');
      const now = new Date();
      now.setHours(12, 0, 0, 0);
      daysHeld = Math.round((now - entry) / 86400000);
    }

    // ═══ RED — Action requise ═══

    if (dte < 90) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'DTE_CRITICAL',
        severity: 'red',
        message: `${label} — DTE ${dte}j, fermer la position`,
        value: dte,
      });
    }

    if (pctChg <= -35) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'STOP_LOSS',
        severity: 'red',
        message: `${label} — Stop loss ${pctChg.toFixed(1)}%, couper`,
        value: pctChg,
      });
    }

    if (daysHeld >= 5 && pctChg < 15 && pctChg > -35) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'TIME_STOP',
        severity: 'red',
        message: `${label} — ${daysHeld}j sans +15%, time stop`,
        value: daysHeld,
      });
    }

    // ═══ ORANGE — Attention ═══

    if (dte >= 90 && dte <= 100) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'DTE_WARNING',
        severity: 'orange',
        message: `${label} — DTE ${dte}j, approche du time stop 90j`,
        value: dte,
      });
    }

    if (pctChg >= 80) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'TP2_REACHED',
        severity: 'orange',
        message: `${label} — +${pctChg.toFixed(1)}%, take profit total`,
        value: pctChg,
      });
    } else if (pctChg >= 40) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'TP1_REACHED',
        severity: 'orange',
        message: `${label} — +${pctChg.toFixed(1)}%, take profit partiel`,
        value: pctChg,
      });
    }

    // ═══ GREEN — Positif ═══

    if (pctChg >= 15 && pctChg < 40) {
      alerts.push({
        positionId: pos.id,
        ticker: pos.tk,
        type: 'IN_PROFIT',
        severity: 'green',
        message: `${label} — +${pctChg.toFixed(1)}%, position saine`,
        value: pctChg,
      });
    }
  }

  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return alerts;
}

/**
 * Filter alerts for a specific position.
 */
export function getPositionAlerts(positionId, alerts) {
  return alerts.filter((a) => a.positionId === positionId);
}
