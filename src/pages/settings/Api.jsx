// ═══════════════════════════════════════════════════════════════
//  SETTINGS · API v3.0 « Midnight Terminal »
//  /settings/api
//
//  Detail view of the seven services the project integrates with,
//  backed by useApiStatus (§13.4 fix — same hook consumed by
//  /settings/general's summary, so both pages cannot disagree).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Server, KeyRound, FileText, Plug } from 'lucide-react';
import useApiStatus, { SERVICE_ORDER } from '../../hooks/useApiStatus';
import { useSettings, useDispatch } from '../../store/useStore';
import GlassCard from '../../components/ui/GlassCard';
import ApiServiceCard from '../../components/ui/ApiServiceCard';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

function ConfigFlexModal({ open, onClose }) {
  const [queryId, setQueryId] = useState(() => {
    try {
      return localStorage.getItem('ibkr_flex_queryid') || '';
    } catch {
      return '';
    }
  });
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('ibkr_flex_token') || '';
    } catch {
      return '';
    }
  });

  const handleSave = () => {
    try {
      if (queryId) localStorage.setItem('ibkr_flex_queryid', queryId.trim());
      if (token) localStorage.setItem('ibkr_flex_token', token.trim());
    } catch {
      /* quota */
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Configurer IBKR Flex Query">
      <div className="add-trade-form">
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">QueryID</span>
            <input
              value={queryId}
              onChange={(e) => setQueryId(e.target.value)}
              placeholder="1234567"
            />
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Token</span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="..."
              type="password"
            />
          </label>
        </div>
        <p
          style={{
            color: 'var(--text-tertiary)',
            fontSize: 'var(--fs-xs)',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Obtiens ces identifiants depuis le portail IBKR → Reports → Flex Queries. Stocké en clair
          dans localStorage.
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

export default function SettingsApi() {
  const reducedMotion = useReducedMotion();
  const status = useApiStatus();
  const settings = useSettings();
  const dispatch = useDispatch();
  const gwAutoConnect = Boolean(settings?.gwAutoConnect);
  const [configOpen, setConfigOpen] = useState(null);

  const activeCount = Object.values(status).filter((s) => s.status === 'active').length;
  const inactiveCount = Object.values(status).filter((s) => s.status === 'inactive').length;

  return (
    <motion.div
      className="page-container api-v3"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <Server size={18} aria-hidden="true" />
            Connexions API
          </h1>
          <p className="page-subtitle">
            Sept services intégrés · statut live probé toutes les 2 minutes.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <StatusBadge variant="live" label={`${activeCount} actifs`} size="sm" />
          {inactiveCount > 0 && (
            <StatusBadge variant="fail" label={`${inactiveCount} KO`} size="sm" />
          )}
        </div>
      </motion.div>

      <motion.div variants={TILE_VARIANTS} className="api-v3__grid">
        {SERVICE_ORDER.map((key) => (
          <ApiServiceCard
            key={key}
            service={status[key]}
            onConfig={key === 'flex' ? () => setConfigOpen('flex') : undefined}
          />
        ))}
      </motion.div>

      <motion.div variants={TILE_VARIANTS}>
        <GlassCard variant="subtle" hover={false} style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <Plug
              size={14}
              aria-hidden="true"
              style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <div className="uppercase-label" style={{ marginBottom: 4 }}>
                Connexion live IBKR (bridge)
              </div>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                Active la synchro temps réel via le bridge local (port 8765). Désactiver fige
                l'app sur les imports Flex et les saisies manuelles.
              </p>
            </div>
            <button
              type="button"
              className="settings-page__toggle"
              data-active={gwAutoConnect || undefined}
              onClick={() =>
                dispatch({ type: 'SET_GW_AUTO_CONNECT', payload: !gwAutoConnect })
              }
              aria-pressed={gwAutoConnect}
              aria-label="Activer la connexion live IBKR"
            >
              <span className="settings-page__toggle-track" aria-hidden="true" />
            </button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={TILE_VARIANTS}>
        <GlassCard variant="subtle" hover={false} style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <KeyRound
              size={14}
              aria-hidden="true"
              style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div className="uppercase-label" style={{ marginBottom: 4 }}>
                Gestion des clés
              </div>
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: 'var(--fs-sm)',
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                Les clés Finnhub et Twelve Data se configurent côté serveur via les variables
                d'environnement Vercel (voir <code className="mono">.env.example</code>). Les
                identifiants IBKR Flex (QueryID + token) sont stockés localement dans ton
                navigateur.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={TILE_VARIANTS}>
        <GlassCard variant="subtle" hover={false} style={{ padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <FileText
              size={14}
              aria-hidden="true"
              style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }}
            />
            <div style={{ flex: 1 }}>
              <div className="uppercase-label" style={{ marginBottom: 4 }}>
                Logs récents
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', margin: 0 }}>
                Les erreurs d'API sont remontées dans la bannière contextuelle de la page Calendrier
                et sur les composants consommateurs. Pour du debug approfondi, consulte la console
                du navigateur et les logs Vercel.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <ConfigFlexModal open={configOpen === 'flex'} onClose={() => setConfigOpen(null)} />
    </motion.div>
  );
}
