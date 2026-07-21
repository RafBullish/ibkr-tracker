// ═══════════════════════════════════════════════════════════════
//  HÉROS 2 (1.E) — parts : frontière · géant réalisé (overlay) · toggle
//  CUMULÉ/QUOTIDIEN · footer référence. Même DA que Héros 1 (Plex
//  chiffres, mono labels, hairlines, encre neutre, $ blancs + CHF live).
//  Réutilise les classes .lh-* de Héros 1 pour l'identité de jumeau.
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtChf, fmtPct } from '../hero1/kit';

const toneOf = (v) => (v == null || v === 0 ? 'mute' : v > 0 ? 'profit' : 'loss');
const isSigned = (s) => typeof s === 'string' && (s[0] === '+' || s[0] === '−' || s[0] === '-');

// Frontière — jumeau de Héros 1, contexte réalisé.
export function RealizedFrontier() {
  return (
    <div className="lh-frontier">
      <span className="lh-frontier__zone">RÉALISÉ</span>
      <span className="lh-frontier__rule" aria-hidden="true" />
      <span className="lh-frontier__ctx">clôtures · argent encaissé · Héros 1 = latent ↑</span>
    </div>
  );
}

// Toggle de vue du graphe (jumeau de ViewToggle NLV/Drawdown de Héros 1).
export function ViewToggleRealized({ view, setView }) {
  return (
    <div className="lh-toggle" role="tablist" aria-label="Vue cumulée ou quotidienne">
      {[['cumul', 'CUMULÉ'], ['daily', 'QUOTIDIEN']].map(([k, lbl]) => (
        <button key={k} type="button" role="tab" className="lh-toggle__btn" data-active={view === k || undefined} aria-pressed={view === k} onClick={() => setView(k)}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

// GÉANT RÉALISÉ CUMULÉ (overlay du graphe) — jumeau du héros NLV, sans
// témoin LIVE (chip période neutre). Teinte par signe = argent réel.
export function RealizedGiant({ total, rate, count, span }) {
  const tone = toneOf(total);
  const chf = fmtChf(total, rate);
  return (
    <div className="lh-hero lh-hero--lg">
      <div className="lh-hero__head">
        <span className="lh-hero__label">RÉALISÉ CUMULÉ</span>
      </div>
      <div className="lh-hero__row">
        <span className={`lh-hero__usd h2-giant--${tone}`}>{total == null ? '—' : fmtUsdSigned(total)}</span>
        {count != null ? (
          <span className="lh-hero__pill lh-hero__pill--mute">{count} clôt.<span className="lh-hero__pill-cap"> · {span} j</span></span>
        ) : null}
      </div>
      {chf ? <span className="lh-hero__chf">{chf}</span> : null}
    </div>
  );
}

// FOOTER référence — DÉDUPLIQUÉ : le deck porte matrice/extrêmes/rythme
// (niveau trade). Le footer porte le DÉTAIL JOUR + DISTRIBUTION (niveau
// jour) : aucune métrique répétée. Blanc, agrandi, double devise.
export function RealizedFooter({ m, rate }) {
  const d = m.dayStats;
  const dist = m.dist;
  const chf = (usd, signed) => (Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null);
  if (m.empty) return <div className="lh-cfoot lh-cfoot--empty">Aucune clôture sur la fenêtre</div>;

  const cells = [
    ['MEILLEUR JOUR', fmtUsdSigned(d.bestDay), 'journée', d.bestDay, toneOf(d.bestDay)],
    ['PIRE JOUR', fmtUsdSigned(d.worstDay), 'journée', d.worstDay, toneOf(d.worstDay)],
    ['% JOURS GAGN.', d.pctWinDays == null ? '—' : `${d.pctWinDays.toFixed(0)}%`, `${d.longWin}↑ / ${d.longLoss}↓ max`, null, null],
    ['MODE', dist.maxCount ? `${dist.maxCount}` : '—', 'trades / bucket', null, null],
    ['PAS BUCKET', dist.step ? fmtUsd(dist.step) : '—', 'largeur distrib.', null, null],
    ['FENÊTRE', `${m.spanDays} j`, `${m.matrix.n} clôt. · ${d.activeDays} jours`, null, null],
  ];
  return (
    <div className="lh-cfoot lh-cfoot--dense">
      {cells.map(([label, value, sub, usd, tone]) => {
        const c = Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, isSigned(value)) : null;
        return (
          <div className="lh-cfoot__cell" key={label}>
            <span className="lh-cfoot__label">{label}</span>
            <span className={`lh-cfoot__value${tone && tone !== 'mute' ? ` h2-cfoot--${tone}` : ''}`}>{value}</span>
            {c ? <span className="lh-cfoot__chf">{c}</span> : null}
            {sub != null ? <span className="lh-cfoot__sub">{sub}</span> : <span className="lh-cfoot__sub lh-cfoot__sub--empty" />}
          </div>
        );
      })}
    </div>
  );
}
