// ═══════════════════════════════════════════════════════════════
//  ADD TRADE MODAL — shared across History + Chain (P6-18)
//
//  Extracted from pages/trading/History.jsx so /trading/chain can
//  reuse the same form when a user clicks an option row to preset a
//  trade plan. Accepts an optional `preset` prop (partial trade
//  data) merged into initial state on open — each open call lives
//  its own lifecycle via the `key` pattern recommended by React for
//  form resets.
//
//  Shape of preset :
//    {
//      tk?: string,        // ticker
//      as?: 'Option' | 'Action',
//      ty?: 'CALL' | 'PUT',
//      dir?: 'Long' | 'Short',
//      st?: string,        // strike
//      ex?: string,        // expiry YYYY-MM-DD
//      pi?: string,        // price in (entry) — chain preset uses mid
//      ct?: string,        // quantity
//    }
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { todayDateString } from '../../utils/dates';
import Modal from '../ui/Modal';

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

// Q-B — portes de sortie carte V3 (libellés d'UI, pas des nombres normatifs).
// Deux des 5 champs de clôture obligatoires (registre app).
const PORTES_OPTIONS = [
  { v: '', l: '— non renseignée' },
  { v: 'P1_SL', l: 'P1 · Stop-loss' },
  { v: 'P2_TRAIL', l: 'P2 · Trailing' },
  { v: 'P3_DTE', l: 'P3 · DTE' },
  { v: 'P4_EARNINGS', l: 'P4 · Earnings' },
  { v: 'P5_STAGNATION', l: 'P5 · Stagnation' },
  { v: 'AUCUNE', l: 'Aucune (sortie discrétionnaire)' },
  { v: 'MANUELLE', l: 'Manuelle / autre' },
];

export default function AddTradeModal({
  open,
  onClose,
  onSave,
  preset = {},
  title = 'Ajouter un trade manuel',
}) {
  const [assetType, setAssetType] = useState(preset.as || 'Option');
  const [optType, setOptType] = useState(preset.ty || 'CALL');
  const [dir, setDir] = useState(preset.dir || 'Long');
  const [tk, setTk] = useState(preset.tk || '');
  const [strike, setStrike] = useState(preset.st || '');
  const [expiry, setExpiry] = useState(preset.ex || '');
  const [qty, setQty] = useState(preset.ct || '1');
  const [pi, setPi] = useState(preset.pi || '');
  const [po, setPo] = useState('');
  const [di, setDi] = useState(todayDateString());
  const [dout, setDout] = useState(todayDateString());
  const [note, setNote] = useState('');
  const [tag, setTag] = useState(preset.tag || '');
  // Q-B — journal de clôture carte V3 (optionnel, jamais bloquant).
  const [porteDeclenchee, setPorteDeclenchee] = useState('');
  const [porteRespectee, setPorteRespectee] = useState('');

  const isOpt = assetType === 'Option';
  const mul = isOpt ? 100 : 1;

  const reset = () => {
    setTk(preset.tk || '');
    setStrike(preset.st || '');
    setExpiry(preset.ex || '');
    setQty(preset.ct || '1');
    setPi(preset.pi || '');
    setPo('');
    setDi(todayDateString());
    setDout(todayDateString());
    setNote('');
    setAssetType(preset.as || 'Option');
    setOptType(preset.ty || 'CALL');
    setDir(preset.dir || 'Long');
    setTag(preset.tag || '');
    setPorteDeclenchee('');
    setPorteRespectee('');
  };

  const handleSave = () => {
    if (!tk.trim() || !pi || !po) return;
    const trade = {
      tk: tk.trim().toUpperCase(),
      as: isOpt ? 'Option' : 'Action',
      ty: isOpt ? optType : null,
      dir,
      st: isOpt ? strike : null,
      ex: isOpt ? expiry : null,
      ct: qty || '1',
      mu: String(mul),
      pi,
      po,
      di,
      do: dout,
      fi: '0',
      fo: '0',
      fxi: '0.88',
      fxo: '0.88',
      note: note || null,
      tag: tag || null,
      src: 'manual',
      // Q-B — 5 champs de clôture (prix_entree=pi, prix_sortie=po déjà là).
      // picAtteint vide tant que le writer qc:positionMarks (Q-C) n'existe pas.
      picAtteint: null,
      porteDeclenchee: porteDeclenchee || null,
      porteRespectee: porteRespectee || null,
    };
    onSave(trade);
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="add-trade-form">
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Actif</span>
            <div className="add-trade-form__toggle">
              <button
                type="button"
                data-active={assetType === 'Option' || undefined}
                onClick={() => setAssetType('Option')}
              >
                Option
              </button>
              <button
                type="button"
                data-active={assetType === 'Action' || undefined}
                onClick={() => setAssetType('Action')}
              >
                Action
              </button>
            </div>
          </label>
          {isOpt && (
            <label>
              <span className="uppercase-label">Type</span>
              <div className="add-trade-form__toggle">
                <button
                  type="button"
                  data-active={optType === 'CALL' || undefined}
                  onClick={() => setOptType('CALL')}
                >
                  CALL
                </button>
                <button
                  type="button"
                  data-active={optType === 'PUT' || undefined}
                  onClick={() => setOptType('PUT')}
                >
                  PUT
                </button>
              </div>
            </label>
          )}
          <label>
            <span className="uppercase-label">Direction</span>
            <div className="add-trade-form__toggle">
              <button
                type="button"
                data-active={dir === 'Long' || undefined}
                onClick={() => setDir('Long')}
              >
                Long
              </button>
              <button
                type="button"
                data-active={dir === 'Short' || undefined}
                onClick={() => setDir('Short')}
              >
                Short
              </button>
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Ticker</span>
            <input value={tk} onChange={(e) => setTk(e.target.value)} placeholder="NVDA" />
          </label>
          <label>
            <span className="uppercase-label">Qty</span>
            <input value={qty} onChange={(e) => setQty(e.target.value)} />
          </label>
          {isOpt && (
            <label>
              <span className="uppercase-label">Strike</span>
              <input value={strike} onChange={(e) => setStrike(e.target.value)} placeholder="580" />
            </label>
          )}
          {isOpt && (
            <label>
              <span className="uppercase-label">Expiry</span>
              <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
            </label>
          )}
        </div>
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Prix Entry</span>
            <input value={pi} onChange={(e) => setPi(e.target.value)} placeholder="8.50" />
          </label>
          <label>
            <span className="uppercase-label">Prix Exit</span>
            <input value={po} onChange={(e) => setPo(e.target.value)} placeholder="11.20" />
          </label>
          <label>
            <span className="uppercase-label">Date Entry</span>
            <input type="date" value={di} onChange={(e) => setDi(e.target.value)} />
          </label>
          <label>
            <span className="uppercase-label">Date Exit</span>
            <input type="date" value={dout} onChange={(e) => setDout(e.target.value)} />
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Tag</span>
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
          <label>
            <span className="uppercase-label">Porte déclenchée</span>
            <select
              className="add-trade-form__select"
              value={porteDeclenchee}
              onChange={(e) => setPorteDeclenchee(e.target.value)}
            >
              {PORTES_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="uppercase-label">Porte respectée</span>
            <select
              className="add-trade-form__select"
              value={porteRespectee}
              onChange={(e) => setPorteRespectee(e.target.value)}
            >
              <option value="">— non renseignée</option>
              <option value="OUI">Oui</option>
              <option value="NON">Non</option>
              <option value="NA">N/A</option>
            </select>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label style={{ flex: 1 }}>
            <span className="uppercase-label">Note</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Observations, psychology, screenshot link…"
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
