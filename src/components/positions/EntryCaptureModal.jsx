// ═══════════════════════════════════════════════════════════════
//  CAPTURE À L'ENTRÉE — formulaire autonome « j'ai pris une position »
//
//  Le moment manquant : entre l'exécution chez IBKR et l'import du Flex,
//  Rafael n'a nulle part où déposer ce qu'il sait (mid, bid/ask, θ, δ,
//  earnings, thèse). Ce formulaire écrit dans le SIDECAR `positionMeta`
//  keyé par SIGNATURE (tk|as|dir|ty|st|ex) — il NE CRÉE AUCUNE position
//  (l'import reste le seul créateur). Conséquence élégante : quand le Flex
//  arrive des jours plus tard, la position apparaît et le sidecar se
//  réhydrate dessus tout seul (merge.js, clé = signature).
//
//  E2 (θ/mid) et E4 (spread/mid) se calculent sur ces valeurs d'ENTRÉE.
//  δ = INDICATIF (affiché, jamais jugé — la carte V3 le déclare tel).
//  Rien n'est bloquant : une capture partielle ne renseigne que ce qu'elle
//  porte, le reste reste indéterminé (jamais présumé conforme).
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import Modal from '../ui/Modal';
import { positionSignature } from '../../utils/positions';
import { writePositionMeta } from '../../utils/positionMeta';

const posNum = (s) => {
  const n = parseFloat(s);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const sigNum = (s) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};

export default function EntryCaptureModal({ open, onClose }) {
  // Identité du contrat (le book Sniper est du long premium sur options).
  const [tk, setTk] = useState('');
  const [ty, setTy] = useState('CALL');
  const [dir, setDir] = useState('Long');
  const [st, setSt] = useState('');
  const [ex, setEx] = useState('');
  // Données d'entrée.
  const [mid, setMid] = useState('');
  const [theta, setTheta] = useState('');
  const [bid, setBid] = useState('');
  const [ask, setAsk] = useState('');
  const [delta, setDelta] = useState('');
  // Carte V3 (déjà côté sidecar depuis Q-B).
  const [earningsDate, setEarningsDate] = useState('');
  const [earningsNone, setEarningsNone] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(null);

  // Validité = identité du contrat suffisante pour une signature STABLE
  // (celle que l'import recalculera). Les données d'entrée sont optionnelles.
  const valid = !!tk.trim() && parseFloat(st) > 0 && !!ex;

  const reset = () => {
    setTk('');
    setTy('CALL');
    setDir('Long');
    setSt('');
    setEx('');
    setMid('');
    setTheta('');
    setBid('');
    setAsk('');
    setDelta('');
    setEarningsDate('');
    setEarningsNone(false);
    setNote('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!valid) return;
    // Strike normalisé comme le reducer (String(parseFloat)) → la signature
    // matche celle que l'import produira pour le même contrat.
    const stNorm = String(parseFloat(st));
    const sig = positionSignature({
      tk: tk.trim().toUpperCase(),
      as: 'Option',
      dir,
      ty,
      st: stNorm,
      ex,
    });
    const finalEarnings = earningsNone ? 'AUCUN' : earningsDate || null;
    writePositionMeta(
      sig,
      {
        earningsDate: finalEarnings,
        entryNote: note.trim() ? note.trim() : null,
        midAtEntry: posNum(mid),
        bidAtEntry: posNum(bid),
        askAtEntry: posNum(ask),
        thetaAtEntryPerDay: sigNum(theta),
        deltaAtEntry: sigNum(delta),
      },
      new Date().toISOString()
    );
    setSaved({ tk: tk.trim().toUpperCase(), ty, st: stNorm, ex });
    reset();
  };

  return (
    <Modal open={open} onClose={onClose} title="J’ai pris une position — capture à l’entrée">
      <form className="add-trade-form" onSubmit={handleSubmit}>
        <p className="position-detail__form-hint">
          Dépose l’identité du contrat + tes chiffres d’entrée. <strong>Aucune
          position n’est créée</strong> — c’est un sidecar. À ton prochain import
          Flex, la position apparaîtra et cette saisie se réhydratera dessus toute
          seule (clé = signature du contrat).
        </p>

        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Ticker</span>
            <input
              type="text"
              value={tk}
              onChange={(e) => setTk(e.target.value)}
              placeholder="AAPL"
              autoFocus
            />
          </label>
          <label>
            <span className="uppercase-label">Type</span>
            <div className="add-trade-form__toggle">
              <button type="button" data-active={ty === 'CALL' || undefined} onClick={() => setTy('CALL')}>
                CALL
              </button>
              <button type="button" data-active={ty === 'PUT' || undefined} onClick={() => setTy('PUT')}>
                PUT
              </button>
            </div>
          </label>
          <label>
            <span className="uppercase-label">Sens</span>
            <div className="add-trade-form__toggle">
              <button type="button" data-active={dir === 'Long' || undefined} onClick={() => setDir('Long')}>
                Long
              </button>
              <button type="button" data-active={dir === 'Short' || undefined} onClick={() => setDir('Short')}>
                Short
              </button>
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Strike</span>
            <input type="number" step="0.01" min="0" value={st} onChange={(e) => setSt(e.target.value)} placeholder="200" />
          </label>
          <label>
            <span className="uppercase-label">Échéance</span>
            <input type="date" value={ex} onChange={(e) => setEx(e.target.value)} />
          </label>
        </div>

        <p className="position-detail__form-hint">
          Données d’entrée — débloquent E2 (θ / mid) et E4 (spread / mid), calculées
          sur ces valeurs d’ENTRÉE. δ = indicatif, jamais jugé.
        </p>
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Mid d’entrée</span>
            <input type="number" step="0.01" min="0" value={mid} onChange={(e) => setMid(e.target.value)} placeholder="prime mid" />
          </label>
          <label>
            <span className="uppercase-label">θ / jour (entrée)</span>
            <input type="number" step="0.001" value={theta} onChange={(e) => setTheta(e.target.value)} placeholder="ex. −0.02" />
          </label>
        </div>
        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Bid d’entrée</span>
            <input type="number" step="0.01" min="0" value={bid} onChange={(e) => setBid(e.target.value)} />
          </label>
          <label>
            <span className="uppercase-label">Ask d’entrée</span>
            <input type="number" step="0.01" min="0" value={ask} onChange={(e) => setAsk(e.target.value)} />
          </label>
          <label>
            <span className="uppercase-label">δ d’entrée (indicatif)</span>
            <input type="number" step="0.01" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="ex. 0.30" />
          </label>
        </div>

        <div className="add-trade-form__row">
          <label>
            <span className="uppercase-label">Date de résultats (P4)</span>
            <input type="date" value={earningsDate} disabled={earningsNone} onChange={(e) => setEarningsDate(e.target.value)} />
          </label>
          <label>
            <span className="uppercase-label">Résultats</span>
            <div className="add-trade-form__toggle">
              <button type="button" data-active={!earningsNone || undefined} onClick={() => setEarningsNone(false)}>
                Date
              </button>
              <button type="button" data-active={earningsNone || undefined} onClick={() => setEarningsNone(true)}>
                AUCUN
              </button>
            </div>
          </label>
        </div>
        <div className="add-trade-form__row">
          <label className="add-trade-form__full">
            <span className="uppercase-label">Note d’entrée (optionnelle)</span>
            <textarea
              className="add-trade-form__textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="thèse, contexte… — jamais bloquant"
            />
          </label>
        </div>

        {saved && (
          <p className="entry-capture__saved">
            ✓ Capturé : <strong>{saved.tk} {saved.ty} ${saved.st} {saved.ex}</strong> — se
            réhydratera sur la position à l’import. Tu peux en saisir une autre ou fermer.
          </p>
        )}

        <div className="add-trade-form__footer">
          <button type="button" className="pg-mock-btn" onClick={onClose}>
            Fermer
          </button>
          <button type="submit" className="pg-mock-btn pg-mock-btn--primary" disabled={!valid}>
            Capturer
          </button>
        </div>
      </form>
    </Modal>
  );
}
