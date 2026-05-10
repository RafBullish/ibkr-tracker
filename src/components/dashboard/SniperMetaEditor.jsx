// ═══════════════════════════════════════════════════════════════
//  SNIPER META EDITOR v5 Sprint 2.2 — modal tagging
//
//  Modal Radix-Dialog accessible depuis chaque ligne du module
//  LivePositions. Permet à l'utilisateur de tagger manuellement
//  les trois métadonnées Sniper d'une position :
//
//    edgeTier    : E0..E4   (auto-derivable depuis ivRankAtEntry,
//                            mais l'override manuel a priorité)
//    capitalTier : C1..C5   (toujours manuel — pas de signal auto)
//    betaSPY     : float    (saisie libre, fetch Yahoo en Sprint 4)
//
//  Save flow :
//    1. writeSniperMeta(positionId, patch) merge dans le sidecar
//       qc:sniperMeta:{positionId}
//    2. dispatch d'un CustomEvent('qc:sniperMeta:change') sur window
//       que useLivePositions écoute pour bumper son re-render key
//    3. modal close + parent state reset
//
//  La modal est pure UI : tout l'état du sidecar transite par
//  src/utils/sniperMeta.js (single source of truth).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import Modal from '../ui/Modal';
import { readSniperMeta, writeSniperMeta } from '../../utils/sniperMeta';

const EDGE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'E0', label: 'E0 · IVR < 25 (faible edge)' },
  { value: 'E1', label: 'E1 · IVR 25–40' },
  { value: 'E2', label: 'E2 · IVR 40–55' },
  { value: 'E3', label: 'E3 · IVR 55–70' },
  { value: 'E4', label: 'E4 · IVR ≥ 70 (premium-rich)' },
];

const CAP_OPTIONS = [
  { value: '', label: '—' },
  { value: 'C1', label: 'C1 · 0–10 % NLV (test)' },
  { value: 'C2', label: 'C2 · 10–25 % NLV' },
  { value: 'C3', label: 'C3 · 25–50 % NLV (standard)' },
  { value: 'C4', label: 'C4 · 50–75 % NLV (full size)' },
  { value: 'C5', label: 'C5 · 75–100 % NLV (max conviction)' },
];

// Inner form keyed by position.id so React unmounts/remounts when the
// user clicks a different position — initial state is derived from
// the sidecar synchronously in useState initializer (no effect needed).
function SniperMetaForm({ position, onClose }) {
  const initial = readSniperMeta(position.id) || {};
  const [edgeTier, setEdgeTier] = useState(initial.edgeTier || '');
  const [capitalTier, setCapitalTier] = useState(initial.capitalTier || '');
  const [betaSPY, setBetaSPY] = useState(
    initial.betaSPY != null && Number.isFinite(initial.betaSPY) ? String(initial.betaSPY) : ''
  );
  const [error, setError] = useState(null);

  const handleSave = (e) => {
    e?.preventDefault();
    setError(null);

    const patch = {
      edgeTier: edgeTier || null,
      capitalTier: capitalTier || null,
    };

    if (betaSPY.trim() !== '') {
      const num = parseFloat(betaSPY);
      if (!Number.isFinite(num)) {
        setError('β-SPY doit être un nombre valide (ex : 1.18)');
        return;
      }
      patch.betaSPY = num;
    } else {
      patch.betaSPY = null;
    }

    writeSniperMeta(position.id, patch);
    // Notify any consumer (useLivePositions, RiskMatrix soon) that the
    // sidecar changed so they re-derive their rows.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('qc:sniperMeta:change', { detail: { id: position.id } })
      );
    }
    onClose?.();
  };

  return (
    <form className="sniper-meta-editor" onSubmit={handleSave}>
      <div className="sniper-meta-editor__hint">
        {position.type !== 'STK' ? (
          <>
            {position.type} · {position.strike ? `$${position.strike}` : '—'} ·{' '}
            {position.dte != null ? `DTE ${position.dte}d` : ''} ·{' '}
            <span
              className={`sniper-meta-editor__pnl sniper-meta-editor__pnl--${
                position.unrealDollar > 0 ? 'profit' : position.unrealDollar < 0 ? 'loss' : 'mute'
              }`}
            >
              {position.unrealDollar != null
                ? `${position.unrealDollar > 0 ? '+' : '−'}$${Math.abs(position.unrealDollar).toFixed(2)}`
                : '—'}
            </span>
          </>
        ) : (
          <>Action · qty {position.qty}</>
        )}
      </div>

      <label className="sniper-meta-editor__field">
        <span className="sniper-meta-editor__label">Edge Tier</span>
        <select
          className="sniper-meta-editor__input"
          value={edgeTier}
          onChange={(e) => setEdgeTier(e.target.value)}
        >
          {EDGE_OPTIONS.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="sniper-meta-editor__hint-sub">
          Auto-dérivé depuis IV Rank si laissé vide.
        </span>
      </label>

      <label className="sniper-meta-editor__field">
        <span className="sniper-meta-editor__label">Capital Tier</span>
        <select
          className="sniper-meta-editor__input"
          value={capitalTier}
          onChange={(e) => setCapitalTier(e.target.value)}
        >
          {CAP_OPTIONS.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="sniper-meta-editor__hint-sub">
          Saisie manuelle obligatoire — aucun signal auto disponible.
        </span>
      </label>

      <label className="sniper-meta-editor__field">
        <span className="sniper-meta-editor__label">β-SPY</span>
        <input
          className="sniper-meta-editor__input sniper-meta-editor__input--num"
          type="text"
          inputMode="decimal"
          placeholder="1.18"
          value={betaSPY}
          onChange={(e) => setBetaSPY(e.target.value)}
        />
        <span className="sniper-meta-editor__hint-sub">
          Beta vs SPY pour Δ-weighting. Auto-fetch Yahoo prévu Sprint 4.
        </span>
      </label>

      {error ? <div className="sniper-meta-editor__error">{error}</div> : null}

      <div className="sniper-meta-editor__actions">
        <button
          type="button"
          className="sniper-meta-editor__btn sniper-meta-editor__btn--ghost"
          onClick={onClose}
        >
          Annuler
        </button>
        <button type="submit" className="sniper-meta-editor__btn sniper-meta-editor__btn--primary">
          Enregistrer
        </button>
      </div>
    </form>
  );
}

export default function SniperMetaEditor({ position, open, onClose }) {
  if (!position) return null;
  const title = `Tag Sniper · ${position.ticker || position.id}`;
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {/* key forces a fresh mount per position so initial state from
          useState-with-initializer reflects the right sidecar entry */}
      <SniperMetaForm key={position.id} position={position} onClose={onClose} />
    </Modal>
  );
}
