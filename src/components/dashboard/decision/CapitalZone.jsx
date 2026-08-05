// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F) — ZONE CAPITAL.
//  « Ai-je de la marge ? » — jauge d'exposition (remplissage AMBRE,
//  usage sanctionné « jauge de capital/exposition », repère au cap
//  tier 70 %) + cellules-MONDE : EXPOSITION (É3 §4.2.7 — le libellé
//  dit la vérité du calcul : totalExposure = Σ |valeur mark|, PAS le
//  coût des primes engagées ; l'ex-« DÉPLOYÉ » mentait) · DISPONIBLE
//  (IBKR/est., même source que Héros 1) · RISK $ (NEUTRE — montant
//  hypothétique, amendement 15.07) · Δ NET et Θ TOTAL (NEUTRES — loi
//  de couleur) · TIER actif (chip sobre). Sources = miroir strict de
//  Héros 1 (decision/model.deriveCapital).
// ═══════════════════════════════════════════════════════════════

import { fmtUsd, fmtUsdSigned, fmtChf } from '../hero1/kit';
import { TickValue } from './parts';

const sharesSigned = (v) =>
  v == null || !Number.isFinite(v)
    ? null
    : `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v)).toLocaleString('de-CH')}`;

function Cell({ label, value, chf, sub, chip }) {
  // Pas de « · » devant un sub qui commence par « / » (« CHF −71 / jour »).
  const meta = [chf, sub].filter(Boolean).join(sub && sub.startsWith('/') ? ' ' : ' · ');
  return (
    <div className="pf-c db-c">
      <span className="pf-c__label">{label}</span>
      {chip ? (
        <span className="db-c__val db-chip">{value}</span>
      ) : (
        <TickValue text={value ?? '—'} className="pf-c__val db-c__val" />
      )}
      <span className="pf-c__meta">{meta || ' '}</span>
    </div>
  );
}

export default function CapitalZone({ capital, rate }) {
  const c = capital;
  const chf = (usd, signed) =>
    Number.isFinite(usd) && Number.isFinite(rate) && rate > 0 ? fmtChf(usd, rate, signed) : null;
  const pct = c.deployedPct != null ? Math.max(0, Math.min(100, c.deployedPct)) : null;
  const cap = Math.max(0, Math.min(100, c.capPct));

  return (
    <div className="db-zone" aria-label="Capital — marge de manœuvre">
      <div className="mk-title">CAPITAL</div>
      <div className="db-gaugewrap">
        <span className="db-gauge__lbl">
          EXPOSITION{pct != null ? ` · ${Math.round(pct)} %` : ''}
          <span className="db-gauge__cap"> · cap {Math.round(cap)} %</span>
        </span>
        <span
          className="db-gauge"
          role="img"
          aria-label={pct != null ? `Exposition ${Math.round(pct)} % du NLV — cap ${Math.round(cap)} %` : 'exposition inconnue'}
        >
          {[25, 50, 75].map((g) => (
            <span key={g} className="db-gauge__grad" style={{ left: `${g}%` }} aria-hidden="true" />
          ))}
          {/* 1.F-c1 C1 — remplissage NEUTRE (acier) sous le cap ; il passe
              INTÉGRALEMENT à l'ambre au franchissement (le signal naît au
              cap, il n'est plus permanent). */}
          {pct != null ? (
            <span
              className={`db-gauge__fill${pct >= cap ? ' db-gauge__fill--cap' : ''}`}
              style={{ width: `${pct}%` }}
            />
          ) : null}
          <span className="db-gauge__mark" style={{ left: `${cap}%` }} aria-hidden="true" />
        </span>
      </div>
      <div className="db-grid3">
        {/* É3 §4.2.7 — « EXPOSITION » : la vérité du calcul
            (totalExposure = Σ |valeur mark| des positions ouvertes),
            dite aussi en méta. Le calcul n'est PAS modifié. */}
        <Cell
          label="EXPOSITION"
          value={c.deployed == null ? '—' : fmtUsd(c.deployed)}
          chf={chf(c.deployed)}
          sub={c.deployedPct != null ? `Σ valeur mark · ${Math.round(c.deployedPct)} % NLV` : 'Σ valeur mark'}
        />
        <Cell
          label={
            <>
              DISPONIBLE
              {c.available != null ? (
                c.availableIsReal ? (
                  <span className="pf-real" title="Available Funds réel — bridge IBKR (snapshot frais)">IBKR</span>
                ) : (
                  <span className="pf-est" title="Estimation cash-A — bridge hors ligne ou snapshot périmé">est.</span>
                )
              ) : null}
            </>
          }
          value={c.available == null ? '—' : fmtUsd(c.available)}
          chf={chf(c.available)}
          sub={c.availablePct != null ? `${Math.round(c.availablePct)} % NLV` : null}
        />
        {/* « STOPS » au libellé : Risk $ (exposition ajustée au stop)
            ≠ Max Loss (§8) — la nature du chiffre reste toujours dite. */}
        <Cell
          label="RISK $ · STOPS"
          value={c.riskDollar == null ? '—' : fmtUsd(c.riskDollar)}
          chf={chf(c.riskDollar)}
          sub={c.riskPct != null ? `${c.riskPct.toFixed(1)} % NLV` : 'cumul stops'}
        />
        <Cell
          label="Δ NET"
          value={sharesSigned(c.deltaShares) ?? '—'}
          sub={c.deltaDollar != null ? `exp. ${fmtUsdSigned(c.deltaDollar)}` : 'actions-éq.'}
        />
        <Cell
          label="Θ TOTAL"
          value={c.thetaDay == null ? '—' : fmtUsdSigned(c.thetaDay)}
          chf={chf(c.thetaDay, true)}
          sub="/ jour"
        />
        <Cell label="TIER" value={c.tierLabel ?? '—'} sub="actif" chip />
      </div>
    </div>
  );
}
