// ═══════════════════════════════════════════════════════════════
//  SETTINGS · IMPORT — « d'où viennent mes données, et est-ce que ça
//  a marché ». Langage cockpit v1.0 (brique 2.D). /settings/import (⌘9)
//
//  Architecture (§4.2), de haut en bas :
//    1. BANDEAU — signes vitaux servis (dernière sync, trades en base,
//       positions ouvertes, configuration Flex).
//    2. ÉTAGE SOURCES — deux portes d'entrée équivalentes : Flex IBKR |
//       fichier CSV.
//    3. ÉTAGE RÉSULTAT — le retour de la dernière opération (compte de
//       lignes ajoutées), état vide designé. Le merge est ADDITIF.
//    4. ÉTAGE SAUVEGARDE — export JSON + restauration validée.
//
//  Token Flex : source UNIQUE sessionStorage via flexApi (§4.1). Le
//  bouton « effacer les identifiants » purge le magasin réellement
//  utilisé (clearFlexCredentials). Aucun token n'est loggé ni affiché.
//
//  Couleur : succès = vert (résultat factuel d'opération, parité LIVE) ;
//  erreur d'import = registre NEUTRE appuyé (un import échoué n'est pas
//  une perte d'argent) ; le rouge est réservé à la zone dangereuse.
// ═══════════════════════════════════════════════════════════════

import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Upload,
  Download,
  Cloud,
  File as FileIcon,
  CheckCircle2,
  Info,
  RotateCcw,
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
import {
  configureFlex,
  getFlexConfig,
  syncFlex,
  clearFlexCredentials,
} from '../../services/flexApi';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { TickValue } from '../../components/dashboard/decision/parts';
import { RISE_CONTAINER_VARIANTS, RISE_TILE_VARIANTS } from '../../theme/animationVariants';
import { usePortfolioMetrics } from '../../hooks/usePortfolioMetrics';
import { readAllPositionMeta } from '../../utils/positionMeta';
import { evaluatePositionViolations, violationsOnly } from '../../utils/violations';

// Q-B — un import PRODUIT un rapport (zéro skip muet, zéro fusion muette).
// On calcule les VIOLATIONS de doctrine (chips ambre, jamais bloquantes)
// pour chaque position créée, sur le book fusionné + le capital de réf.
function buildImportOutcome(result, source, capitalUsd) {
  const report = result?.report || {};
  const book = result?.mergedData?.openPositions || [];
  const created = report.createdPositions || [];
  const violations = [];
  for (const pos of created) {
    const items = violationsOnly(evaluatePositionViolations(pos, { capitalUsd, book }));
    if (items.length) {
      violations.push({ tk: pos.tk, ty: pos.ty, st: pos.st, ex: pos.ex, items });
    }
  }
  return {
    source,
    at: new Date().toISOString(),
    positions: report.positions?.created ?? 0,
    trades: report.closedTrades?.created ?? 0,
    cashFlows: report.cashFlows?.created ?? 0,
    report: { ...report, violations },
  };
}

function formatLastSync(lastSync) {
  if (!lastSync) return null;
  const date = typeof lastSync === 'object' ? lastSync.date : lastSync;
  if (!date) return null;
  try {
    return new Date(date).toLocaleString('fr-CH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return null;
  }
}

// Cellule-MONDE du bandeau (label · valeur 34 px · méta), TickValue 1.F.
function Cell({ label, value, meta, tone }) {
  return (
    <div className="pf-c import-cell" data-tone={tone || undefined}>
      <span className="pf-c__label import-cell__label">{label}</span>
      <TickValue text={value} className="pf-c__val import-cell__val" />
      <span className="pf-c__meta import-cell__meta">{meta || ' '}</span>
    </div>
  );
}

function FlexSection({ onResult }) {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const journalEntries = useJournalEntries();
  const settings = useSettings();
  const dispatch = useDispatch();
  const metrics = usePortfolioMetrics();
  const capitalUsd = metrics?.netLiquidationValueUsd ?? null;
  const state = { openPositions, closedTrades, cashFlows, journalEntries, settings };
  const showToast = useToast();
  const saved = getFlexConfig();
  const [token, setToken] = useState(saved.token || '');
  const [queryId, setQueryId] = useState(saved.queryId || '');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [hasCreds, setHasCreds] = useState(Boolean(saved.token || saved.queryId));

  const canSync = token.trim() && queryId.trim() && !syncing;

  const handleSync = async () => {
    const tk = token.trim();
    const qid = queryId.trim();
    if (!tk || !qid) return;

    configureFlex(tk, qid);
    setHasCreds(true);
    setSyncing(true);
    setError('');
    setStatus('Envoi de la requête à IBKR…');
    try {
      setStatus('Génération du relevé IBKR (~10 s)…');
      const csvText = await syncFlex(tk, qid);
      setStatus('Analyse des données…');
      const parsed = parseIbkrCsv(csvText);
      const result = mergeIbkrData(parsed, state, { metaBySignature: readAllPositionMeta() });
      // Addendum 2 n°1 — l'import de rapport horodate l'écriture des pc
      // (provenance jugée par la porte du writer du pic).
      dispatch({ type: 'IMPORT_DATA', payload: { ...result.mergedData, pcSyncedAt: new Date().toISOString() } });
      const s = result.stats || {};
      const syncInfo = {
        date: new Date().toISOString(),
        // É3.1 — provenance persistée : le marqueur de mode (StatusBar)
        // distingue un vrai Flex IBKR d'un fichier CSV local.
        source: 'flex',
        positions: result.mergedData.openPositions?.length || 0,
        trades: result.mergedData.closedTrades?.length || 0,
        mouvements: s.cashFlowsAdded || 0,
        fxRate: result.mergedData.settings?.liveRate || settings.liveRate,
        stats: s,
      };
      dispatch({ type: 'IMPORT_DATA', payload: { settings: { lastSync: syncInfo } } });
      setStatus('');
      onResult(buildImportOutcome(result, 'Flex IBKR', capitalUsd));
      showToast.success('Synchronisation Flex terminée', {
        detail: `${s.closedTradesAdded || 0} trades · ${s.positionsAdded || 0} positions · ${s.cashFlowsAdded || 0} mouvements ajoutés`,
      });
    } catch (e) {
      setError(e?.message || 'Erreur de synchronisation');
      setStatus('');
      showToast.error('Synchronisation Flex échouée', {
        detail: e?.message || 'Token ou QueryID invalide ?',
        duration: 6000,
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="import-page__panel import-source">
      <header className="import-page__panel-head">
        <div className="import-page__panel-icon">
          <Cloud size={16} aria-hidden="true" />
        </div>
        <div>
          <h2 className="import-page__panel-title">
            IBKR Flex Query{' '}
            <InfoTooltip
              content={{
                title: 'IBKR Flex',
                body: 'Configure un Flex Query côté IBKR puis colle QueryID + token ci-dessous. La sync déclenche la génération serveur (~10 s) puis le parser fusionne les nouvelles données.',
              }}
              size={12}
            />
          </h2>
          <p className="import-page__panel-desc">
            Synchronisation automatique. Le token n&apos;est gardé que le temps de la session
            (jamais persisté en clair) ; le QueryID reste enregistré.
          </p>
        </div>
      </header>

      <div className="import-page__form">
        <label>
          <span className="uppercase-label">QueryID</span>
          <input
            type="text"
            value={queryId}
            onChange={(e) => setQueryId(e.target.value)}
            placeholder="1234567"
            className="settings-page__input"
          />
        </label>
        <label>
          <span className="uppercase-label">Token</span>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="clé générée côté IBKR"
            className="settings-page__input"
          />
        </label>
      </div>

      {status && (
        <div className="import-page__status" data-tone="info">
          <Cloud size={13} aria-hidden="true" />
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div className="import-page__status" data-tone="warn">
          <Info size={13} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="import-page__actions">
        {hasCreds && (
          <button
            type="button"
            className="pg-mock-btn import-page__btn-clear"
            onClick={() => {
              const ok = window.confirm(
                'Effacer les identifiants Flex ?\n\n' +
                  'Le Token (session) et le QueryID seront retirés. Tes trades importés ne sont pas affectés.'
              );
              if (!ok) return;
              clearFlexCredentials();
              setToken('');
              setQueryId('');
              setHasCreds(false);
              showToast.success('Identifiants Flex effacés');
            }}
          >
            Effacer identifiants
          </button>
        )}
        <button
          type="button"
          className="pg-mock-btn pg-mock-btn--primary"
          disabled={!canSync}
          onClick={handleSync}
        >
          {syncing ? 'Synchronisation…' : 'Synchroniser'}
        </button>
      </div>
    </section>
  );
}

function CsvUploadSection({ onResult }) {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const journalEntries = useJournalEntries();
  const settings = useSettings();
  const dispatch = useDispatch();
  const metrics = usePortfolioMetrics();
  const capitalUsd = metrics?.netLiquidationValueUsd ?? null;
  const state = { openPositions, closedTrades, cashFlows, journalEntries, settings };
  const showToast = useToast();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    setParsing(true);
    try {
      const text = await file.text();
      const parsed = parseIbkrCsv(text);
      const result = mergeIbkrData(parsed, state, { metaBySignature: readAllPositionMeta() });
      // Addendum 2 n°1 — même horodatage de provenance des pc que le Flex.
      dispatch({ type: 'IMPORT_DATA', payload: { ...result.mergedData, pcSyncedAt: new Date().toISOString() } });
      const s = result.stats || {};
      // É3.1 — provenance persistée (l'import CSV n'écrivait RIEN dans
      // lastSync) : le marqueur de mode StatusBar affiche CSV, pas REAL.
      dispatch({
        type: 'IMPORT_DATA',
        payload: {
          settings: {
            lastSync: {
              date: new Date().toISOString(),
              source: 'csv',
              file: file.name,
              positions: result.mergedData.openPositions?.length || 0,
              trades: result.mergedData.closedTrades?.length || 0,
              mouvements: s.cashFlowsAdded || 0,
              stats: s,
            },
          },
        },
      });
      onResult(buildImportOutcome(result, `CSV · ${file.name}`, capitalUsd));
      showToast.success('CSV importé', {
        detail: `${s.closedTradesAdded || 0} trades · ${s.positionsAdded || 0} positions · ${s.cashFlowsAdded || 0} mouvements`,
      });
    } catch (e) {
      showToast.error('Import CSV échoué', { detail: e?.message || String(e), duration: 6000 });
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

  return (
    <section className="import-page__panel import-source">
      <header className="import-page__panel-head">
        <div className="import-page__panel-icon">
          <Upload size={16} aria-hidden="true" />
        </div>
        <div>
          <h2 className="import-page__panel-title">Fichier CSV</h2>
          <p className="import-page__panel-desc">
            Glisser-déposer un relevé Flex Query CSV, ou cliquer pour parcourir.
          </p>
        </div>
      </header>

      <div
        className="import-page__dropzone"
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
        <Upload size={26} aria-hidden="true" />
        <div className="import-page__dropzone-title">
          {parsing ? 'Analyse en cours…' : 'Déposez un CSV ici'}
        </div>
        <div className="import-page__dropzone-sub">
          ou cliquez pour parcourir · format Flex Query IBKR (.csv)
        </div>
      </div>
    </section>
  );
}

function labelInstrument(v) {
  const strike = v.st ? ` $${v.st}` : '';
  const type = v.ty || (v.st ? 'OPT' : 'STK');
  return `${v.tk} ${type}${strike}`.trim();
}

function ResultStage({ lastResult }) {
  const total = lastResult
    ? lastResult.positions + lastResult.trades + lastResult.cashFlows
    : 0;
  const report = lastResult?.report;
  const violations = report?.violations || [];
  const ignored = report?.ignored || [];
  const dupes =
    (report?.positions?.duplicatesSkipped || 0) +
    (report?.closedTrades?.duplicatesSkipped || 0) +
    (report?.cashFlows?.duplicatesSkipped || 0);
  return (
    <section className="import-page__panel">
      <header className="import-page__panel-head">
        <div className="import-page__panel-icon import-page__panel-icon--neutral">
          <CheckCircle2 size={16} aria-hidden="true" />
        </div>
        <div>
          <h2 className="import-page__panel-title">Résultat</h2>
          <p className="import-page__panel-desc">
            Le merge est <strong>additif</strong> — il ne remplace ni n&apos;efface jamais tes
            données existantes. Rien n&apos;est ignoré en silence : le rapport ci-dessous dit
            ce qui a été lu, créé, dédupliqué, ignoré, et les écarts de doctrine marqués.
          </p>
        </div>
      </header>
      {lastResult ? (
        <div className="import-result">
          <div className="import-result__head">
            <CheckCircle2 size={14} aria-hidden="true" style={{ color: 'var(--pnl-up)' }} />
            <span className="import-result__source">{lastResult.source}</span>
            <span className="import-result__none">
              {total === 0 ? 'aucune nouvelle donnée (déjà à jour)' : `${total} ligne${total > 1 ? 's' : ''} ajoutée${total > 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="import-result__grid">
            <div className="import-result__cell">
              <span className="import-result__n mono">{lastResult.positions}</span>
              <span className="import-result__k">positions</span>
            </div>
            <div className="import-result__cell">
              <span className="import-result__n mono">{lastResult.trades}</span>
              <span className="import-result__k">trades clôturés</span>
            </div>
            <div className="import-result__cell">
              <span className="import-result__n mono">{lastResult.cashFlows}</span>
              <span className="import-result__k">mouvements</span>
            </div>
          </div>

          {report && (
            <div className="import-report__meta">
              <span>{report.linesRead ?? 0} lignes lues</span>
              <span aria-hidden="true">·</span>
              <span>{dupes} doublon{dupes > 1 ? 's' : ''} dédupliqué{dupes > 1 ? 's' : ''}</span>
              <span aria-hidden="true">·</span>
              <span>{report.lotsMerged ?? 0} lot moyenné (l&apos;import ne moyenne pas)</span>
            </div>
          )}

          {violations.length > 0 && (
            <div className="import-report__section">
              <div className="import-report__section-title">
                Écarts de doctrine marqués — enregistrés, <strong>jamais bloqués</strong>
              </div>
              <ul className="import-report__viol-list">
                {violations.map((v, i) => (
                  <li key={i} className="import-report__viol-row">
                    <span className="import-report__viol-instr">{labelInstrument(v)}</span>
                    <span className="import-report__viol-chips">
                      {v.items.map((it) => (
                        <span
                          key={it.code}
                          className="db-badge db-badge--arme import-report__viol-chip"
                          title={it.message}
                        >
                          {it.code} · {it.label}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ignored.length > 0 && (
            <div className="import-report__section">
              <div className="import-report__section-title">Lignes ignorées — avec le motif</div>
              <ul className="import-report__ignored-list">
                {ignored.map((row, i) => (
                  <li key={i} className="import-report__ignored-row">
                    <span className="import-report__ignored-n mono">{row.count}</span>
                    <span className="import-report__ignored-why">{row.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="import-empty">
          <div className="import-empty__title">Aucun import cette session</div>
          <div className="import-empty__sub">
            Synchronise via Flex ou dépose un CSV ci-dessus — le rapport (lignes lues, créées,
            dédupliquées, ignorées, écarts marqués) s&apos;affichera ici.
          </div>
        </div>
      )}
    </section>
  );
}

function BackupStage() {
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const cashFlows = useCashFlows();
  const journalEntries = useJournalEntries();
  const settings = useSettings();
  const dispatch = useDispatch();
  const showToast = useToast();
  const jsonInputRef = useRef(null);

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      openPositions,
      closedTrades,
      cashFlows,
      journalEntries,
      settings,
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
      const ok = window.confirm(
        'Restaurer ce backup ?\n\n' +
          `${payload.closedTrades?.length || 0} trades · ${payload.openPositions?.length || 0} positions · ${payload.journalEntries?.length || 0} entrées journal seront fusionnés (merge additif, aucun écrasement).`
      );
      if (!ok) return;
      dispatch({ type: 'IMPORT_DATA', payload });
      showToast.success('Backup JSON restauré', {
        detail: `${payload.closedTrades?.length || 0} trades · ${payload.openPositions?.length || 0} positions · ${payload.journalEntries?.length || 0} entrées journal`,
      });
    } catch (e) {
      showToast.error('Restauration échouée', { detail: e?.message || String(e), duration: 6000 });
    }
  };

  return (
    <section className="import-page__panel">
      <header className="import-page__panel-head">
        <div className="import-page__panel-icon import-page__panel-icon--neutral">
          <RotateCcw size={16} aria-hidden="true" />
        </div>
        <div>
          <h2 className="import-page__panel-title">Sauvegarde</h2>
          <p className="import-page__panel-desc">
            Exporte tout ton portefeuille en JSON, ou restaure un backup. La restauration annonce
            ce qu&apos;elle fera avant de le faire.
          </p>
        </div>
      </header>
      <div className="import-page__actions import-page__actions--start">
        <button type="button" className="pg-mock-btn" onClick={handleExport}>
          <Download size={12} aria-hidden="true" /> Export JSON
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
          <Upload size={12} aria-hidden="true" /> Restaurer un backup
        </button>
      </div>
    </section>
  );
}

export default function SettingsImport() {
  const reducedMotion = useReducedMotion();
  const openPositions = useOpenPositions();
  const closedTrades = useClosedTrades();
  const settings = useSettings();
  const [lastResult, setLastResult] = useState(null);

  const saved = getFlexConfig();
  const flexConfigured = Boolean(saved.queryId);
  const lastSyncLabel = formatLastSync(settings?.lastSync);

  return (
    <motion.div
      className="page-container import-page"
      variants={reducedMotion ? undefined : RISE_CONTAINER_VARIANTS}
      initial={reducedMotion ? undefined : 'hidden'}
      animate={reducedMotion ? undefined : 'visible'}
    >
      <motion.div variants={RISE_TILE_VARIANTS} className="page-header">
        <div>
          <h1 className="page-title">
            <FileIcon size={18} aria-hidden="true" />
            Import &amp; Sauvegarde
          </h1>
          <p className="page-subtitle">
            Deux portes d&apos;entrée — Flex IBKR ou CSV · export / restauration JSON.
          </p>
        </div>
      </motion.div>

      {/* 1. BANDEAU — signes vitaux servis. */}
      <motion.section variants={RISE_TILE_VARIANTS} className="lh-final import-command">
        <div className="import-command__grid">
          {/* É3.1 — la méta dit la VRAIE source du dernier import (le CSV
              écrit désormais lastSync.source, plus jamais « Flex IBKR »
              par défaut). Bridge (lastSync = string) → « bridge IBKR ». */}
          <Cell
            label="Dernière synchro"
            value={lastSyncLabel || '——'}
            meta={
              !lastSyncLabel
                ? 'aucune encore'
                : settings?.lastSync?.source === 'csv'
                  ? `CSV local${settings.lastSync.file ? ` · ${settings.lastSync.file}` : ''}`
                  : typeof settings?.lastSync === 'string'
                    ? 'bridge IBKR'
                    : 'Flex IBKR'
            }
          />
          <Cell
            label="Trades en base"
            value={String(closedTrades.length)}
            meta="clôturés cumulés"
          />
          <Cell
            label="Positions"
            value={String(openPositions.length)}
            meta="ouvertes"
          />
          <Cell
            label="Config Flex"
            value={flexConfigured ? 'PRÊTE' : 'À FAIRE'}
            meta={flexConfigured ? `QueryID ${saved.queryId}` : 'QueryID non enregistré'}
            tone={flexConfigured ? undefined : 'mute'}
          />
        </div>
      </motion.section>

      {/* 2. ÉTAGE SOURCES — deux portes équivalentes. */}
      <motion.div variants={RISE_TILE_VARIANTS} className="import-sources">
        <FlexSection onResult={setLastResult} />
        <CsvUploadSection onResult={setLastResult} />
      </motion.div>

      {/* 3. ÉTAGE RÉSULTAT. */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <ResultStage lastResult={lastResult} />
      </motion.div>

      {/* 4. ÉTAGE SAUVEGARDE. */}
      <motion.div variants={RISE_TILE_VARIANTS}>
        <BackupStage />
      </motion.div>
    </motion.div>
  );
}
