// ═══════════════════════════════════════════════════════════════
//  SETTINGS · IMPORT v3.0 « Midnight Terminal »
//  /settings/import
//
//  Two flows preserved:
//    1. IBKR Flex API (primary) — submit query id + token, server
//       fetches the CSV, parser merges into the store
//    2. CSV upload (drag & drop + file picker) — same parser path
//       for manual imports
// ═══════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Upload,
  Download,
  Cloud,
  File as FileIcon,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  useOpenPositions,
  useClosedTrades,
  useCashFlows,
  useJournalEntries,
  useSettings,
  useDispatch,
} from '../../store/useStore';
import { useToast } from '../../components/layout/Toast';
import { parseIbkrCsv, mergeIbkrData } from '../../utils/ibkrParser';
import { configureFlex, getFlexConfig, syncFlex } from '../../services/flexApi';

import GlassCard from '../../components/ui/GlassCard';
import StatusBadge from '../../components/ui/StatusBadge';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { CONTAINER_VARIANTS, TILE_VARIANTS } from '../../theme/animationVariants';

function formatLastSync(lastSync) {
  if (!lastSync) return null;
  const date = typeof lastSync === 'object' ? lastSync.date : lastSync;
  if (!date) return null;
  try {
    const d = new Date(date);
    return d.toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return null;
  }
}

function FlexSection() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const journalEntries = useJournalEntries();
  const settings = useSettings();
  const dispatch = useDispatch();
  const state = { openPositions, closedTrades, cashFlows, journalEntries, settings };
  const showToast = useToast();
  const saved = getFlexConfig();
  const [token, setToken] = useState(saved.token || '');
  const [queryId, setQueryId] = useState(saved.queryId || '');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const lastSyncLabel = formatLastSync(settings?.lastSync);

  const canSync = token.trim() && queryId.trim() && !syncing;

  const handleSync = async () => {
    const tk = token.trim();
    const qid = queryId.trim();
    if (!tk || !qid) return;

    configureFlex(tk, qid);
    setSyncing(true);
    setError('');
    setStatus('Envoi de la requête à IBKR…');
    try {
      setStatus('Génération du relevé IBKR (~10 s)…');
      const csvText = await syncFlex(tk, qid);
      setStatus('Analyse des données…');
      const parsed = parseIbkrCsv(csvText);
      const result = mergeIbkrData(parsed, state);
      dispatch({ type: 'IMPORT_DATA', payload: result.mergedData });
      const syncInfo = {
        date: new Date().toISOString(),
        positions: result.mergedData.openPositions?.length || 0,
        trades: result.mergedData.closedTrades?.length || 0,
        mouvements: result.stats?.cashFlowsAdded || 0,
        fxRate: result.mergedData.settings?.liveRate || settings.liveRate,
        stats: result.stats,
      };
      dispatch({ type: 'IMPORT_DATA', payload: { settings: { lastSync: syncInfo } } });

      const s = result.stats;
      const parts = [];
      if (s.positionsAdded > 0)
        parts.push(`${s.positionsAdded} position${s.positionsAdded > 1 ? 's' : ''}`);
      if (s.closedTradesAdded > 0)
        parts.push(`${s.closedTradesAdded} trade${s.closedTradesAdded > 1 ? 's' : ''}`);
      if (s.cashFlowsAdded > 0)
        parts.push(`${s.cashFlowsAdded} mouvement${s.cashFlowsAdded > 1 ? 's' : ''}`);
      const summary = parts.length
        ? `${parts.join(' · ')} ajouté${parts.length > 1 ? 's' : ''}`
        : 'Aucune nouvelle donnée';
      setStatus('');
      showToast.success(summary, {
        detail: `FX ${result.mergedData.settings?.liveRate?.toFixed?.(4) || '—'} · ${s.closedTradesAdded || 0} trades importés`,
      });
    } catch (e) {
      setError(e?.message || 'Erreur de synchronisation');
      setStatus('');
      showToast.error('Sync Flex échoué', {
        detail: e?.message || 'Token ou QueryID invalide ?',
        duration: 6000,
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <GlassCard hover={false} className="import-v3__card">
      <header className="import-v3__card-head">
        <div className="import-v3__card-icon">
          <Cloud size={16} aria-hidden="true" />
        </div>
        <div>
          <h2 className="import-v3__card-title">
            IBKR Flex Query{' '}
            <InfoTooltip
              content={{
                title: 'IBKR Flex',
                body: 'Configure un Flex Query côté IBKR puis colle QueryID + token ci-dessous. La sync déclenche la génération serveur (~10s) puis le parser merge les nouvelles données.',
              }}
              size={12}
            />
          </h2>
          <p className="import-v3__card-desc">
            Synchronisation automatique recommandée. Token et QueryID stockés en localStorage.
          </p>
        </div>
        {lastSyncLabel && <StatusBadge variant="live" label={`Sync ${lastSyncLabel}`} size="xs" />}
      </header>

      <div className="import-v3__form">
        <label>
          <span className="uppercase-label">QueryID</span>
          <input
            type="text"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
            placeholder="1234567"
            className="settings-v3__input"
          />
        </label>
        <label>
          <span className="uppercase-label">Token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="clé générée côté IBKR"
            className="settings-v3__input"
          />
        </label>
      </div>

      {status && (
        <div className="import-v3__status" data-tone="info">
          <Cloud size={13} aria-hidden="true" />
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div className="import-v3__status" data-tone="error">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="import-v3__actions">
        <button
          type="button"
          className="pg-mock-btn pg-mock-btn--primary"
          disabled={!canSync}
          onClick={handleSync}
        >
          {syncing ? 'Synchronisation…' : 'Synchroniser'}
        </button>
        {(saved.token || saved.queryId) && (
          <button
            type="button"
            className="pg-mock-btn"
            style={{ color: 'var(--loss-text)' }}
            onClick={() => {
              const ok = window.confirm(
                'Effacer les identifiants Flex ?\n\n' +
                  'Le Token et le QueryID seront retirés du localStorage. Tes trades importés ne sont pas affectés.'
              );
              if (!ok) return;
              try {
                localStorage.removeItem('ibkr_flex_queryid');
                localStorage.removeItem('ibkr_flex_token');
              } catch {
                /* quota */
              }
              setToken('');
              setQueryId('');
              showToast.success('Identifiants Flex effacés');
            }}
          >
            Effacer identifiants
          </button>
        )}
      </div>
    </GlassCard>
  );
}

function CsvUploadSection() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const journalEntries = useJournalEntries();
  const settings = useSettings();
  const dispatch = useDispatch();
  const state = { openPositions, closedTrades, cashFlows, journalEntries, settings };
  const showToast = useToast();
  const inputRef = useRef(null);
  const jsonInputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [lastImport, setLastImport] = useState(null);

  const handleRestoreJson = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const isShaped =
        payload &&
        typeof payload === 'object' &&
        (Array.isArray(payload.openPositions) ||
          Array.isArray(payload.closedTrades) ||
          Array.isArray(payload.cashFlows) ||
          Array.isArray(payload.journalEntries));
      if (!isShaped) {
        showToast.error('Format de backup invalide', {
          detail:
            'Le fichier ne contient aucune des clés attendues (openPositions / closedTrades / cashFlows / journalEntries).',
          duration: 6000,
        });
        return;
      }
      dispatch({ type: 'IMPORT_DATA', payload });
      showToast.success('Backup JSON restauré', {
        detail: `${payload.closedTrades?.length || 0} trades · ${payload.openPositions?.length || 0} positions · ${payload.journalEntries?.length || 0} entrées journal`,
      });
    } catch (e) {
      showToast.error('Restauration échouée', {
        detail: e?.message || String(e),
        duration: 6000,
      });
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseIbkrCsv(text);
      const result = mergeIbkrData(parsed, state);
      dispatch({ type: 'IMPORT_DATA', payload: result.mergedData });
      setLastImport({
        name: file.name,
        size: file.size,
        trades: result.stats?.closedTradesAdded || 0,
        positions: result.stats?.positionsAdded || 0,
        cashFlows: result.stats?.cashFlowsAdded || 0,
      });
      showToast.success('CSV importé avec succès', {
        detail: `${result.stats?.closedTradesAdded || 0} trades · ${result.stats?.positionsAdded || 0} positions · ${result.stats?.cashFlowsAdded || 0} mouvements`,
      });
    } catch (e) {
      showToast.error('Import échoué', {
        detail: e?.message || String(e),
        duration: 6000,
      });
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      openPositions: openPositions,
      closedTrades: closedTrades,
      cashFlows: cashFlows,
      journalEntries: journalEntries,
      settings: settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quantumcall-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast.success('Backup JSON exporté', {
      detail: `${closedTrades.length} trades · ${openPositions.length} positions · ${journalEntries.length} entrées journal`,
    });
  };

  return (
    <GlassCard hover={false} className="import-v3__card">
      <header className="import-v3__card-head">
        <div className="import-v3__card-icon">
          <Upload size={16} aria-hidden="true" />
        </div>
        <div>
          <h2 className="import-v3__card-title">Upload CSV manuel</h2>
          <p className="import-v3__card-desc">
            Drag &amp; drop un fichier Flex Query CSV ou cliquez pour parcourir.
          </p>
        </div>
      </header>

      <div
        className="import-v3__dropzone"
        data-dragging={dragging || undefined}
        data-parsing={parsing || undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          hidden
          onChange={(e) => processFile(e.target.files?.[0])}
        />
        <Upload size={28} aria-hidden="true" />
        <div className="import-v3__dropzone-title">
          {parsing ? 'Analyse en cours…' : 'Déposez un CSV ici'}
        </div>
        <div className="import-v3__dropzone-sub">
          ou cliquez pour parcourir · format Flex Query IBKR (.csv)
        </div>
      </div>

      {lastImport && (
        <div className="import-v3__last" role="status">
          <CheckCircle2 size={13} aria-hidden="true" style={{ color: 'var(--profit-text)' }} />
          <div>
            <strong className="mono">{lastImport.name}</strong> (
            {(lastImport.size / 1024).toFixed(1)} kB)
            <div style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>
              {lastImport.positions} pos · {lastImport.trades} trades · {lastImport.cashFlows}{' '}
              mouvements ajoutés
            </div>
          </div>
        </div>
      )}

      <div className="import-v3__actions">
        <button type="button" className="pg-mock-btn" onClick={handleExport}>
          <Download size={12} aria-hidden="true" /> Export JSON backup
        </button>
        <input
          ref={jsonInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleRestoreJson(f);
            e.target.value = '';
          }}
        />
        <button type="button" className="pg-mock-btn" onClick={() => jsonInputRef.current?.click()}>
          <Upload size={12} aria-hidden="true" /> Restaurer un backup JSON
        </button>
      </div>
    </GlassCard>
  );
}

export default function SettingsImport() {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className="page-container import-v3"
      variants={reducedMotion ? undefined : CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <FileIcon size={18} aria-hidden="true" />
            Import &amp; Backup
          </h1>
          <p className="page-subtitle">
            Sync automatique IBKR Flex Query · upload manuel CSV · export backup JSON.
          </p>
        </div>
      </motion.div>

      <motion.div variants={TILE_VARIANTS}>
        <FlexSection />
      </motion.div>

      <motion.div variants={TILE_VARIANTS}>
        <CsvUploadSection />
      </motion.div>

      <motion.div variants={TILE_VARIANTS}>
        <GlassCard variant="subtle" hover={false} style={{ padding: 'var(--space-4)' }}>
          <p
            style={{
              color: 'var(--text-tertiary)',
              margin: 0,
              fontSize: 'var(--fs-xs)',
              lineHeight: 1.6,
            }}
          >
            Le merge est <strong>idempotent</strong> : tu peux ré-importer plusieurs fois le même
            fichier sans créer de doublons (déduplication par date × ticker × signature des fees).
            Les trades et positions existants ne sont pas écrasés, seules les nouvelles lignes sont
            ajoutées.
          </p>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
