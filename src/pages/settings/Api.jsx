// ═══════════════════════════════════════════════════════════════
//  SETTINGS · API — « qu'est-ce qui marche, qu'est-ce qui ne marche
//  pas ». Langage cockpit v1.0 (brique 2.D). /settings/api
//
//  Architecture (§4.5) :
//    1. BANDEAU — services actifs/total · en échec · dernière sonde.
//    2. TABLEAU DENSE (remplace la grille de 8 cartes aux libellés
//       cassés) : Service · État · Détail · Dernière vérif · Action.
//    3. Panneaux cockpit : bridge live IBKR (toggle) + gestion des clés.
//    4. Modal Flex, branchée sur la SOURCE UNIQUE sessionStorage (§4.1).
//
//  États au registre terminal : LIVE (vert, fait factuel — parité
//  StatusBar) · DOWN / OFF (NEUTRE : un service indisponible n'est pas
//  une perte d'argent, et un état durable n'est jamais ambre).
//
//  GlassCard : cette page en sort, MAIS le composant SURVIT (encore
//  consommé par App.jsx (fallback ErrorBoundary) et DataTable.jsx).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Server, Plug, KeyRound } from 'lucide-react';
import useApiStatus, { SERVICE_ORDER } from '../../hooks/useApiStatus';
import { useSettings, useDispatch } from '../../store/useStore';
import { configureFlex, getFlexConfig } from '../../services/flexApi';
import Modal from '../../components/ui/Modal';
import { TickValue } from '../../components/dashboard/decision/parts';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../../theme/animationVariants';

const STATE_MAP = {
  active: { label: 'LIVE', cls: 'live' },
  inactive: { label: 'DOWN', cls: 'down' },
  unconfigured: { label: 'OFF', cls: 'off' },
  checking: { label: '…', cls: 'checking' },
};

// Repli connu quand un service est indisponible/non configuré (parité
// avec la ligne Finnhub durable de 2.C1) — dit ce qui marche quand même.
const FALLBACK = {
  ibkrLive: 'Repli : imports Flex + saisie manuelle assurent le suivi.',
  finnhub: 'Repli : calendrier macro servi localement.',
};

function fmtTime(iso) {
  if (!iso) return '——';
  try {
    return new Date(iso).toLocaleTimeString('fr-CH', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '——';
  }
}

function ConfigFlexModal({ open, onClose }) {
  const saved = getFlexConfig();
  const [queryId, setQueryId] = useState(saved.queryId || '');
  const [token, setToken] = useState(saved.token || '');

  const handleSave = () => {
    configureFlex(token.trim(), queryId.trim());
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Configurer IBKR Flex Query">
      <div className="add-trade-form">
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">QueryID</span>
            <input value={queryId} onChange={(e) => setQueryId(e.target.value)} placeholder="1234567" />
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Token</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="clé générée côté IBKR"
              type="password"
            />
          </label>
        </div>
        <p style={{ color: 'var(--ink-mute)', fontSize: 'var(--fs-xs)', margin: 0, lineHeight: 1.6 }}>
          Portail IBKR → Reports → Flex Queries. Le QueryID est enregistré ; le token n&apos;est
          gardé que le temps de la session (jamais persisté en clair).
        </p>
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

function Cell({ label, value, meta, tone }) {
  return (
    <div className="pf-c settings-cell" data-tone={tone || undefined}>
      <span className="pf-c__label settings-cell__label">{label}</span>
      <TickValue text={value} className="pf-c__val settings-cell__val" />
      <span className="pf-c__meta settings-cell__meta">{meta || ' '}</span>
    </div>
  );
}

export default function SettingsApi() {
  const reducedMotion = useReducedMotion();
  const status = useApiStatus();
  const settings = useSettings();
  const dispatch = useDispatch();
  const gwAutoConnect = Boolean(settings?.gwAutoConnect);
  const [configOpen, setConfigOpen] = useState(false);

  const values = Object.values(status);
  const total = values.length;
  const activeCount = values.filter((s) => s.status === 'active').length;
  const inactiveCount = values.filter((s) => s.status === 'inactive').length;
  const lastProbe = values.map((s) => s.lastCheck).filter(Boolean).sort().pop();

  return (
    <motion.div
      className="page-container settings-page api-page"
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <Server size={18} aria-hidden="true" />
            Connexions API
          </h1>
          <p className="page-subtitle">
            Huit services intégrés · statut live sondé toutes les 2 minutes.
          </p>
        </div>
      </motion.div>

      {/* 1. BANDEAU. */}
      <motion.section variants={RISE_TILE_VARIANTS} className="lh-final settings-command">
        <div className="settings-command__grid api-command__grid">
          <Cell label="Services actifs" value={`${activeCount} / ${total}`} meta="sondés live" />
          <Cell
            label="En échec"
            value={String(inactiveCount)}
            meta={inactiveCount > 0 ? 'à vérifier' : 'tout répond'}
            tone={inactiveCount === 0 ? 'mute' : undefined}
          />
          <Cell label="Dernière sonde" value={fmtTime(lastProbe)} meta="rafraîchi ~2 min" />
        </div>
      </motion.section>

      {/* 2. TABLEAU DENSE — remplace la grille de cartes. */}
      <motion.section variants={RISE_TILE_VARIANTS} className="api-table" role="table" aria-label="Services API">
        <div className="api-table__head" role="row">
          <span className="api-table__h">Service</span>
          <span className="api-table__h">État</span>
          <span className="api-table__h">Détail</span>
          <span className="api-table__h" data-align="right">Dernière vérif.</span>
          <span className="api-table__h" data-align="right">Action</span>
        </div>
        {SERVICE_ORDER.map((key) => {
          const svc = status[key];
          const st = STATE_MAP[svc.status] || STATE_MAP.checking;
          const detail =
            (svc.status === 'inactive' || svc.status === 'unconfigured') && FALLBACK[key]
              ? FALLBACK[key]
              : svc.error
                ? svc.error
                : svc.status === 'active' && svc.latency != null
                  ? `${svc.description} · ${svc.latency} ms`
                  : svc.description;
          return (
            <div className="api-table__row" role="row" key={key}>
              <span className="api-table__c api-table__svc" title={svc.label}>
                {svc.label}
              </span>
              <span className="api-table__c">
                <span className={`api-state api-state--${st.cls}`}>{st.label}</span>
              </span>
              <span className="api-table__c api-table__detail" title={detail}>
                {detail}
              </span>
              <span className="api-table__c api-table__time" data-align="right">
                {fmtTime(svc.lastCheck)}
              </span>
              <span className="api-table__c" data-align="right">
                {key === 'flex' ? (
                  <button
                    type="button"
                    className="pg-mock-btn api-table__action"
                    onClick={() => setConfigOpen(true)}
                  >
                    Configurer
                  </button>
                ) : (
                  <span className="api-table__dash">—</span>
                )}
              </span>
            </div>
          );
        })}
      </motion.section>

      {/* 3. Panneau bridge live IBKR (toggle). */}
      <motion.section variants={RISE_TILE_VARIANTS} className="settings-page__section">
        <div className="api-panel">
          <div className="api-panel__icon">
            <Plug size={15} aria-hidden="true" />
          </div>
          <div className="api-panel__body">
            <div className="settings-page__section-title">Connexion live IBKR (bridge)</div>
            <p className="api-panel__desc">
              Synchro temps réel via le bridge local (port 8765). Désactiver fige l&apos;app sur
              les imports Flex et les saisies manuelles.
            </p>
          </div>
          <button
            type="button"
            className="settings-page__toggle"
            data-active={gwAutoConnect || undefined}
            onClick={() => dispatch({ type: 'SET_GW_AUTO_CONNECT', payload: !gwAutoConnect })}
            aria-pressed={gwAutoConnect}
            aria-label="Activer la connexion live IBKR"
          >
            <span className="settings-page__toggle-track" aria-hidden="true" />
          </button>
        </div>
      </motion.section>

      {/* 4. Panneau gestion des clés (info). */}
      <motion.section variants={RISE_TILE_VARIANTS} className="settings-page__section">
        <div className="api-panel">
          <div className="api-panel__icon">
            <KeyRound size={15} aria-hidden="true" />
          </div>
          <div className="api-panel__body">
            <div className="settings-page__section-title">Gestion des clés</div>
            <p className="api-panel__desc">
              Finnhub et Twelve Data se configurent côté serveur (variables d&apos;environnement
              Vercel, cf. <code className="mono-code">.env.example</code>). Les identifiants IBKR
              Flex vivent uniquement dans ton navigateur — QueryID persistant, token en session.
              Les erreurs d&apos;API remontent dans la bannière de la page Calendrier et la console.
            </p>
          </div>
        </div>
      </motion.section>

      <ConfigFlexModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </motion.div>
  );
}
