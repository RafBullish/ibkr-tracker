// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F) — ZONE FORME.
//  « Suis-je en forme ? » — pastilles des 18 derniers trades clôturés
//  (chrono gauche→droite, le plus récent à droite accentué) + streak
//  courant + MTD réalisé + expectancy. Sources = EXACTEMENT Héros 2
//  (deriveRealized/matrix) + usePortfolioMetrics (streak, MTD) —
//  zéro recalcul divergent. Vert/rouge AUTORISÉ : P&L réalisé =
//  argent réel (loi de couleur). Expectancy « — » sous 10 décisifs.
// ═══════════════════════════════════════════════════════════════

import { fmtUsdSigned, fmtChf, toneSign } from '../hero1/kit';
import { MIN_DECISIVE_WINRATE } from '../../../utils/significance';
import { TickValue } from './parts';

function Cell({ label, value, chf, sub, tone }) {
  const meta = [chf, sub].filter(Boolean).join(' · ');
  return (
    <div className="pf-c db-c">
      <span className="pf-c__label">{label}</span>
      <TickValue text={value ?? '—'} className={`pf-c__val db-c__val${tone ? ` pf-c__val--${tone}` : ''}`} />
      <span className="pf-c__meta">{meta || ' '}</span>
    </div>
  );
}

export default function FormeZone({ forme, rate }) {
  const f = forme;
  const chf = (usd, signed) =>
    Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null;

  return (
    <div className="db-zone" aria-label="Forme — derniers trades clôturés">
      <div className="mk-title">FORME</div>
      {f.dots.length === 0 ? (
        <div className="db-allclear">
          <span className="db-allclear__msg">Aucune clôture</span>
          <span className="db-allclear__sub">les pastilles arrivent au premier trade clôturé</span>
        </div>
      ) : (
        <>
          <div
            className="db-dots"
            role="img"
            aria-label={`${f.dots.length} derniers trades clôturés — vert gain, rouge perte`}
          >
            {f.dots.map((d, i) => (
              <span
                key={`${d.date}-${i}`}
                className={`db-dot db-dot--${d.tone}${i === f.dots.length - 1 ? ' db-dot--last' : ''}`}
                title={`${d.tk} · ${fmtUsdSigned(d.pnl)} · ${d.date}`}
              />
            ))}
          </div>
          <div className="db-grid3">
            <Cell
              label="STREAK"
              value={f.streak ? `${f.streak.count} ${f.streak.kind}` : '0'}
              sub={f.streak ? (f.streak.kind === 'V' ? 'victoires' : 'défaites') : 'neutre'}
              tone={f.streak ? (f.streak.kind === 'V' ? 'profit' : 'loss') : undefined}
            />
            <Cell
              label="MTD · MOIS"
              value={f.mtd == null ? '—' : fmtUsdSigned(f.mtd)}
              chf={chf(f.mtd, true)}
              tone={toneSign(f.mtd)}
            />
            <Cell
              label="EXPECTANCY"
              value={f.expectancy == null ? '—' : fmtUsdSigned(f.expectancy)}
              chf={chf(f.expectancy, true)}
              sub={f.expectancy == null ? `${f.decisive} décisifs / ${MIN_DECISIVE_WINRATE} requis` : '/ clôture'}
              tone={toneSign(f.expectancy)}
            />
          </div>
        </>
      )}
    </div>
  );
}
