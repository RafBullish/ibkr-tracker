// ═══════════════════════════════════════════════════════════════
//  STORE REDUCER — Pure `(state, action) => state` transitions.
//  Split out of useStore.jsx so the hook file only exports
//  components/hooks (preserves React Fast Refresh).
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive, generateId, roundTo2, roundTo5, roundTo6 } from '../utils/math';

const normalizeStrike = (s) => String(parseFloat(s) || 0);

export function applyAction(state, action) {
  switch (action.type) {
    case 'SET_LIVE_RATE':
      return { ...state, settings: { ...state.settings, liveRate: action.payload } };

    case 'SET_FX_MODE':
      return { ...state, settings: { ...state.settings, fxMode: action.payload } };

    case 'SET_FX_LAST_UPDATED':
      return { ...state, settings: { ...state.settings, fxLastUpdated: action.payload } };

    case 'SET_FX_SOURCE':
      return { ...state, settings: { ...state.settings, fxSource: action.payload } };

    case 'SET_FX_STATE': {
      // Atomic post-fetch update — rate + timestamp + source in one dispatch
      // so consumers don't see an intermediate state with stale fields.
      // Each field is optional; omitted ones pass through. Explicit null on
      // lastUpdated/source clears the field.
      const p = action.payload || {};
      const next = { ...state.settings };
      if (p.rate != null) next.liveRate = p.rate;
      if (p.mode != null) next.fxMode = p.mode;
      if (p.lastUpdated !== undefined) next.fxLastUpdated = p.lastUpdated;
      if (p.source !== undefined) next.fxSource = p.source;
      return { ...state, settings: next };
    }

    case 'UPDATE_DAILY_SNAPSHOT': {
      // Idempotent par date — un appel répété le même jour avec les mêmes
      // valeurs renvoie la même référence d'état (pas de re-render storm,
      // pas de write localStorage inutile).
      //
      // FIFO 60 jours — au-delà, on drop le plus ancien après tri par date
      // pour conserver les 60 derniers points (≈ 3 mois ouvrés, suffisant
      // pour sparklines 30 j et marge confortable).
      const snap = action.payload;
      if (!snap || !snap.date) return state;
      const list = Array.isArray(state.settings.dailySnapshots)
        ? state.settings.dailySnapshots
        : [];
      const idx = list.findIndex((s) => s.date === snap.date);
      if (idx !== -1) {
        const existing = list[idx];
        const same = Object.keys(snap).every((k) => existing[k] === snap[k]);
        if (same) return state;
        const merged = list.slice();
        merged[idx] = { ...existing, ...snap };
        return { ...state, settings: { ...state.settings, dailySnapshots: merged } };
      }
      let appended = [...list, snap];
      if (appended.length > 60) {
        appended = appended
          .slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .slice(appended.length - 60);
      }
      return { ...state, settings: { ...state.settings, dailySnapshots: appended } };
    }

    case 'ADD_POSITION': {
      const pos = action.payload;
      const existingIdx = state.openPositions.findIndex(
        (p) =>
          p.tk === pos.tk &&
          p.as === pos.as &&
          p.dir === pos.dir &&
          (pos.as === 'Option'
            ? p.ty === pos.ty &&
              normalizeStrike(p.st) === normalizeStrike(pos.st) &&
              p.ex === pos.ex
            : true)
      );
      if (existingIdx !== -1) {
        const existing = state.openPositions[existingIdx];
        const mul = ensurePositive(pos.mu);
        const prevLots = existing.lots || [
          {
            ct: existing.ct,
            pi: existing.pi,
            fi: existing.fi || '0',
            di: existing.di,
            fxi: existing.fxi,
          },
        ];
        const newLots = [
          ...prevLots,
          {
            ct: String(toFloat(pos.ct)),
            pi: String(toFloat(pos.pi)),
            fi: String(toFloat(pos.fi)),
            di: pos.di,
            fxi: String(toFloat(pos.fxi)),
          },
        ];
        let tq = 0,
          tv = 0;
        newLots.forEach((l) => {
          tq += toFloat(l.ct);
          tv += toFloat(l.ct) * toFloat(l.pi);
        });
        let tw = 0,
          wfs = 0;
        newLots.forEach((l) => {
          const w = Math.abs(toFloat(l.pi) * mul * toFloat(l.ct));
          tw += w;
          wfs += toFloat(l.fxi) * w;
        });
        // Guard against div-by-zero when aggregated quantity is zero (corrupted lots).
        // Falls back to the incoming lot's values rather than persisting NaN in localStorage.
        const avgPrice = tq > 0 ? tv / tq : toFloat(pos.pi);
        const updated = {
          ...existing,
          lots: newLots,
          ct: String(roundTo6(tq)),
          pi: String(roundTo6(avgPrice)),
          pc: String(roundTo6(avgPrice)),
          fxi: String(roundTo5(tw > 0 ? wfs / tw : toFloat(pos.fxi))),
          fi: String(roundTo2(newLots.reduce((s, l) => s + toFloat(l.fi), 0))),
        };
        const newOpen = state.openPositions.map((p, i) => (i === existingIdx ? updated : p));
        return { ...state, openPositions: newOpen };
      }
      return { ...state, openPositions: [...state.openPositions, { ...pos, id: generateId() }] };
    }

    case 'UPDATE_LIVE_PRICE': {
      const updated = state.openPositions.map((p) =>
        p.id === action.payload.id ? { ...p, pc: action.payload.price } : p
      );
      return { ...state, openPositions: updated };
    }

    case 'DELETE_OPEN_POSITION':
      return {
        ...state,
        openPositions: state.openPositions.filter((p) => p.id !== action.payload),
      };

    case 'CLOSE_POSITION': {
      const { positionId, remainingPosition, closedTrade } = action.payload;
      let newOpen = state.openPositions.filter((p) => p.id !== positionId);
      if (remainingPosition) newOpen.push(remainingPosition);
      return {
        ...state,
        openPositions: newOpen,
        closedTrades: [...state.closedTrades, closedTrade],
      };
    }

    case 'ADD_CLOSED_TRADE':
      return {
        ...state,
        closedTrades: [...state.closedTrades, { ...action.payload, id: generateId() }],
      };

    case 'UPDATE_CLOSED_TRADE': {
      const upd = state.closedTrades.map((t) =>
        t.id === action.payload.id ? { ...t, ...action.payload } : t
      );
      return { ...state, closedTrades: upd };
    }

    case 'CONFIRM_EXIT_REASON': {
      // Lock in an auto-detected exitReason — strip the autodetect flag
      // so the UI stops showing the "auto" marker. Reason is unchanged.
      const upd = state.closedTrades.map((t) =>
        t.id === action.payload ? { ...t, _exitReasonAutoDetected: false } : t
      );
      return { ...state, closedTrades: upd };
    }

    case 'SET_EXIT_REASON': {
      // User manually overrides the exitReason. Clears the autodetect flag.
      const { id, reason } = action.payload;
      const upd = state.closedTrades.map((t) =>
        t.id === id ? { ...t, exitReason: reason, _exitReasonAutoDetected: false } : t
      );
      return { ...state, closedTrades: upd };
    }

    case 'DELETE_CLOSED_TRADE':
      return { ...state, closedTrades: state.closedTrades.filter((t) => t.id !== action.payload) };

    case 'ADD_CASH_FLOW':
      return { ...state, cashFlows: [...state.cashFlows, { ...action.payload, id: generateId() }] };

    case 'DELETE_CASH_FLOW':
      return { ...state, cashFlows: state.cashFlows.filter((e) => e.id !== action.payload) };

    case 'ADD_JOURNAL':
      return {
        ...state,
        journalEntries: [...state.journalEntries, { ...action.payload, id: generateId() }],
      };

    case 'UPDATE_JOURNAL': {
      const updated = state.journalEntries.map((j) =>
        j.id === action.payload.id ? { ...j, ...action.payload } : j
      );
      return { ...state, journalEntries: updated };
    }

    case 'DELETE_JOURNAL':
      return {
        ...state,
        journalEntries: state.journalEntries.filter((j) => j.id !== action.payload),
      };

    case 'IMPORT_DATA': {
      const data = action.payload;
      if (!data || typeof data !== 'object') return state;
      const keys = ['openPositions', 'closedTrades', 'cashFlows', 'journalEntries'];
      const hasValidKey = keys.some((k) => k in data && Array.isArray(data[k]));
      if (!hasValidKey && !data.settings) return state;
      // Ensure every imported item carries an id — parser output and
      // older JSON backups don't always include one, and per-row delete
      // actions key on id.
      const ensureIds = (arr) =>
        Array.isArray(arr)
          ? arr.map((item) => (item && item.id ? item : { ...item, id: generateId() }))
          : null;
      return {
        ...state,
        openPositions: ensureIds(data.openPositions) ?? state.openPositions,
        closedTrades: ensureIds(data.closedTrades) ?? state.closedTrades,
        cashFlows: ensureIds(data.cashFlows) ?? state.cashFlows,
        journalEntries: ensureIds(data.journalEntries) ?? state.journalEntries,
        settings: data.settings ? { ...state.settings, ...data.settings } : state.settings,
      };
    }

    case 'SYNC_IBKR': {
      const sync = action.payload;
      // Accept empty arrays explicitly — a truly flat account returns [] and must
      // replace the previous positions rather than keep stale ghosts.
      return {
        ...state,
        openPositions: Array.isArray(sync.openPositions) ? sync.openPositions : state.openPositions,
        cashFlows: Array.isArray(sync.cashFlows) ? sync.cashFlows : state.cashFlows,
        settings: {
          ...state.settings,
          liveRate: sync.fxRate || state.settings.liveRate,
          lastSync: sync.timestamp,
          ibkrSummary: sync.summary,
          ibkrLedger: sync.ledger,
          ibkrLiveData: sync.ibkrLiveData || null,
          ibkrOrders: sync.orders || state.settings.ibkrOrders || [],
        },
      };
    }

    case 'SYNC_FLEX': {
      const flex = action.payload;
      const existingTradeSigs = new Set(
        state.closedTrades.map((t) => `${t.tk}_${t.do}_${t.pi}_${t.po}_${t.ct}`)
      );
      const newTrades = (flex.closedTrades || [])
        .filter((t) => !existingTradeSigs.has(`${t.tk}_${t.do}_${t.pi}_${t.po}_${t.ct}`))
        .map((t) => ({ ...t, id: generateId() }));
      const existingFlowSigs = new Set(state.cashFlows.map((f) => `${f.da}_${f.ty}_${f.a1}`));
      const newFlows = (flex.cashFlows || [])
        .filter((f) => !existingFlowSigs.has(`${f.da}_${f.ty}_${f.a1}`))
        .map((f) => ({ ...f, id: generateId() }));
      return {
        ...state,
        closedTrades: [...state.closedTrades, ...newTrades],
        cashFlows: [...state.cashFlows, ...newFlows],
      };
    }

    case 'RESET_ALL':
      // Preserve the user's FX preferences (rate + mode + last-update +
      // source). cashReport, lastSync, ibkrLiveData, etc. — broker
      // snapshots — are still wiped because RESET_ALL is meant to remove
      // accounting data, not user-chosen FX preferences.
      return {
        openPositions: [],
        closedTrades: [],
        cashFlows: [],
        journalEntries: [],
        settings: {
          liveRate: state.settings.liveRate,
          fxMode: state.settings.fxMode,
          fxLastUpdated: state.settings.fxLastUpdated,
          fxSource: state.settings.fxSource,
        },
      };

    default:
      return state;
  }
}
