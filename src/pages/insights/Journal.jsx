// ═══════════════════════════════════════════════════════════════
//  JOURNAL — le miroir psychologique, au langage cockpit v1.0
//  (brique 2.C2). /insights/journal
//
//  Test de la première seconde : « suis-je discipliné en ce moment, et
//  où fuit mon edge ». Architecture (§4.2), de haut en bas :
//    1. BANDEAU DE COMMANDEMENT — signes vitaux servis (TILT · ENTRÉES ·
//       P&L JOUR · KILL SWITCH · PIRE FUITE).
//    2. HÉROS — TILTMETER 14 JOURS, jauge de discipline (SEULE exception
//       de couleur nommée, §4.3 : vert → ambre → rouge).
//    3. ÉTAGE ENTRÉES — filtre d'humeur en CHIPS + cartes denses.
//    4. EDGE LEAK AUDIT — crosstab tag × P&L au craft v1.0.
//
//  LOI DE COULEUR : compteurs / scores / taux NEUTRES ; argent réel
//  (P&L jour, P&L matché) toné par signe ; humeurs et biais NEUTRES
//  (un état émotionnel n'est pas un gain ni une perte). Le kill switch
//  lit la MÊME source que la bande décision (useDailyKillSwitch) et dit
//  la même chose (§4.5) : vocabulaire aligné (« Limite du jour franchie »).
// ═══════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { Notebook, Plus, Brain, TrendingDown, Trash2 } from 'lucide-react';
import { useClosedTrades, useJournalEntries, useSettings, useDispatch } from '../../store/useStore';
import { todayDateString } from '../../utils/dates';
import { generateId, toFloat } from '../../utils/math';
import { tradePnlUsd } from '../../utils/calculations';
import useDailyKillSwitch from '../../hooks/useDailyKillSwitch';
import { fmtUsdSigned } from '../../components/dashboard/hero1/kit';

import InfoTooltip from '../../components/ui/InfoTooltip';
import Modal from '../../components/ui/Modal';
import TiltMeter from '../../components/charts/TiltMeter';
import { TickValue } from '../../components/dashboard/decision/parts';

const MOODS = [
  { key: 'calm', label: 'Calme' },
  { key: 'focus', label: 'Focus' },
  { key: 'confident', label: 'Confiant' },
  { key: 'neutral', label: 'Neutre' },
  { key: 'frustrated', label: 'Frustré' },
  { key: 'fearful', label: 'Peur' },
  { key: 'euphoric', label: 'Euphorique' },
  { key: 'revenge', label: 'Revenge' },
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

const DAY_MS = 86400000;

// ── Tilt score (violations 14 j) ───────────────────────────────
function computeTiltScore(entries) {
  if (!entries?.length) return 0;
  const cutoff = Date.now() - 14 * DAY_MS;
  const recent = entries.filter((e) => e.date && new Date(e.date).getTime() >= cutoff);
  if (!recent.length) return 0;

  let weight = 0;
  for (const e of recent) {
    const mistakeWeight = MISTAKE_TYPES.find((m) => m.key === e.mistake)?.weight || 0;
    weight += mistakeWeight;
    if (e.mood === 'revenge' || e.mood === 'fearful') weight += 2;
    if (e.mood === 'euphoric') weight += 1;
  }
  const maxPlausible = Math.max(5, recent.length) * 6;
  return Math.min(100, Math.round((weight / maxPlausible) * 100));
}

function tiltLabel(score) {
  if (score < 25) return 'CALME';
  if (score < 50) return 'FOCUS';
  if (score < 75) return 'WARNING';
  return 'TILT';
}

function countRecent(entries, days = 14) {
  const cutoff = Date.now() - days * DAY_MS;
  return entries.filter((e) => e.date && new Date(e.date).getTime() >= cutoff).length;
}

// ── Edge Leak Audit : tag × P&L (matching flou ticker + date ±1 j) ──
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
  const exact = tickerTrades.find((t) => t.do === entry.date);
  if (exact) return exact;
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

// ── Étoiles (note d'auto-évaluation) — NEUTRES (pas d'ambre ambiant). ──
function Stars({ value = 0, onChange, readOnly }) {
  return (
    <div className="jr-stars">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="jr-star"
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

// ── Cellule-MONDE du bandeau (TickValue = micro-mouvement 1.F). ──
function BannerCell({ label, marker, value, meta, valTone }) {
  return (
    <div className="pf-c">
      <span className="pf-c__label">
        {label}
        {marker || null}
      </span>
      <TickValue text={value} className={`pf-c__val${valTone ? ` pf-c__val--${valTone}` : ''}`} />
      <span className="pf-c__meta">{meta || ' '}</span>
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
            <span className="uppercase-label">Humeur</span>
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
              placeholder="Observations, psychologie, screenshot TradingView, etc."
            />
          </label>
        </div>
        <div className="add-trade-form__footer">
          <button type="button" className="jr-btn jr-btn--ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="jr-btn" onClick={handleSave}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Carte d'entrée dense — chips NEUTRES (humeur, biais, tag ne sont pas
// de l'argent). Grille à colonnes fixes → plus de carte étirée dans un vide.
function EntryCard({ entry, onDelete }) {
  const moodSpec = MOODS.find((m) => m.key === entry.mood) || MOODS[3];
  const mistakeSpec = MISTAKE_TYPES.find((m) => m.key === entry.mistake);
  return (
    <div className="jr-card">
      <div className="jr-card__head">
        <div className="jr-card__id">
          <span className="jr-card__ticker mono">{entry.ticker || '—'}</span>
          <span className="jr-card__date">{entry.date}</span>
        </div>
        <div className="jr-card__badges">
          <span className="jr-tag">{moodSpec.label}</span>
          {mistakeSpec && mistakeSpec.key !== 'none' && (
            <span className="jr-tag jr-tag--mistake">{mistakeSpec.label}</span>
          )}
          {entry.tag && <span className="jr-tag">{entry.tag}</span>}
          {onDelete && (
            <button
              type="button"
              className="jr-card__delete"
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
      </div>
      {entry.rating ? <Stars value={entry.rating} readOnly /> : null}
      {entry.note && <p className="jr-card__note">{entry.note}</p>}
    </div>
  );
}

export default function Journal() {
  const closedTrades = useClosedTrades();
  const journalEntries = useJournalEntries();
  const settings = useSettings();
  const dispatch = useDispatch();
  const [addOpen, setAddOpen] = useState(false);
  const [filterMood, setFilterMood] = useState('all');
  const lr = toFloat(settings?.liveRate) || 1;

  const entries = useMemo(
    () => [...(journalEntries || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [journalEntries]
  );

  const tiltScore = useMemo(() => computeTiltScore(entries), [entries]);
  const recent14 = useMemo(() => countRecent(entries, 14), [entries]);
  const edgeLeaks = useMemo(
    () => computeEdgeLeaks(entries, closedTrades, lr),
    [entries, closedTrades, lr]
  );
  const killSwitch = useDailyKillSwitch();

  // Pire fuite = tag matché le plus négatif (edgeLeaks trié asc par P&L).
  const worstLeak = useMemo(() => edgeLeaks.find((l) => l.pnl < 0) || null, [edgeLeaks]);

  const filtered = useMemo(() => {
    if (filterMood === 'all') return entries;
    return entries.filter((e) => e.mood === filterMood);
  }, [entries, filterMood]);

  const handleSave = (entry) => dispatch({ type: 'ADD_JOURNAL', payload: entry });
  const handleDelete = (id) => dispatch({ type: 'DELETE_JOURNAL', payload: id });

  const killStatus = killSwitch.triggered
    ? 'DÉCLENCHÉ'
    : killSwitch.maxLoss < 0
      ? 'ARMÉ'
      : 'INACTIF';
  const dailyTone =
    killSwitch.dailyPnlUsd > 0 ? 'profit' : killSwitch.dailyPnlUsd < 0 ? 'loss' : undefined;

  return (
    <div className="page-container journal-page">
      <header className="page-header">
        <div>
          <h1 className="page-title">
            <Notebook size={18} aria-hidden="true" />
            Journal
          </h1>
          <p className="page-subtitle">
            Miroir psychologique · humeur, biais, tags stratégie · Edge Leak Audit.
          </p>
        </div>
        <button type="button" className="jr-btn" onClick={() => setAddOpen(true)}>
          <Plus size={14} aria-hidden="true" /> Nouvelle entrée
        </button>
      </header>

      {/* 1. BANDEAU DE COMMANDEMENT — signes vitaux servis (loi 34 px). */}
      <section
        className="lh-final journal-command jr-rise"
        style={{ animationDelay: '20ms' }}
        aria-label="Signes vitaux du journal"
      >
        <div className="journal-command__grid">
          <BannerCell label="Tilt · 14 j" value={String(tiltScore)} meta={tiltLabel(tiltScore)} />
          <BannerCell
            label="Entrées"
            value={String(entries.length)}
            meta={`${recent14} sur 14 j`}
          />
          <BannerCell
            label="P&L du jour"
            value={fmtUsdSigned(killSwitch.dailyPnlUsd)}
            valTone={dailyTone}
            meta="réalisé aujourd'hui"
          />
          <BannerCell
            label="Kill switch"
            marker={
              <span className="jr-kill-badge" data-on={killSwitch.triggered || undefined}>
                {killStatus}
              </span>
            }
            value={fmtUsdSigned(killSwitch.maxLoss)}
            meta="seuil perte / jour"
          />
          <BannerCell
            label="Pire fuite d'edge"
            value={worstLeak ? fmtUsdSigned(worstLeak.pnl) : '—'}
            valTone={worstLeak ? 'loss' : undefined}
            meta={worstLeak ? worstLeak.tag : 'aucune fuite nette'}
          />
        </div>
      </section>

      {/* Alerte kill switch — vocabulaire ALIGNÉ sur la bande décision (§4.5). */}
      {killSwitch.active && (
        <div className="jr-killswitch jr-rise" role="alert" style={{ animationDelay: '40ms' }}>
          <span className="jr-killswitch__marker" aria-hidden="true" />
          <div className="jr-killswitch__body">
            <span className="jr-killswitch__title">Limite du jour franchie · pause recommandée</span>
            <span className="jr-killswitch__detail">
              {fmtUsdSigned(killSwitch.dailyPnlUsd)} / {fmtUsdSigned(killSwitch.maxLoss)}
            </span>
          </div>
          <button
            type="button"
            className="jr-btn jr-btn--ghost"
            onClick={() => killSwitch.setOverridden(true)}
            aria-label="Désactiver manuellement le garde-fou pour cette session"
          >
            Désactiver manuellement
          </button>
        </div>
      )}

      {/* 2. HÉROS — TILTMETER 14 JOURS (exception couleur nommée, §4.3). */}
      <section
        className="lh-final tilt-hero jr-rise"
        style={{ animationDelay: '60ms' }}
        aria-label="Tilt Meter"
      >
        <TiltMeter score={tiltScore} dailyKillSwitchActive={killSwitch.active} />
      </section>

      {entries.length === 0 ? (
        <section className="lh-final jr-rise" style={{ animationDelay: '100ms', padding: '16px 18px' }}>
          <div className="jr-empty">
            <Brain size={22} aria-hidden="true" style={{ color: 'var(--ink-mute)' }} />
            <div className="jr-empty__title">Aucune entrée dans le journal</div>
            <div className="jr-empty__sub">
              Enregistre tes décisions, ton humeur et les biais cognitifs après chaque trade.
              Le Tilt Meter et l&apos;Edge Leak Audit se nourrissent de ces entrées.
            </div>
            <button type="button" className="jr-btn" onClick={() => setAddOpen(true)}>
              <Plus size={14} aria-hidden="true" /> Première entrée
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* 3. ÉTAGE ENTRÉES — filtre d'humeur en CHIPS + cartes denses. */}
          <div className="jr-filter jr-rise" style={{ animationDelay: '100ms' }}>
            <span className="jr-filter__label">Humeur</span>
            <button
              type="button"
              className="jr-chip"
              data-active={filterMood === 'all' || undefined}
              onClick={() => setFilterMood('all')}
            >
              Tous
            </button>
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                className="jr-chip"
                data-active={filterMood === m.key || undefined}
                onClick={() => setFilterMood(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="jr-entries jr-rise" style={{ animationDelay: '140ms' }}>
            {filtered.length === 0 ? (
              <div className="jr-empty">
                <div className="jr-empty__title">Aucune entrée dans ce filtre</div>
                <div className="jr-empty__sub">Élargis le filtre d&apos;humeur ou ajoute une entrée.</div>
              </div>
            ) : (
              filtered.map((e) => <EntryCard key={e.id} entry={e} onDelete={handleDelete} />)
            )}
          </div>

          {/* 4. EDGE LEAK AUDIT — crosstab au craft v1.0. */}
          <section className="lh-final jr-rise" style={{ animationDelay: '180ms', padding: '16px 18px' }}>
            <div className="jr-panel-head">
              <TrendingDown size={15} aria-hidden="true" style={{ color: 'var(--ink-mute)' }} />
              <span className="mk-title">Edge Leak Audit</span>
              <InfoTooltip
                content={{
                  title: 'Edge Leak Audit',
                  body: 'Crosstab tag × P&L. Identifie les biais qui coûtent le plus (Revenge trading, FOMO). Matche une entrée journal avec un trade fermé sur ticker + date (±1 j).',
                }}
                size={12}
              />
            </div>
            {edgeLeaks.length === 0 ? (
              <div className="jr-empty">
                <div className="jr-empty__title">Pas encore d&apos;edge leaks</div>
                <div className="jr-empty__sub">
                  Les biais apparaissent quand tu tagues tes trades dans le journal (tag
                  stratégie ou erreur), puis qu&apos;ils matchent un trade fermé.
                </div>
              </div>
            ) : (
              <div className="jr-edge" role="table">
                <div className="jr-edge__head" role="row">
                  <span className="jr-edge__h">Tag / Biais</span>
                  <span className="jr-edge__h" data-align="right">
                    Entrées
                  </span>
                  <span className="jr-edge__h" data-align="right">
                    Gains / Pertes
                  </span>
                  <span className="jr-edge__h" data-align="right">
                    P&amp;L matché
                  </span>
                </div>
                {edgeLeaks.map((l, i) => {
                  const tone = l.pnl > 0 ? 'profit' : l.pnl < 0 ? 'loss' : undefined;
                  return (
                    <div key={i} className="jr-edge__row" role="row">
                      <span className="jr-edge__c jr-edge__tag mono">{l.tag}</span>
                      <span className="jr-edge__c" data-align="right">
                        {l.count}
                      </span>
                      <span className="jr-edge__c jr-edge__wl" data-align="right">
                        {l.wins}
                        <span className="jr-edge__wl-sep">/</span>
                        {l.losses}
                      </span>
                      <span className="jr-edge__c jr-edge__pnl" data-align="right" data-tone={tone}>
                        {l.pnl === 0 ? '—' : fmtUsdSigned(l.pnl)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <AddEntryModal open={addOpen} onClose={() => setAddOpen(false)} onSave={handleSave} />
    </div>
  );
}
