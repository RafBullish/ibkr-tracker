// ═══════════════════════════════════════════════════════════════
//  useDailyKillSwitch — P6-26
//
//  Daily loss kill switch : soft warning when today's realised P&L
//  (USD) drops below the user-set threshold. Purely visual — we do
//  NOT block order entry, we surface a warning card + a badge so
//  Rafael can notice and pause the session himself. "Garde-fou
//  visuel", pas "lock dur".
//
//  Storage:
//    ibkr_daily_max_loss → Number (negative USD, default -500)
//
//  The override flag is session-scoped (React state), so refreshing
//  the page re-shows the warning if still beyond threshold.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useClosedTrades, useSettings } from '../store/useStore';
import { todayDateString } from '../utils/dates';
import { tradePnlUsd } from '../utils/calculations';
import { toFloat } from '../utils/math';

const STORAGE_KEY = 'ibkr_daily_max_loss';
const DEFAULT_MAX_LOSS = -500;

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_MAX_LOSS;
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEFAULT_MAX_LOSS;
  } catch {
    return DEFAULT_MAX_LOSS;
  }
}

export default function useDailyKillSwitch() {
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const [maxLoss, setMaxLossState] = useState(readStored);
  const [overridden, setOverridden] = useState(false);

  // Cross-tab sync (localStorage 'storage' event)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === STORAGE_KEY) {
        setMaxLossState(readStored());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Intra-document sync (custom event dispatched by the setter)
  useEffect(() => {
    const handler = (e) => {
      if (e?.detail?.key === STORAGE_KEY) {
        setMaxLossState(readStored());
      }
    };
    window.addEventListener('ibkr:setting-change', handler);
    return () => window.removeEventListener('ibkr:setting-change', handler);
  }, []);

  const setMaxLoss = useCallback((next) => {
    const n = Number(next);
    const clean = Number.isFinite(n) ? n : DEFAULT_MAX_LOSS;
    setMaxLossState(clean);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clean));
      window.dispatchEvent(
        new CustomEvent('ibkr:setting-change', { detail: { key: STORAGE_KEY, value: clean } })
      );
    } catch {
      /* quota / disabled */
    }
  }, []);

  const lr = toFloat(settings?.liveRate) || 1;

  const dailyPnlUsd = useMemo(() => {
    const today = todayDateString();
    return (closedTrades || [])
      .filter((t) => t.do === today)
      .reduce((acc, t) => acc + tradePnlUsd(t, lr), 0);
  }, [closedTrades, lr]);

  const triggered = maxLoss < 0 && dailyPnlUsd <= maxLoss;
  const active = triggered && !overridden;

  return {
    maxLoss,
    setMaxLoss,
    dailyPnlUsd,
    triggered,
    overridden,
    setOverridden,
    active,
  };
}
