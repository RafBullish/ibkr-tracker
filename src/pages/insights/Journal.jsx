// ═══════════════════════════════════════════════════════════════
//  JOURNAL v3.0 « Midnight Terminal »
//  /insights/journal
//
//  Composition:
//   1. TiltMeter (14-day behavioural score) + Daily Kill Switch
//   2. Entries list (glass cards) with mood/mistake/tag filters
//   3. Add entry modal
//   4. Edge Leak Audit (tag × P&L crosstab)
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Notebook, Plus, Brain, TrendingDown, ShieldAlert, Trash2 } from 'lucide-react';
import { useClosedTrades, useJournalEntries, useSettings, useDispatch } from '../../store/useStore';
import { todayDateString } from '../../utils/dates';
import { generateId } from '../../utils/math';
import { tradePnlUsd } from '../../utils/calculations';
import { toFloat } from '../../utils/math';
import useDailyKillSwitch from '../../hooks/useDailyKillSwitch';

import GlassCard from '../../components/ui/GlassCard';
import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import TiltMeter from '../../components/charts/TiltMeter';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

const MOODS = [
  { key: 'calm', label: 'Calme', tone: 'profit' },
  { key: 'focus', label: 'Focus', tone: 'profit' },
  { key: 'confident', label: 'Confiant', tone: 'accent' },
  { key: 'neutral', label: 'Neutre', tone: 'neutral' },
  { key: 'frustrated', label: 'Frustré', tone: 'warning' },
  { key: 'fearful', label: 'Peur', tone: 'loss' },
  { key: 'euphoric', label: 'Euphorique', tone: 'warning' },
  { key: 'revenge', label: 'Revenge', tone: 'loss' },
];

const MISTAKE_TYPES = [
  { key: 'none', label: 'Aucune erreur', weight: 0 },
  { key: 'setup', label: 'Setup invalide', weight: 3 },
  { key: 'timing', label: 'Mauvais timing', weight: 2 },
  { key: 'sizing', label: 'Sizing trop gros', weight: 3 },
  { key: 'fomo', label: 'FOMO', weight: 5 },
  { key: 'revenge', label: 'Revenge trading', weight: 6 },
  { key: 'discipline', label: 'Manque discipline', weight: 4 },
  { key: 'early_exit', label: 'Sortie trop tôt', weight: 2 },
];

const TAG_PRESETS = [
  'Sniper OTM',
  'Suivi plan',
  'FOMO',
  'Revenge',
  'Patience',
  'Early exit',
  'Overtrading',
  'Discipline',
];

// ── Tilt score from recent 14-day entries ──────────────────────
function computeTiltScore(entries) {
  if (!entries?.length) return 0;
  const cutoff = Date.now() - 14 * 86400000;
  const recent = entries.filter((e) => e.date && new Date(e.date).getTime() >= cutoff);
  if (!recent.length) return 0;

  let weight = 0;
  for (const e of recent) {
    const mistakeWeight = MISTAKE_TYPES.find((m) => m.key === e.mistake)?.weight || 0;
    weight += mistakeWeight;
    // Mood amplifier
    if (e.mood === 'revenge' || e.mood === 'fearful') weight += 2;
    if (e.mood === 'euphoric') weight += 1;
  }
  // Normalize: 5 violations at max weight 6 = 30 → 100
  const maxPlausible = Math.max(5, recent.length) * 6;
  return Math.min(100, Math.round((weight / maxPlausible) * 100));
}

// ── Edge Leak Audit : tag × P&L aggregation ────────────────────
// P6-24 : fuzzy matching widens the journal-entry × closed-trade join to
// ticker + date ±1 day, so notes written the evening or morning around
// the trade still connect. Exact-date matches are preferred when both
// are available ; the ±1-day fallback picks the closest trade by absolute
// day delta to avoid double-counting.
const DAY_MS = 86400000;
function dayDelta(a, b) {
  if (!a || !b) return Infinity;
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.abs(Math.round((da - db) / DAY_MS));
}
function matchTrade(entry, closedTrades) {
  if (!entry.ticker || !entry.date) return null;
  const tickerTrades = closedTrades.filter((t) => t.tk === entry.ticker && t.do);
  if (!tickerTrades.length) return null;
  // Prefer exact date
  const exact = tickerTrades.find((t) => t.do === entry.date);
  if (exact) return exact;
  // Fallback ±1 day (pick the closest)
  let best = null;
  let bestDelta = Infinity;
  for (const t of tickerTrades) {
    const delta = dayDelta(t.do, entry.date);
    if (delta <= 1 && delta < bestDelta) {
      best = t;
      bestDelta = delta;
    }
  }
  return best;
}
function computeEdgeLeaks(journalEntries, closedTrades, lr) {
  const tagBuckets = {};
  // Deduplicate matched trades across entries so a single close doesn't
  // get counted twice if two journal entries reference the same trade
  // from different days.
  const matchedTradeIds = new Set();
  for (const e of journalEntries) {
    const tag = e.tag || e.mistake || 'none';
    if (!tagBuckets[tag]) tagBuckets[tag] = { count: 0, pnl: 0, wins: 0, losses: 0 };
    tagBuckets[tag].count++;
    const trade = matchTrade(e, closedTrades);
    if (trade && !matchedTradeIds.has(trade.id)) {
      matchedTradeIds.add(trade.id);
      const pnl = tradePnlUsd(trade, lr);
      tagBuckets[tag].pnl += pnl;
      if (pnl > 0) tagBuckets[tag].wins++;
      else if (pnl < 0) tagBuckets[tag].losses++;
    }
  }
  return Object.entries(tagBuckets)
    .map(([tag, stats]) => ({ tag, ...stats }))
    .sort((a, b) => a.pnl - b.pnl);
}

function Stars({ value = 0, onChange, readOnly }) {
  return (
    <div className="journal-v3__stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="journal-v3__star"
          data-filled={n <= value || undefined}
          onClick={() => !readOnly && onChange?.(n)}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          disabled={readOnly}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function AddEntryModal({ open, onClose, onSave }) {
  const [date, setDate] = useState(todayDateString());
  const [ticker, setTicker] = useState('');
  const [mood, setMood] = useState('neutral');
  const [mistake, setMistake] = useState('none');
  const [tag, setTag] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState(3);

  const reset = () => {
    setDate(todayDateString());
    setTicker('');
    setMood('neutral');
    setMistake('none');
    setTag('');
    setNote('');
    setRating(3);
  };

  const handleSave = () => {
    if (!ticker.trim()) return;
    onSave({
      id: generateId(),
      date,
      ticker: ticker.trim().toUpperCase(),
      mood,
      mistake,
      tag: tag || null,
      note,
      rating,
      createdAt: new Date().toISOString(),
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle entrée journal">
      <div className="add-trade-form">
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            <span className="uppercase-label">Ticker</span>
            <input value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="NVDA" />
          </label>
          <label>
            <span className="uppercase-label">Note setup (1-5)</span>
            <div style={{ paddingTop: 8 }}>
              <Stars value={rating} onChange={setRating} />
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Mood</span>
            <div className="add-trade-form__tags">
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="add-trade-form__tag"
                  data-active={mood === m.key || undefined}
                  onClick={() => setMood(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Erreur / biais</span>
            <div className="add-trade-form__tags">
              {MISTAKE_TYPES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="add-trade-form__tag"
                  data-active={mistake === m.key || undefined}
                  onClick={() => setMistake(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Tag stratégie</span>
            <div className="add-trade-form__tags">
              {TAG_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="add-trade-form__tag"
                  data-active={tag === p || undefined}
                  onClick={() => setTag(tag === p ? '' : p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Note</span>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observations, psychology, screenshot TradingView, etc."
            />
          </label>
        </div>
        <div className="add-trade-form__footer">
          <button type="button" className="pg-mock-btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="pg-mock-btn pg-mock-btn--primary" onClick={handleSave}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EntryCard({ entry, onDelete }) {
  const moodSpec = MOODS.find((m) => m.key === entry.mood) || MOODS[3];
  const mistakeSpec = MISTAKE_TYPES.find((m) => m.key === entry.mistake);
  return (
    <GlassCard hover className="journal-v3__entry">
      <header className="journal-v3__entry-head">
        <div>
          <span className="mono journal-v3__entry-ticker">{entry.ticker || '—'}</span>
          <span className="mono journal-v3__entry-date">{entry.date}</span>
        </div>
        <div className="journal-v3__entry-badges">
          <StatusBadge
            variant={
              moodSpec.tone === 'neutral'
                ? 'na'
                : moodSpec.tone === 'profit'
                  ? 'pass'
                  : moodSpec.tone === 'warning'
                    ? 'warn'
                    : moodSpec.tone === 'loss'
                      ? 'fail'
                      : 'accent'
            }
            label={moodSpec.label}
            size="xs"
          />
          {mistakeSpec && mistakeSpec.key !== 'none' && (
            <StatusBadge
              variant={mistakeSpec.weight >= 4 ? 'fail' : 'warn'}
              label={mistakeSpec.label}
              size="xs"
            />
          )}
          {entry.tag && <StatusBadge variant="accent" label={entry.tag} size="xs" />}
          {onDelete && (
            <button
              type="button"
              className="journal-v3__entry-delete"
              onClick={() => {
                if (
                  window.confirm(
                    `Supprimer cette entrée journal (${entry.ticker || 'sans ticker'} · ${entry.date}) ?`
                  )
                ) {
                  onDelete(entry.id);
                }
              }}
              aria-label="Supprimer cette entrée"
              title="Supprimer"
            >
              <Trash2 size={12} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>
      {entry.rating && (
        <div style={{ marginBottom: 8 }}>
          <Stars value={entry.rating} readOnly />
        </div>
      )}
      {entry.note && <p className="journal-v3__entry-note">{entry.note}</p>}
    </GlassCard>
  );
}

export default function Journal() {
  const reducedMotion = useReducedMotion();

  const closedTrades = useClosedTrades();

  const journalEntries = useJournalEntries();

  const settings = useSettings();

  const dispatch = useDispatch();
  const [addOpen, setAddOpen] = useState(false);
  const [filterMood, setFilterMood] = useState('all');
  const lr = toFloat(settings?.liveRate) || 1;

  const entries = useMemo(() => {
    return [...(journalEntries || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [journalEntries]);

  const tiltScore = useMemo(() => computeTiltScore(entries), [entries]);
  const edgeLeaks = useMemo(
    () => computeEdgeLeaks(entries, closedTrades, lr),
    [entries, closedTrades, lr]
  );
  const killSwitch = useDailyKillSwitch();

  const filtered = useMemo(() => {
    if (filterMood === 'all') return entries;
    return entries.filter((e) => e.mood === filterMood);
  }, [entries, filterMood]);

  const handleSave = (entry) => {
    dispatch({ type: 'ADD_JOURNAL', payload: entry });
  };

  const handleDelete = (id) => {
    dispatch({ type: 'DELETE_JOURNAL', payload: id });
  };

  return (
    <motion.div
      className="page-container journal-v3"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <Notebook size={18} aria-hidden="true" />
            Journal
            <StatusBadge
              variant="accent"
              label={`${entries.length} entrée${entries.length > 1 ? 's' : ''}`}
              size="xs"
            />
          </h1>
          <p className="page-subtitle">
            Suivi psychologique · mood, biais, tags stratégie · Edge Leak Audit.
          </p>
        </div>
        <button
          type="button"
          className="pg-mock-btn pg-mock-btn--primary"
          onClick={() => setAddOpen(true)}
        >
          <Plus size={12} aria-hidden="true" /> Nouvelle entrée
        </button>
      </motion.div>

      {/* ── Daily Kill Switch warning (P6-26) ── */}
      {killSwitch.active && (
        <motion.div variants={TILE_VARIANTS}>
          <GlassCard hover={false} className="journal-v3__killswitch" role="alert">
            <div className="journal-v3__killswitch-icon" aria-hidden="true">
              <ShieldAlert size={18} />
            </div>
            <div className="journal-v3__killswitch-body">
              <strong>Limite perte quotidienne atteinte.</strong>
              <span>
                Pertes du jour{' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  signDisplay: 'always',
                  maximumFractionDigits: 0,
                }).format(killSwitch.dailyPnlUsd)}{' '}
                · Seuil{' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  signDisplay: 'always',
                  maximumFractionDigits: 0,
                }).format(killSwitch.maxLoss)}
                . Pause session recommandée.
              </span>
            </div>
            <button
              type="button"
              className="pg-mock-btn"
              onClick={() => killSwitch.setOverridden(true)}
              aria-label="Désactiver manuellement le garde-fou pour cette session"
            >
              Désactiver manuellement
            </button>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Tilt Meter ── */}
      <motion.div variants={TILE_VARIANTS}>
        <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
          <TiltMeter score={tiltScore} dailyKillSwitchActive={killSwitch.active} />
        </GlassCard>
      </motion.div>

      {entries.length === 0 ? (
        <motion.div variants={TILE_VARIANTS}>
          <GlassCard variant="subtle" style={{ padding: 'var(--space-8)' }}>
            <EmptyState
              icon={Brain}
              title="Aucune entrée dans le journal"
              description="Enregistre tes décisions, ton mood et les biais cognitifs pour identifier les edges leaks."
              actions={[
                { label: 'Première entrée', onClick: () => setAddOpen(true), variant: 'primary' },
              ]}
            />
          </GlassCard>
        </motion.div>
      ) : (
        <>
          {/* ── Mood filter ── */}
          <motion.div variants={TILE_VARIANTS} className="journal-v3__filter-row">
            <span className="uppercase-label">Filtre mood</span>
            <div className="history-v3__tab-group">
              <button
                type="button"
                className="history-v3__tab"
                data-active={filterMood === 'all' || undefined}
                onClick={() => setFilterMood('all')}
              >
                Tous
              </button>
              {MOODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className="history-v3__tab"
                  data-active={filterMood === m.key || undefined}
                  onClick={() => setFilterMood(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── Entries list ── */}
          <motion.div variants={TILE_VARIANTS} className="journal-v3__entries">
            {filtered.length === 0 ? (
              <GlassCard variant="subtle" style={{ padding: 'var(--space-6)' }}>
                <EmptyState
                  size="compact"
                  title="Aucune entrée dans ce filtre"
                  description="Élargis le filtre ou ajoute une entrée."
                />
              </GlassCard>
            ) : (
              filtered.map((e) => <EntryCard key={e.id} entry={e} onDelete={handleDelete} />)
            )}
          </motion.div>

          {/* ── Edge Leak Audit ── */}
          <motion.div variants={TILE_VARIANTS}>
            <GlassCard hover={false} style={{ padding: 'var(--space-5)' }}>
              <div className="dashboard-v3__panel-head">
                <TrendingDown
                  size={14}
                  aria-hidden="true"
                  style={{ color: 'var(--text-tertiary)' }}
                />
                <span className="uppercase-label">Edge Leak Audit</span>
                <InfoTooltip
                  content={{
                    title: 'Edge Leak Audit',
                    body: 'Crosstab tag × P&L. Identifie les biais qui coûtent le plus (Revenge Trading négatif, FOMO négatif). Matcher journal entry + trade fermé sur ticker + date.',
                  }}
                  size={12}
                />
              </div>
              {edgeLeaks.length === 0 ? (
                <EmptyState
                  size="compact"
                  title="Pas encore d'edge leaks"
                  description="Les biais apparaissent quand tu tagues tes trades dans le journal."
                />
              ) : (
                <div className="journal-v3__edge-table" role="table">
                  <div className="journal-v3__edge-row journal-v3__edge-row--head" role="row">
                    <span className="uppercase-label">Tag / Biais</span>
                    <span className="uppercase-label" style={{ textAlign: 'right' }}>
                      Entrées
                    </span>
                    <span className="uppercase-label" style={{ textAlign: 'right' }}>
                      Gains / Pertes
                    </span>
                    <span className="uppercase-label" style={{ textAlign: 'right' }}>
                      P&amp;L matché
                    </span>
                  </div>
                  {edgeLeaks.map((l, i) => {
                    const tone = l.pnl > 0 ? 'profit' : l.pnl < 0 ? 'loss' : 'neutral';
                    return (
                      <div key={i} className="journal-v3__edge-row" role="row">
                        <span className="mono" style={{ fontWeight: 'var(--fw-semibold)' }}>
                          {l.tag}
                        </span>
                        <span className="mono" style={{ textAlign: 'right' }}>
                          {l.count}
                        </span>
                        <span className="mono" style={{ textAlign: 'right' }}>
                          <span className="text-profit">{l.wins}</span> /{' '}
                          <span className="text-loss">{l.losses}</span>
                        </span>
                        <span
                          className={`mono text-${tone}`}
                          style={{ textAlign: 'right', fontWeight: 'var(--fw-semibold)' }}
                        >
                          {l.pnl === 0
                            ? '—'
                            : `${l.pnl >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(l.pnl)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </motion.div>
        </>
      )}

      <AddEntryModal open={addOpen} onClose={() => setAddOpen(false)} onSave={handleSave} />
    </motion.div>
  );
}
