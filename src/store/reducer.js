// ═══════════════════════════════════════════════════════════════
//  STORE REDUCER — Pure `(state, action) => state` transitions.
//  Split out of useStore.jsx so the hook file only exports
//  components/hooks (preserves React Fast Refresh).
// ═══════════════════════════════════════════════════════════════

import { toFloat, ensurePositive, generateId, roundTo2, roundTo5, roundTo6 } from '../utils/math';
import { sanitizeSectors, DEFAULT_SECTORS } from '../config/tapeGroups';

const normalizeStrike = (s) => String(parseFloat(s) || 0);

// Rétention des snapshots NLV quotidiens (FF-données). Exportée pour les
// tests. ~10 ans : le localStorage reste borné (≈ 0.5 Mo au pire) et la
// série 1Y/ALL du Héros 1 ne perd plus d'historique.
export const DAILY_SNAPSHOT_MAX_DAYS = 3650;

export function applyAction(state, action) {
  switch (action.type) {
    case 'SET_LIVE_RATE':
      return { ...state, settings: { ...state.settings, liveRate: action.payload } };

    // Phase B (D3) — le flux Supabase alimente l'état de compte (NLV/cash/
    // dispo/marge/settled). SEUL settings.ibkrLiveData bouge : ni positions,
    // ni trades. Ses consommateurs (LIQUIDITÉ DISPO, badge NLV, fraîcheur du
    // writer pic) le lisent déjà. Remplace l'ex-bridge local (useIbkrLive mort).
    case 'SET_IBKR_LIVE':
      return {
        ...state,
        settings: {
          ...state.settings,
          ibkrLiveData: action.payload || null,
          lastSync: action.payload?.timestamp ?? state.settings.lastSync,
        },
      };

    case 'SET_FX_MODE':
      return { ...state, settings: { ...state.settings, fxMode: action.payload } };

    case 'SET_FX_LAST_UPDATED':
      return { ...state, settings: { ...state.settings, fxLastUpdated: action.payload } };

    case 'SET_FX_SOURCE':
      return { ...state, settings: { ...state.settings, fxSource: action.payload } };

    case 'SET_GW_AUTO_CONNECT':
      // Toggle UI ↔ useIbkrLive : false coupe le polling /ibkr/account au
      // prochain effect run, true le relance. Persisté automatiquement par
      // le subscribe localStorage (persistSettings lit settings.gwAutoConnect).
      return { ...state, settings: { ...state.settings, gwAutoConnect: Boolean(action.payload) } };

    // É4-b — case 'SET_ACTIVE_SNIPER_TIER' SUPPRIMÉE (jamais dispatchée ;
    // doctrine tier V1 morte — matrice E×C abolie par la carte V3).

    case 'SET_INITIAL_CAPITAL': {
      // B4 — capital de référence manuel en CHF. Payload null/0/NaN
      // efface la saisie (retour au fallback auto). Stocké brut, la
      // conversion CHF→USD se fait dans calculatePortfolioMetrics avec
      // le liveRate courant.
      const raw = action.payload;
      const value =
        typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;
      return { ...state, settings: { ...state.settings, initialCapitalChf: value } };
    }

    case 'SET_TAPE_SECTORS': {
      // 1.G-c · D2 — groupe SECTEURS du bandeau, éditable en Réglages.
      // Normalisation UNIQUE via sanitizeSectors (majuscules, charset
      // equity, dédup, plafond). Payload vide/invalide → retour au
      // défaut (jamais un bandeau amputé du groupe 3).
      const clean = sanitizeSectors(action.payload);
      return {
        ...state,
        settings: {
          ...state.settings,
          tapeSectors: clean.length ? clean : DEFAULT_SECTORS,
        },
      };
    }

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
      // FF-données : rétention LONGUE (3650 j ≈ 10 ans). L'ancien cap 60
      // effaçait l'historique NLV du Héros 1 au-delà de 3 mois — la série
      // 1Y/ALL lit désormais tout l'historique. Un snapshot ≈ 150 octets
      // JSON → 3650 points ≈ 0.5 Mo au pire, borné bien sous le quota
      // localStorage ; le graphe rééchantillonne à 190 pts (resampleSeries).
      // Au-delà du cap : drop du plus ancien après tri par date (FIFO).
      // Aucune migration nécessaire : lever un cap préserve l'existant.
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
      if (appended.length > DAILY_SNAPSHOT_MAX_DAYS) {
        appended = appended
          .slice()
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          .slice(appended.length - DAILY_SNAPSHOT_MAX_DAYS);
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
        // Q-B — le moyennage n'est plus MUET : lots[] garde la provenance
        // de chaque entrée (journal de lots) et `averaged` rend l'événement
        // VISIBLE. Le marquage de violation S6 (chip ambre) est dérivé de
        // lots.length par le moteur evaluatePositionViolations. On enregistre,
        // on ne bloque pas.
        const updated = {
          ...existing,
          lots: newLots,
          averaged: true,
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

    case 'UPDATE_POSITION': {
      // U4-bis — Édition manuelle d'une position OUVERTE. Merge par id,
      // restreint à une liste blanche de champs éditables sûrs (jamais
      // `id`, le mark `pc`, ni aucun dérivé). Si `pi` ou `ct` change, on
      // retire `lots` (provenance d'agrégation ADD_POSITION) : la saisie
      // manuelle devient la vérité (un seul lot autoritaire), ce qui évite
      // tout désync entre ct/pi top-level et les lots agrégés.
      const { id, ...incoming } = action.payload || {};
      if (!id) return state;
      // Q-B — earningsDate (tri-état) + entryNote éditables via le tiroir.
      // Micro-brique capture — données d'ENTRÉE (E2/E4). Aucun ne touche lots
      // (stripLots ne se déclenche que sur pi/ct).
      const EDITABLE = [
        'tk', 'ty', 'dir', 'st', 'ex', 'pi', 'ct', 'di', 'earningsDate', 'entryNote',
        'midAtEntry', 'bidAtEntry', 'askAtEntry', 'thetaAtEntryPerDay', 'deltaAtEntry',
      ];
      const patch = {};
      for (const k of EDITABLE) {
        if (incoming[k] !== undefined) patch[k] = incoming[k];
      }
      const stripLots = 'pi' in patch || 'ct' in patch;
      const updated = state.openPositions.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (stripLots) delete next.lots;
        return next;
      });
      return { ...state, openPositions: updated };
    }

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

    case 'ADD_TICKER': {
      // U6 — Watchlist : ajoute un ticker de suivi. Normalisé majuscules,
      // trim, dédup, vide ignoré. Ce n'est PAS une position de portefeuille.
      const raw = typeof action.payload === 'string' ? action.payload : '';
      const tk = raw.trim().toUpperCase();
      if (!tk) return state;
      const list = Array.isArray(state.watchlist) ? state.watchlist : [];
      if (list.includes(tk)) return state;
      return { ...state, watchlist: [...list, tk] };
    }

    case 'REMOVE_TICKER': {
      const tk = typeof action.payload === 'string' ? action.payload.trim().toUpperCase() : '';
      const list = Array.isArray(state.watchlist) ? state.watchlist : [];
      return { ...state, watchlist: list.filter((t) => t !== tk) };
    }

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
      // Addendum 2 n°1 — provenance du pc : quand un import DE RAPPORT
      // (Flex/CSV, `data.pcSyncedAt` posé par le dispatch) écrit des
      // positions, on horodate l'écriture des marks. La porte du writer
      // du pic juge CETTE fraîcheur (la source du chiffre qu'il
      // enregistre), plus jamais le timestamp du bridge. Une restauration
      // de backup ne stampe PAS (ses pc peuvent dater de semaines).
      const pcStamp =
        Array.isArray(data.openPositions) && typeof data.pcSyncedAt === 'string'
          ? { pcSyncedAt: data.pcSyncedAt }
          : null;
      return {
        ...state,
        openPositions: ensureIds(data.openPositions) ?? state.openPositions,
        closedTrades: ensureIds(data.closedTrades) ?? state.closedTrades,
        cashFlows: ensureIds(data.cashFlows) ?? state.cashFlows,
        journalEntries: ensureIds(data.journalEntries) ?? state.journalEntries,
        settings:
          data.settings || pcStamp
            ? { ...state.settings, ...(data.settings || {}), ...(pcStamp || {}) }
            : state.settings,
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
          // Addendum 2 n°1 — ce chemin écrit aussi les pc en masse.
          pcSyncedAt: sync.timestamp ?? state.settings.pcSyncedAt,
          // ibkrSummary : écrit par le bridge, persisté, AUCUN lecteur
          // UI (documenté É4 §5.3 — conservé : le flux d'écriture vit).
          ibkrSummary: sync.summary,
          ibkrLedger: sync.ledger,
          ibkrLiveData: sync.ibkrLiveData || null,
          // É4 §5.3 — ibkrOrders MORT : écrit ici, jamais lu par
          // personne, jamais persisté (useStore ne le sauve pas).
        },
      };
    }

    // É4 §5.3 — case 'SYNC_FLEX' MORT (0 dispatcheur : la synchro Flex
    // réelle passe par l'import additif de /settings/import).

    case 'RESET_ALL':
      // Preserve the user's FX preferences (rate + mode + last-update +
      // source) and the active Sniper tier — user-chosen strategy
      // config, same nature as the FX prefs. cashReport, lastSync,
      // ibkrLiveData, etc. — broker snapshots — are still wiped because
      // RESET_ALL is meant to remove accounting data, not preferences.
      return {
        openPositions: [],
        closedTrades: [],
        cashFlows: [],
        journalEntries: [],
        // Watchlist = liste de suivi (préférence), pas de la donnée
        // comptable → préservée comme les prefs FX / le tier Sniper.
        watchlist: state.watchlist,
        settings: {
          liveRate: state.settings.liveRate,
          fxMode: state.settings.fxMode,
          fxLastUpdated: state.settings.fxLastUpdated,
          fxSource: state.settings.fxSource,
          // 1.G-c — groupe SECTEURS du bandeau = préférence (comme la
          // watchlist), pas de la donnée comptable → préservé.
          tapeSectors: state.settings.tapeSectors,
          // É4-b (correction) — EFFACER EXPLICITEMENT l'historique NLV : les
          // `dailySnapshots` sont de la DONNÉE (la courbe d'équité), pas une
          // préférence. Sans ça, des snapshots orphelins de l'ère démo (points
          // à $24'000) se mêleraient à la vraie courbe dès le 1er dépôt (qui
          // crée une ancre — la garde de buildNlvSeries ne les couvre plus).
          // Le reset les EMPORTE ; il ne les masque pas.
          dailySnapshots: [],
        },
      };

    default:
      return state;
  }
}
