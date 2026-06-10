// ═══════════════════════════════════════════════════════════════
//  SETTINGS · GENERAL — page-vitrine canonique (CANONICAL-5)
//  /settings/general
//
//  Quatrième consommatrice de la palette canonique (après Positions,
//  Greeks, Import). Page de configuration la plus dense — 9 sections
//  wrappées via le composant <Section> local qui retourne désormais
//  un <section className="settings-page__section"> à plat sur
//  var(--depth-raised) plutôt qu'un <GlassCard>.
//
//  Pattern : pages-settings.css est PARTAGÉ entre les pages settings
//  à mesure qu'elles migrent (General est la 1re, Api/Journal suivront).
//
//  Icône des sections : NEUTRE (ink-soft) par défaut, AMBER (accent)
//  uniquement pour la Zone dangereuse (point d'attention).
//
//  Sections: Profil · Localisation · Apparence · Mode trading ·
//  Gestion du risque · Stratégie Sniper · Connexions API · Données ·
//  Cash flows · Zone dangereuse
// ═══════════════════════════════════════════════════════════════

import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  RefreshCw,
  Settings as SettingsIcon,
  User,
  Globe,
  Palette,
  KeyRound,
  Server,
  Database,
  ChevronRight,
  ShieldAlert,
  Crosshair,
  Trash2,
  AlertTriangle,
  Wallet,
  Plus,
} from 'lucide-react';
import {
  useOpenPositions,
  useClosedTrades,
  useCashFlows,
  useJournalEntries,
  useSettings,
  useDispatch,
} from '../../store/useStore';
import { useFx } from '../../hooks/useFx';
import useApiStatus, { SERVICE_ORDER } from '../../hooks/useApiStatus';
import useDailyKillSwitch from '../../hooks/useDailyKillSwitch';
import { useToast } from '../../components/layout/Toast';

import StatusBadge from '../../components/ui/StatusBadge';
import ThemeSwitcher from '../../components/ui/ThemeSwitcher';
import ApiServiceCard from '../../components/ui/ApiServiceCard';
import InfoTooltip from '../../components/ui/InfoTooltip';
import Modal from '../../components/ui/Modal';
import { todayDateString } from '../../utils/dates';
import {
  tierParams,
  sanitizeTier,
  EDGE_KEYS,
  CAPITAL_KEYS,
} from '../../utils/sniperMeta';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

const CASH_FLOW_TYPES = [
  { key: 'dep_chf', label: 'Dépôt CHF', sign: '+' },
  { key: 'wit_chf', label: 'Retrait CHF', sign: '-' },
  { key: 'adj_usd', label: 'Ajustement USD', sign: '+' },
  { key: 'fee_usd', label: 'Frais USD', sign: '-' },
  { key: 'fx_buy_usd', label: 'Conversion USD', sign: '~' },
];
const CASH_FLOW_LABEL = Object.fromEntries(CASH_FLOW_TYPES.map((t) => [t.key, t.label]));
const CASH_FLOW_SIGN = Object.fromEntries(CASH_FLOW_TYPES.map((t) => [t.key, t.sign]));

function killSwitchToneClass(pnl) {
  if (pnl > 0) return 'settings-page__kill-switch--up';
  if (pnl < 0) return 'settings-page__kill-switch--down';
  return 'settings-page__kill-switch--neutral';
}

function CashFlowsSection({ cashFlows, onAdd, onDelete }) {
  const [date, setDate] = useState(todayDateString());
  const [type, setType] = useState('dep_chf');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    const n = Number(amount);
    if (!date || !type || !Number.isFinite(n) || n <= 0) return;
    onAdd({ da: date, ty: type, a1: String(Math.abs(n)), a2: '0' });
    setAmount('');
  };

  const sorted = [...cashFlows].sort((a, b) => (b.da || '').localeCompare(a.da || ''));
  const shown = sorted.slice(0, 20);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="settings-page__cashflow-form">
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="uppercase-label">Date</span>
          <input
            type="date"
            className="settings-page__input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="uppercase-label">Type</span>
          <select
            className="settings-page__input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {CASH_FLOW_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="uppercase-label">Montant</span>
          <input
            type="number"
            step="0.01"
            min="0"
            className="settings-page__input"
            style={{ width: 120, minWidth: 'auto' }}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
          />
        </label>
        <button
          type="button"
          className="pg-mock-btn pg-mock-btn--primary"
          onClick={handleAdd}
          disabled={!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0}
        >
          <Plus size={12} aria-hidden="true" style={{ marginRight: 4 }} /> Ajouter
        </button>
      </div>
      {shown.length === 0 ? (
        <span className="settings-page__cashflow-empty">
          Aucun cash flow — les dépôts et retraits s'afficheront ici.
        </span>
      ) : (
        <div role="table" className="settings-page__cashflow-table">
          <span className="uppercase-label">Date</span>
          <span className="uppercase-label">Type</span>
          <span className="uppercase-label" style={{ textAlign: 'right' }}>
            Montant
          </span>
          <span />
          {shown.map((cf) => (
            <Fragment key={cf.id}>
              <span className="mono settings-page__cashflow-date">{cf.da}</span>
              <span>{CASH_FLOW_LABEL[cf.ty] || cf.ty}</span>
              <span className="mono settings-page__cashflow-amount">
                {CASH_FLOW_SIGN[cf.ty] === '-' ? '−' : CASH_FLOW_SIGN[cf.ty] === '+' ? '+' : '±'}
                {cf.a1}
              </span>
              <button
                type="button"
                className="history-v3__delete-btn"
                onClick={() => {
                  if (
                    window.confirm(
                      `Supprimer ce cash flow (${cf.da} · ${CASH_FLOW_LABEL[cf.ty] || cf.ty} · ${cf.a1}) ?`
                    )
                  ) {
                    onDelete(cf.id);
                  }
                }}
                aria-label="Supprimer ce cash flow"
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </Fragment>
          ))}
        </div>
      )}
      {cashFlows.length > 20 && (
        <span className="settings-page__cashflow-more">
          Affichage des 20 plus récents sur {cashFlows.length}.
        </span>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, description, danger = false, children }) {
  const cls = [
    'settings-page__section',
    danger && 'settings-page__section--danger',
  ].filter(Boolean).join(' ');
  return (
    <section className={cls}>
      <header className="settings-page__section-head">
        <div className="settings-page__section-icon">
          <Icon size={15} aria-hidden="true" />
        </div>
        <div>
          <h2 className="settings-page__section-title">{title}</h2>
          {description && <p className="settings-page__section-desc">{description}</p>}
        </div>
      </header>
      <div className="settings-page__section-body">{children}</div>
    </section>
  );
}

function Row({ label, description, children }) {
  return (
    <div className="settings-page__row">
      <div className="settings-page__row-label">
        <span>{label}</span>
        {description && <span className="settings-page__row-desc">{description}</span>}
      </div>
      <div className="settings-page__row-control">{children}</div>
    </div>
  );
}

export default function SettingsGeneral() {
  const reducedMotion = useReducedMotion();

  const openPositions = useOpenPositions();

  const closedTrades = useClosedTrades();

  const cashFlows = useCashFlows();

  const journalEntries = useJournalEntries();

  const settings = useSettings();

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const status = useApiStatus();
  const showToast = useToast();

  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);

  const { refresh: refreshFx, isLoading: refreshing, error: fxError } = useFx();

  // Surface refresh failures as a toast — without this the user sees
  // no feedback because useFx.refresh() swallows errors and only
  // exposes them via state. Dedupe via ref so the toast fires once
  // per error instance, not on every re-render.
  const lastFxErrorRef = useRef(null);
  useEffect(() => {
    if (fxError && fxError !== lastFxErrorRef.current) {
      lastFxErrorRef.current = fxError;
      showToast.error('Échec de la mise à jour du taux USD/CHF', {
        detail: fxError.message,
      });
    }
  }, [fxError, showToast]);

  const handleResetAll = () => {
    dispatch({ type: 'RESET_ALL' });
    // Also wipe related localStorage keys that live outside the main store.
    try {
      localStorage.removeItem('ibkr_flex_queryid');
      localStorage.removeItem('ibkr_flex_token');
      localStorage.removeItem('ibkr_history_view_mode');
      localStorage.removeItem('chain_history');
    } catch {
      /* quota */
    }
    setResetOpen(false);
    setResetConfirmed(false);
    showToast.success('Données effacées', {
      detail: 'Trades, positions, cash flows, journal et identifiants Flex ont été purgés.',
    });
    navigate('/dashboard');
  };
  // P6-25: lire localStorage + documentElement dataset au mount pour refléter
  // la préférence correctement au premier paint (avant on lisait le DOM
  // synchrone, qui était vide avant le useEffect de GlobalStyles).
  const [colorblind, setColorblind] = useState(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('ibkr_colorblind') === 'true';
      // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing pattern, refactor tracked in BACKLOG.md (post-V1)
      setColorblind(stored);
      if (stored) document.documentElement.dataset.colorblind = 'true';
    } catch {
      /* ignore */
    }
  }, []);
  const liveRate = settings?.liveRate || 0.88;

  const hasPositions = (openPositions || []).length > 0;
  const modeVariant = hasPositions ? 'real' : 'paper';

  const killSwitch = useDailyKillSwitch();
  const [maxLossDraft, setMaxLossDraft] = useState(String(killSwitch.maxLoss));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing pattern, refactor tracked in BACKLOG.md (post-V1)
    setMaxLossDraft(String(killSwitch.maxLoss));
  }, [killSwitch.maxLoss]);
  const commitMaxLoss = () => {
    const n = Number(maxLossDraft);
    if (!Number.isFinite(n)) return;
    killSwitch.setMaxLoss(n);
  };

  // Brique 13 — tier Sniper actif. Pas de draft : un <select> commit
  // immédiatement via SET_ACTIVE_SNIPER_TIER (payload {e, c} complet
  // pour rester atomique). Label/params dérivés via tierParams().
  const activeTier = sanitizeTier(settings?.activeSniperTier);
  const activeTierInfo = tierParams(activeTier);
  const commitTier = (patch) => {
    dispatch({
      type: 'SET_ACTIVE_SNIPER_TIER',
      payload: { ...activeTier, ...patch },
    });
  };

  // B4 — capital de référence manuel (CHF). Stocké brut, converti en USD
  // au taux courant pour alimenter la cascade dans calculatePortfolioMetrics.
  const initialCapitalChf = settings?.initialCapitalChf ?? null;
  const [initialCapitalDraft, setInitialCapitalDraft] = useState(
    initialCapitalChf != null ? String(initialCapitalChf) : ''
  );
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-existing pattern, refactor tracked in BACKLOG.md (post-V1)
    setInitialCapitalDraft(initialCapitalChf != null ? String(initialCapitalChf) : '');
  }, [initialCapitalChf]);
  const commitInitialCapital = () => {
    const trimmed = String(initialCapitalDraft).trim();
    if (trimmed === '') {
      dispatch({ type: 'SET_INITIAL_CAPITAL', payload: null });
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) {
      dispatch({ type: 'SET_INITIAL_CAPITAL', payload: null });
      return;
    }
    dispatch({ type: 'SET_INITIAL_CAPITAL', payload: n });
  };
  const draftNumber = Number(initialCapitalDraft);
  const initialCapitalUsdPreview =
    Number.isFinite(draftNumber) && draftNumber > 0 && liveRate > 0
      ? draftNumber / liveRate
      : null;

  const activeCount = Object.values(status).filter((s) => s.status === 'active').length;
  const inactiveCount = Object.values(status).filter((s) => s.status === 'inactive').length;

  return (
    <motion.div
      className="page-container settings-page"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <SettingsIcon size={18} aria-hidden="true" />
            Réglages généraux
          </h1>
          <p className="page-subtitle">
            Profil, localisation, apparence, mode, connexions API, données.
          </p>
        </div>
      </motion.div>

      {/* ── Profil ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={User}
          title="Profil"
          description="Identité du compte. Aucune donnée envoyée serveur."
        >
          <Row label="Nom" description="Affiché dans les rapports et exports.">
            <input
              type="text"
              aria-label="Nom du profil"
              className="settings-page__input"
              defaultValue="Rafael"
              placeholder="Ton nom"
              onBlur={(e) => {
                try {
                  localStorage.setItem('ibkr_profile_name', e.target.value);
                } catch {
                  /* quota */
                }
              }}
            />
          </Row>
          <Row label="Email" description="Email de contact pour exports et rapports.">
            <input
              type="email"
              aria-label="Adresse email"
              className="settings-page__input"
              defaultValue=""
              placeholder="email@example.com"
            />
          </Row>
        </Section>
      </motion.div>

      {/* ── Localisation ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={Globe}
          title="Localisation"
          description="Timezone, locale, devise de référence."
        >
          <Row label="Timezone">
            <input
              type="text"
              aria-label="Timezone"
              className="settings-page__input"
              defaultValue="Europe/Zurich"
              readOnly
            />
          </Row>
          <Row label="Locale UI">
            <span className="mono" style={{ color: 'var(--ink-soft)' }}>
              fr-CH (interface) · de-CH (valeurs CHF) · en-US (valeurs USD)
            </span>
          </Row>
          <Row
            label="Taux USD/CHF"
            description="Taux courant utilisé pour les conversions indicatives."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span
                className="mono"
                style={{
                  fontSize: 'var(--fs-lg)',
                  fontWeight: 'var(--fw-bold)',
                  color: 'var(--ink-pure)',
                  fontVariantNumeric: 'tabular-nums slashed-zero',
                }}
              >
                {liveRate.toFixed(4)}
              </span>
              <button
                type="button"
                className="pg-mock-btn"
                onClick={refreshFx}
                disabled={refreshing}
              >
                <RefreshCw
                  size={12}
                  style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
                />
                {refreshing ? 'Actualisation…' : 'Actualiser'}
              </button>
            </div>
          </Row>
          <Row
            label="Capital de référence (CHF)"
            description="Capital que tu considères placé, pour le calcul des % de return. Tes apports mensuels restent suivis séparément via le TWR — ce montant ne fausse pas le timing."
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="number"
                aria-label="Capital de référence en CHF"
                className="settings-page__input"
                style={{ width: 130, minWidth: 'auto', textAlign: 'right' }}
                value={initialCapitalDraft}
                min="0"
                step="100"
                onChange={(e) => setInitialCapitalDraft(e.target.value)}
                onBlur={commitInitialCapital}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
                placeholder="0"
              />
              <span
                className="mono"
                style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)' }}
              >
                CHF
              </span>
              {initialCapitalUsdPreview != null && (
                <span
                  className="mono"
                  style={{
                    color: 'var(--ink-mute)',
                    fontSize: 'var(--fs-xs)',
                    fontVariantNumeric: 'tabular-nums slashed-zero',
                  }}
                >
                  ≈{' '}
                  {(initialCapitalUsdPreview < 0 ? '-' : '') +
                    '$' +
                    new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Math.abs(initialCapitalUsdPreview))}{' '}
                  au taux {liveRate.toFixed(4)}
                </span>
              )}
            </div>
          </Row>
        </Section>
      </motion.div>

      {/* ── Apparence ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section icon={Palette} title="Apparence" description="Thème, motion, accessibilité.">
          <Row label="Thème actif">
            <ThemeSwitcher align="end" />
          </Row>
          <Row
            label="prefers-reduced-motion"
            description="Respecte automatiquement la préférence OS. Tu peux forcer via les paramètres système."
          >
            <span
              className="mono"
              style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)' }}
            >
              Géré par l'OS
            </span>
          </Row>
          <Row
            label="Mode daltonien"
            description="Remplace profit/loss par bleu/orange discriminables pour toutes les déficiences."
          >
            <button
              type="button"
              className="settings-page__toggle"
              data-active={colorblind || undefined}
              onClick={() => {
                const next = !colorblind;
                setColorblind(next);
                if (next) document.documentElement.dataset.colorblind = 'true';
                else document.documentElement.removeAttribute('data-colorblind');
                try {
                  localStorage.setItem('ibkr_colorblind', String(next));
                } catch {
                  /* quota */
                }
              }}
              aria-pressed={colorblind}
              aria-label="Activer le mode daltonien"
            >
              <span className="settings-page__toggle-track" aria-hidden="true" />
            </button>
          </Row>
        </Section>
      </motion.div>

      {/* ── Mode trading ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={KeyRound}
          title="Mode de trading"
          description="PAPER pour mode démo, REAL quand des positions live sont détectées."
        >
          <Row
            label="Mode actuel"
            description={
              hasPositions
                ? `${openPositions.length} position(s) ouverte(s) — mode réel actif.`
                : 'Aucune position — mode papier par défaut.'
            }
          >
            <StatusBadge variant={modeVariant} size="sm" />
          </Row>
        </Section>
      </motion.div>

      {/* ── Risk management (P6-26) ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={ShieldAlert}
          title="Gestion du risque"
          description="Garde-fou visuel quotidien. Aucun blocage d'ordre — juste un avertissement sur /insights/journal."
        >
          <Row
            label="Limite perte quotidienne (USD)"
            description="Montant négatif. Quand le P&L réalisé du jour passe sous ce seuil, un avertissement s'affiche dans le Journal et le Tilt Meter signale KILL SWITCH ACTIF."
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                type="number"
                aria-label="Seuil de perte quotidienne en USD"
                className="settings-page__input"
                style={{ width: 110, minWidth: 'auto', textAlign: 'right' }}
                value={maxLossDraft}
                step="50"
                max="0"
                onChange={(e) => setMaxLossDraft(e.target.value)}
                onBlur={commitMaxLoss}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <span
                className="mono"
                style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)' }}
              >
                USD
              </span>
            </div>
          </Row>
          <Row
            label="P&L réalisé aujourd'hui"
            description="Mis à jour en temps réel depuis les trades clôturés du jour."
          >
            <span className={`mono settings-page__kill-switch ${killSwitchToneClass(killSwitch.dailyPnlUsd)}`}>
              {(killSwitch.dailyPnlUsd > 0
                ? '+'
                : killSwitch.dailyPnlUsd < 0
                  ? '-'
                  : '') +
                '$' +
                new Intl.NumberFormat('de-CH', { maximumFractionDigits: 0 }).format(Math.abs(killSwitch.dailyPnlUsd))}
            </span>
          </Row>
          <Row
            label="Statut du garde-fou"
            description="ARMÉ quand le seuil est saisi. DÉCLENCHÉ quand les pertes du jour dépassent la limite."
          >
            <StatusBadge
              variant={killSwitch.triggered ? 'fail' : killSwitch.maxLoss < 0 ? 'live' : 'na'}
              label={
                killSwitch.triggered ? 'Déclenché' : killSwitch.maxLoss < 0 ? 'Armé' : 'Inactif'
              }
              size="sm"
            />
          </Row>
        </Section>
      </motion.div>

      {/* ── Stratégie Sniper (Brique 13) ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={Crosshair}
          title="Stratégie Sniper"
          description="Tier actif de la matrice E0–E4 × C1–C5 (Sniper OTM v1.0 Finale). Pilote le badge TIER du cockpit et le bloc TIER ACTIF du Dashboard."
        >
          <Row
            label="Tier actif (matrice E×C)"
            description="Edge tier = conviction (IV Rank à l'entrée). Capital tier = taille de position en % NLV."
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <select
                aria-label="Edge tier (E0 à E4)"
                className="settings-page__input"
                style={{ width: 84, minWidth: 'auto' }}
                value={activeTier.e}
                onChange={(e) => commitTier({ e: e.target.value })}
              >
                {EDGE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <span
                className="mono"
                style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)' }}
              >
                ×
              </span>
              <select
                aria-label="Capital tier (C1 à C5)"
                className="settings-page__input"
                style={{ width: 84, minWidth: 'auto' }}
                value={activeTier.c}
                onChange={(e) => commitTier({ c: e.target.value })}
              >
                {CAPITAL_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <span
                className="mono"
                style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)' }}
              >
                → TIER {activeTierInfo.label} · cash floor {activeTierInfo.cashFloorPct}% ·
                notional max {activeTierInfo.notionalMaxPct}%
              </span>
            </div>
          </Row>
        </Section>
      </motion.div>

      {/* ── Connexions API — §13.4 harmonized with /settings/api ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={Server}
          title="Connexions API"
          description="Même vue que la page API détails — source de vérité unique via useApiStatus."
        >
          <div className="settings-page__api-summary">
            <div className="settings-page__api-heading">
              <span className="uppercase-label">{SERVICE_ORDER.length} services</span>
              <StatusBadge variant="live" label={`${activeCount} actifs`} size="xs" />
              {inactiveCount > 0 && (
                <StatusBadge variant="fail" label={`${inactiveCount} KO`} size="xs" />
              )}
              <button
                type="button"
                className="settings-page__view-all"
                onClick={() => navigate('/settings/api')}
              >
                Voir détails <ChevronRight size={12} aria-hidden="true" />
              </button>
            </div>
            <div className="settings-page__api-list">
              {SERVICE_ORDER.map((key) => (
                <ApiServiceCard key={key} variant="summary" service={status[key]} />
              ))}
            </div>
          </div>
        </Section>
      </motion.div>

      {/* ── Données ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={Database}
          title="Données"
          description="Import, export, effacement du portefeuille local."
        >
          <Row
            label="Gérer l'import IBKR Flex"
            description="Drag & drop d'un CSV, preview, merge intelligent."
          >
            <button
              type="button"
              className="pg-mock-btn"
              onClick={() => navigate('/settings/import')}
            >
              Ouvrir Import <ChevronRight size={12} aria-hidden="true" />
            </button>
          </Row>
          <Row
            label="Taille localStorage"
            description="Estimation sommaire des données persistées."
          >
            <span
              className="mono"
              style={{
                color: 'var(--ink-mute)',
                fontVariantNumeric: 'tabular-nums slashed-zero',
              }}
            >
              {(() => {
                try {
                  let total = 0;
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    const v = localStorage.getItem(k);
                    total += (k?.length || 0) + (v?.length || 0);
                  }
                  return `${(total / 1024).toFixed(1)} kB`;
                } catch {
                  return '—';
                }
              })()}
            </span>
          </Row>
          <Row label="Nombre de trades clôturés" description="Historique cumulé dans le store.">
            <span
              className="mono"
              style={{
                color: 'var(--ink-pure)',
                fontWeight: 'var(--fw-semibold)',
                fontVariantNumeric: 'tabular-nums slashed-zero',
              }}
            >
              {closedTrades.length}
            </span>
          </Row>
        </Section>
      </motion.div>

      {/* ── Cash flows ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={Wallet}
          title="Cash flows"
          description="Dépôts, retraits, ajustements et conversions FX. Ajoutés automatiquement via Flex ou manuellement ici."
        >
          <CashFlowsSection
            cashFlows={cashFlows}
            onAdd={(cf) => dispatch({ type: 'ADD_CASH_FLOW', payload: cf })}
            onDelete={(id) => dispatch({ type: 'DELETE_CASH_FLOW', payload: id })}
          />
        </Section>
      </motion.div>

      {/* ── Zone dangereuse ── */}
      <motion.div variants={TILE_VARIANTS}>
        <Section
          icon={AlertTriangle}
          title="Zone dangereuse"
          description="Remise à zéro totale du portefeuille local. Action irréversible — fais un export backup avant."
          danger
        >
          <Row
            label="Effacer toutes les données"
            description={`${closedTrades.length} trades · ${openPositions.length} positions · ${cashFlows.length} cash flows · ${journalEntries.length} entrées journal + identifiants Flex`}
          >
            <button
              type="button"
              className="pg-mock-btn settings-page__btn-destructive"
              onClick={() => {
                setResetConfirmed(false);
                setResetOpen(true);
              }}
            >
              <Trash2 size={13} aria-hidden="true" style={{ marginRight: 6 }} />
              Remettre à zéro
            </button>
          </Row>
        </Section>
      </motion.div>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Effacer toutes les données"
      >
        <div className="settings-page__modal-body">
          <p>Cette action va supprimer définitivement de ce navigateur :</p>
          <ul className="settings-page__danger-list">
            <li>
              <strong className="mono">{closedTrades.length}</strong> trades clôturés
            </li>
            <li>
              <strong className="mono">{openPositions.length}</strong> positions ouvertes
            </li>
            <li>
              <strong className="mono">{cashFlows.length}</strong> cash flows (dépôts / retraits /
              FX)
            </li>
            <li>
              <strong className="mono">{journalEntries.length}</strong> entrées de journal
            </li>
            <li>
              Identifiants Flex (QueryID + Token), historique de recherche Chain, préférence Vue
              Sniper
            </li>
          </ul>
          <p className="settings-page__danger-text">
            Irréversible. Aucune copie serveur n'existe — tout vit uniquement dans ton navigateur.
          </p>
          <label className="settings-page__modal-checkbox">
            <input
              type="checkbox"
              checked={resetConfirmed}
              onChange={(e) => setResetConfirmed(e.target.checked)}
            />
            <span>Je comprends que cette action est irréversible</span>
          </label>
          <div className="settings-page__modal-actions">
            <button type="button" className="pg-mock-btn" onClick={() => setResetOpen(false)}>
              Annuler
            </button>
            <button
              type="button"
              className={`pg-mock-btn pg-mock-btn--primary${
                resetConfirmed ? ' settings-page__btn-destructive--filled' : ''
              }`}
              disabled={!resetConfirmed}
              onClick={handleResetAll}
            >
              Effacer tout
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Info footer ── */}
      <motion.div variants={TILE_VARIANTS}>
        <aside className="settings-page__panel settings-page__panel--subtle">
          <p className="settings-page__panel-footer-text">
            Toutes les préférences sont stockées en local. Tes clés IBKR Flex, ta configuration et
            tes trades ne quittent jamais ton navigateur — seuls les appels API (quotes, calendar)
            traversent le proxy Vercel.
          </p>
        </aside>
      </motion.div>
    </motion.div>
  );
}
