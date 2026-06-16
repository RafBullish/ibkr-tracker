// ═══════════════════════════════════════════════════════════════
//  WATCHLIST — module Dashboard (row 4, col 1-6)
//
//  U6 : liste de tickers persistée (slice store `watchlist`) + quote
//  live par ticker (prix + variation jour) via useWatchlist →
//  useMarketQuotes (/api/quote, même chemin que PreMarketBriefing).
//  Ajout (input header) + suppression (bouton par ligne) → dispatch
//  ADD_TICKER / REMOVE_TICKER. Colonnes limitées aux données réelles
//  fournies par /api/quote (Ticker · Last · Chg %) — pas de colonne
//  fantôme (Vol/IV/IVR/Spark retirées faute de source). Prix/variation
//  `—` tant que la quote n'est pas revenue, jamais un faux 0.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useDispatch } from '../../store/useStore';

const fmtPctSigned = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v === 0) return '0.00 %';
  const sign = v > 0 ? '+' : '−';
  return `${sign}${Math.abs(v).toFixed(digits)} %`;
};

const fmtNum = (v, digits = 2) => {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
};

const toneFromSign = (v) => {
  if (v == null || !Number.isFinite(v) || v === 0) return 'mute';
  return v > 0 ? 'profit' : 'loss';
};

export default function Watchlist({ data, area = 'watch' }) {
  const rows = Array.isArray(data) ? data : [];
  const isEmpty = rows.length === 0;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [input, setInput] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    const tk = input.trim().toUpperCase();
    if (!tk) return;
    dispatch({ type: 'ADD_TICKER', payload: tk });
    setInput('');
  };

  const handleRemove = (e, tk) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_TICKER', payload: tk });
  };

  return (
    <section className="module watchlist" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Watchlist · {rows.length}</span>
        <form className="watchlist__add" onSubmit={handleAdd}>
          <input
            className="watchlist__add-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ticker"
            aria-label="Ajouter un ticker à la watchlist"
            maxLength={8}
          />
          <button type="submit" className="watchlist__add-btn" title="Ajouter un ticker">
            + Add
          </button>
        </form>
      </header>
      <div className="module-body watchlist__body">
        {isEmpty ? (
          <div className="watchlist__empty module-empty">
            <span className="module-empty__title">Watchlist vide</span>
            <span className="module-empty__sub">
              Ajoute un ticker ci-dessus pour suivre son cours en direct.
            </span>
          </div>
        ) : (
          <table className="watchlist__table" aria-label="Watchlist">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Last</th>
                <th>Chg %</th>
                <th aria-label="Retirer" />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.tk}
                  className="watchlist__row"
                  onClick={() => navigate('/trading/chain')}
                  title={`${t.tk} · ouvrir la chaîne options`}
                >
                  <td className="watchlist__ticker">{t.tk}</td>
                  <td>{fmtNum(t.last, 2)}</td>
                  <td className={`live-pos__cell--${toneFromSign(t.chgPct)}`}>
                    {fmtPctSigned(t.chgPct)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="watchlist__remove-btn"
                      onClick={(e) => handleRemove(e, t.tk)}
                      aria-label={`Retirer ${t.tk} de la watchlist`}
                      title="Retirer"
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
