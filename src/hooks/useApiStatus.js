// ═══════════════════════════════════════════════════════════════
//  useApiStatus  — single source of truth for external API health
//                  used by Calendar + Settings General + Settings API
//                  to stay perfectly in sync (fixes §13.4).
//
//  Covers the eight services the project talks to:
//    1. flex      — IBKR Flex Query (status derived from localStorage
//                    creds + settings.lastSync recency)
//    2. chart     — Yahoo Finance chart proxy (live /api/chart/SPY,
//                    used by hero strip sparklines). REPOINTED from
//                    the dead CBOE bucket (S3 AccessDenied) in B3.
//    3. yahoo     — Yahoo Finance options (live HEAD /api/yahoo/SPY)
//    4. finnhub   — Finnhub earnings/macro (live /api/health/finnhub)
//    5. fx        — Frankfurter FX USD/CHF (live /api/fx/usdchf)
//    6. vercel    — Vercel serverless meta (active if any of the
//                    four probe-based services is active; inactive
//                    otherwise)
//    7. storage   — Browser localStorage meta (always active unless
//                    quota / disabled)
//    8. ibkrLive  — Local IBKR bridge meta (status derived from
//                    settings.ibkrLiveData.timestamp recency vs
//                    FRESHNESS.LIVE_DATA_MAX_AGE_MS — same signal as
//                    the LIVE badge in CommandBar, kept in sync)
//
//  Returned shape per service:
//    {
//      status: 'checking' | 'active' | 'inactive' | 'unconfigured',
//      latency: number | null,
//      lastCheck: string | null,
//      error: string | null,
//      label: string,                 // display name in French
//      description: string,           // short one-liner
//    }
//
//  Legacy shape preserved for the Calendar consumer:
//    returned object is iterable over its entries; `.finnhub` still
//    points at the same spec so Calendar.jsx doesn't need to change.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import { POLLING, TIME, FRESHNESS } from '../constants/timing';

const DEFAULT_REFRESH_MS = POLLING.API_STATUS_MS;

const SERVICE_META = {
  ibkrLive: {
    label: 'IBKR Live (bridge)',
    description: 'Connexion temps réel au compte via le bridge local (port 8765).',
  },
  flex: {
    label: 'IBKR Flex Query',
    description: "Synchronisation CSV via le Flex Web Service d'IBKR.",
  },
  chart: {
    label: 'Yahoo Charts',
    description: 'Proxy Yahoo Finance pour les sparklines 7 j (hero strip).',
  },
  yahoo: {
    label: 'Yahoo Finance',
    description: "Chaîne d'options et quote de secours.",
  },
  finnhub: {
    label: 'Finnhub',
    description: 'Calendrier earnings + événements macro.',
  },
  fx: {
    label: 'Frankfurter FX',
    description: 'Taux USD/CHF ECB quotidien.',
  },
  vercel: {
    label: 'Vercel Serverless',
    description: 'Fonctions edge /api/*.',
  },
  storage: {
    label: 'LocalStorage navigateur',
    description: 'Persistance trades, positions, settings.',
  },
};

function initialServiceState(key) {
  return {
    status: 'checking',
    latency: null,
    lastCheck: null,
    error: null,
    label: SERVICE_META[key].label,
    description: SERVICE_META[key].description,
  };
}

function initialState() {
  return Object.fromEntries(Object.keys(SERVICE_META).map((k) => [k, initialServiceState(k)]));
}

// ─── Probe helpers ────────────────────────────────────────────
async function probeUrl(url, timeoutMs = 5000) {
  const t0 = performance.now();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    const latency = Math.round(performance.now() - t0);
    clearTimeout(id);
    if (!r.ok) return { ok: false, latency, error: `HTTP ${r.status}` };
    return { ok: true, latency, error: null };
  } catch (e) {
    clearTimeout(id);
    return { ok: false, latency: null, error: e?.message || 'timeout' };
  }
}

// ─── Service probes ───────────────────────────────────────────
async function probeFinnhub() {
  const t0 = performance.now();
  try {
    const r = await fetch('/api/health/finnhub', { cache: 'no-store' });
    const latency = Math.round(performance.now() - t0);
    const body = await r.json().catch(() => ({}));
    return {
      status: body.ok ? 'active' : 'inactive',
      latency: typeof body.latency === 'number' ? body.latency : latency,
      error: body.ok ? null : body.reason || `HTTP ${r.status}`,
    };
  } catch (e) {
    return { status: 'inactive', latency: null, error: e?.message || 'fetch error' };
  }
}

async function probeChart() {
  // B3 — REPOINTED from /api/cboe/SPY (S3 AccessDenied — bucket mort)
  // vers /api/chart/SPY (Yahoo Finance proxy, vivant). range/interval
  // minimaux (1 bougie quotidienne) pour limiter la charge.
  const r = await probeUrl('/api/chart/SPY?range=1d&interval=1d');
  return { status: r.ok ? 'active' : 'inactive', latency: r.latency, error: r.error };
}

async function probeYahoo() {
  const r = await probeUrl('/api/yahoo/SPY');
  return { status: r.ok ? 'active' : 'inactive', latency: r.latency, error: r.error };
}

async function probeFx() {
  const r = await probeUrl('/api/fx/usdchf');
  return { status: r.ok ? 'active' : 'inactive', latency: r.latency, error: r.error };
}

function probeIbkrLive() {
  // Bridge isn't HTTP-probed live: the /ibkr proxy only exists in dev (Vite),
  // and in prod the bridge sits on the user's machine — unreachable from
  // Vercel. We derive status from the freshest snapshot useIbkrLive wrote to
  // settings.ibkrLiveData.timestamp, against the same FRESHNESS threshold
  // CommandBar uses for the LIVE badge. Keeps the two surfaces coherent.
  try {
    const rawSettings = window.localStorage.getItem('ibkr_u_s');
    const settings = rawSettings ? JSON.parse(rawSettings) : null;
    const liveTs = settings?.ibkrLiveData?.timestamp;
    if (!liveTs) {
      return { status: 'unconfigured', latency: null, error: 'Aucune snapshot reçue du bridge' };
    }
    const ageMs = Date.now() - new Date(liveTs).getTime();
    if (ageMs > FRESHNESS.LIVE_DATA_MAX_AGE_MS) {
      const ageMin = Math.round(ageMs / TIME.ONE_MINUTE_MS);
      return {
        status: 'inactive',
        latency: null,
        error: `Dernière snapshot il y a ${ageMin} min — bridge déconnecté ?`,
      };
    }
    return { status: 'active', latency: null, error: null };
  } catch {
    return { status: 'inactive', latency: null, error: 'localStorage illisible' };
  }
}

function probeFlex() {
  // Flex isn't HTTP-probed live (it's a heavy sync). We derive status from
  // persisted credentials and the last-sync timestamp.
  try {
    const queryId = window.localStorage.getItem('ibkr_flex_queryid');
    const token = window.localStorage.getItem('ibkr_flex_token');
    if (!queryId || !token) {
      return { status: 'unconfigured', latency: null, error: 'Credentials manquants' };
    }
    const rawSettings = window.localStorage.getItem('ibkr_u_s');
    const settings = rawSettings ? JSON.parse(rawSettings) : null;
    const lastSync = settings?.lastSync;
    if (!lastSync) return { status: 'active', latency: null, error: null };
    const ageHours = (Date.now() - new Date(lastSync).getTime()) / TIME.ONE_HOUR_MS;
    if (ageHours > 48)
      return {
        status: 'inactive',
        latency: null,
        error: `Dernière sync il y a ${Math.round(ageHours)}h`,
      };
    return { status: 'active', latency: null, error: null };
  } catch {
    return { status: 'inactive', latency: null, error: 'localStorage illisible' };
  }
}

function probeStorage() {
  try {
    const key = '__ibkr_storage_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return { status: 'active', latency: null, error: null };
  } catch (e) {
    return { status: 'inactive', latency: null, error: e?.message || 'quota' };
  }
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HOOK
// ═══════════════════════════════════════════════════════════════
export default function useApiStatus({ refreshMs = DEFAULT_REFRESH_MS } = {}) {
  const [status, setStatus] = useState(initialState);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    const run = async () => {
      const [ibkrLive, flex, chart, yahoo, finnhub, fx, storage] = await Promise.all([
        Promise.resolve(probeIbkrLive()),
        Promise.resolve(probeFlex()),
        probeChart(),
        probeYahoo(),
        probeFinnhub(),
        probeFx(),
        Promise.resolve(probeStorage()),
      ]);

      if (!aliveRef.current) return;

      const now = new Date().toISOString();
      const vercelActive = [chart, yahoo, finnhub, fx].some((r) => r.status === 'active');
      const vercel = {
        status: vercelActive ? 'active' : 'inactive',
        latency: null,
        error: vercelActive ? null : 'Aucune fonction serverless ne répond',
      };

      setStatus((prev) => ({
        ...prev,
        ibkrLive: { ...prev.ibkrLive, ...ibkrLive, lastCheck: now },
        flex: { ...prev.flex, ...flex, lastCheck: now },
        chart: { ...prev.chart, ...chart, lastCheck: now },
        yahoo: { ...prev.yahoo, ...yahoo, lastCheck: now },
        finnhub: { ...prev.finnhub, ...finnhub, lastCheck: now },
        fx: { ...prev.fx, ...fx, lastCheck: now },
        vercel: { ...prev.vercel, ...vercel, lastCheck: now },
        storage: { ...prev.storage, ...storage, lastCheck: now },
      }));
    };

    run();
    const id = setInterval(run, refreshMs);
    return () => {
      aliveRef.current = false;
      clearInterval(id);
    };
  }, [refreshMs]);

  return status;
}

// ─── Helpers exposed for Settings pages ──────────────────────
export const SERVICE_ORDER = ['ibkrLive', 'flex', 'chart', 'yahoo', 'finnhub', 'fx', 'vercel', 'storage'];
export { SERVICE_META };
