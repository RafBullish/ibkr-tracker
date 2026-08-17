// ═══════════════════════════════════════════════════════════════
//  BLOC PORTES (1.G-b) — les 5 portes de sortie, une rangée par position.
//
//  RÈGLE ABSOLUE : ce composant NE RECALCULE AUCUN SEUIL. Il consomme la
//  sortie du moteur `utils/gates.js` (gateDistances / nearestPorte) telle
//  quelle et ne fait que la FORMATER. Une porte ne vit qu'à un seul
//  endroit — le moteur. Ce bloc a ABSORBÉ la zone ATTENTION de la bande
//  décision (morte en 1.G-b), kill switch compris.
//
//  Par rangée : ticker · contrat · P&L % puis SL · TRAIL · DTE · EARN ·
//  STAG (chacune : valeur S2 + distance en méta + barre courte de
//  proximité). En tête : PORTE LA PLUS PROCHE (la phrase à lire en 2 s).
//  N=0 : cellule pleine largeur « AUCUNE POSITION · déployable <montant> ».
//
//  Couleur : porte franchie = AMBRE ; SEULE exception ROUGE, P1 exécution
//  −35 % (perte réelle). Grisé = P4 indéterminée / P5 hors bande.
// ═══════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import useSniperGates from '../../../hooks/useSniperGates';
import useDailyKillSwitch from '../../../hooks/useDailyKillSwitch';
import { gateDistances, nearestPorte, porteProximities } from '../../../utils/gates';
import { fmtUsd, fmtChf, fmtUsdSigned, fmtPct } from './kit';
import { TickValue } from '../decision/parts';

const PORTE_LABEL = { P1: 'SL', P2: 'TRAIL', P3: 'DTE', P4: 'EARN', P5: 'STAG' };

/** Jour de séance NY ('YYYY-MM-DD') — même source que la bande, pour P4. */
function nyToday() {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const pts = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))} pts` : '—');
const pctPlus = (x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x))} %` : '—');

// ── état de porte → ton d'affichage (loi de couleur) ────────────
// 'rouge' = P1 exécution −35 (perte réelle) ; 'ambre' = porte franchie/
// armée/active ; 'grise' = indéterminée / hors bande ; null = neutre.
function toneOf(code, d) {
  if (code === 'P1') return d.P1.state === 'execution' ? 'rouge' : d.P1.state === 'alerte' ? 'ambre' : null;
  if (code === 'P2') return d.P2.state === 'crossed' || d.P2.state === 'armed' ? 'ambre' : null;
  if (code === 'P3') return d.P3.state === 'crossed' || d.P3.state === 'armed' ? 'ambre' : null;
  if (code === 'P4') return d.P4.state === 'active' ? 'ambre' : d.P4.state === 'indeterminee' ? 'grise' : null;
  if (code === 'P5') return d.P5.state === 'crossed' ? 'ambre' : d.P5.state === 'hors-bande' ? 'grise' : null;
  return null;
}

// ── distance → texte de méta (formatage pur de la sortie moteur) ─
function metaOf(code, d) {
  if (code === 'P1') {
    if (d.P1.state === 'na') return '—';
    return `−30: ${pts(d.P1.toAlerte)} · −35: ${pts(d.P1.toExecution)}`;
  }
  if (code === 'P2') {
    if (d.P2.state === 'no-peak') return 'pas de pic';
    const part = d.P2.isPartial ? ' · pic partiel' : '';
    return d.P2.isArmed ? `armé · sortie ${pctPlus(d.P2.sortiePct)}${part}` : `non armé${part}`;
  }
  if (code === 'P3') {
    if (d.P3.state === 'na') return '—';
    return d.P3.joursAvant <= 0 ? 'gate 45 franchie' : `${d.P3.joursAvant} j avant 45`;
  }
  if (code === 'P4') {
    if (d.P4.state === 'indeterminee') return 'earnings non renseignés';
    if (d.P4.state === 'active') return d.P4.condition === 'sortie' ? 'fenêtre · sortie (gain)' : 'fenêtre · on tient (perte)';
    if (d.P4.state === 'approche') return `${d.P4.joursAvantFenetre} j de bourse avant fenêtre`;
    return 'fenêtre passée';
  }
  if (code === 'P5') {
    if (d.P5.state === 'na') return '—';
    if (d.P5.joursAvant > 0) return `${d.P5.joursAvant} j avant 30`;
    return d.P5.inBand ? 'dans bande −20/+30' : 'hors bande (grisée)';
  }
  return '—';
}

// ── valeur principale (S2) de chaque porte ──────────────────────
function valueOf(code, d) {
  if (code === 'P1') return d.P1.state === 'na' ? '—' : pctPlus(d.P1.pnlPct);
  if (code === 'P2') return d.P2.picPct == null ? '—' : pctPlus(d.P2.picPct);
  if (code === 'P3') return d.P3.dte == null ? '—' : `${d.P3.dte} j`;
  if (code === 'P4') return d.P4.joursAvantResultats == null ? '?' : `J−${d.P4.joursAvantResultats}`;
  if (code === 'P5') return d.P5.daysHeld == null ? '—' : `${d.P5.daysHeld} j`;
  return '—';
}

/** Texte court de distance pour la cellule « porte la plus proche ». */
function nearestText(code, d) {
  if (code === 'P1') return d.P1.toAlerte > 0 ? `${pts(d.P1.toAlerte)} avant −30` : 'alerte franchie';
  if (code === 'P2') return d.P2.state === 'crossed' ? 'sortie atteinte' : 'armé';
  if (code === 'P3') return d.P3.joursAvant > 0 ? `${d.P3.joursAvant} j avant 45` : 'gate franchie';
  if (code === 'P4') return d.P4.state === 'active' ? 'fenêtre earnings' : `${d.P4.joursAvantFenetre} j avant fenêtre`;
  if (code === 'P5') return d.P5.joursAvant > 0 ? `${d.P5.joursAvant} j avant 30` : 'jour 30';
  return '';
}

function PorteCell({ code, d, prox }) {
  const tone = toneOf(code, d);
  return (
    <div className={`pf-porte${tone ? ` pf-porte--${tone}` : ''}`}>
      <span className="pf-porte__lbl">{PORTE_LABEL[code]}</span>
      <span className="pf-porte__val">{valueOf(code, d)}</span>
      <span className="pf-porte__meta">{metaOf(code, d)}</span>
      <span className="pf-porte__barslot">
        {prox != null ? (
          <span className="pf-porte__bar" role="img" aria-label={`${prox} %`}>
            <span className="pf-porte__bar-fill" style={{ width: `${prox}%` }} />
          </span>
        ) : null}
      </span>
    </div>
  );
}

function PorteRow({ row, d }) {
  const navigate = useNavigate();
  const prox = porteProximities(d);
  const sub = `${row.type || ''}${Number.isFinite(Number(row.strike)) && Number(row.strike) > 0 ? ` $${Math.round(Number(row.strike))}` : ''}`.trim();
  const tone = row.unrealPct > 0 ? 'profit' : row.unrealPct < 0 ? 'loss' : 'neutral';
  return (
    <div
      className="pf-porte-row"
      role="link"
      tabIndex={0}
      onClick={() => navigate(`/trading/positions?focus=${encodeURIComponent(row.id)}`)}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/trading/positions?focus=${encodeURIComponent(row.id)}`)}
    >
      <div className="pf-porte-row__id">
        <span className="pf-porte-row__tk">{row.ticker}</span>
        {sub ? <span className="pf-porte-row__sub">{sub}</span> : null}
        <span className={`pf-porte-row__pnl text-${tone}`}>
          {Number.isFinite(row.unrealPct) ? `${row.unrealPct >= 0 ? '+' : ''}${row.unrealPct.toFixed(1)} %` : '—'}
        </span>
      </div>
      <div className="pf-porte-row__gates">
        {['P1', 'P2', 'P3', 'P4', 'P5'].map((code) => (
          <PorteCell key={code} code={code} d={d} prox={Number.isFinite(prox[code]) ? Math.round(prox[code] * 100) : null} />
        ))}
      </div>
    </div>
  );
}

export default function PortesBloc({ deployableUsd, rate }) {
  const { rows } = useSniperGates();
  const kill = useDailyKillSwitch();
  const navigate = useNavigate();
  const today = nyToday();
  const chf = Number.isFinite(deployableUsd) && Number.isFinite(rate) && rate > 0 ? fmtChf(deployableUsd, rate) : null;

  const items = (rows || []).map((r) => ({ r, d: gateDistances(r, { today }) }));
  const withNear = items
    .map((it) => ({ ...it, near: nearestPorte(it.d) }))
    .filter((it) => it.near)
    .sort((a, b) => b.near.prox - a.near.prox);
  const globalNearest = withNear[0] || null;

  return (
    <section className="pf-portes" aria-label="Portes de sortie par position">
      <div className="pf-portes__head">
        <span className="pf-portes__head-lbl">PORTE LA PLUS PROCHE</span>
        <span className="pf-portes__head-val">
          {globalNearest
            ? `${globalNearest.r.ticker} · ${PORTE_LABEL[globalNearest.near.code]} · ${nearestText(globalNearest.near.code, globalNearest.d)}`
            : items.length
              ? 'aucune porte proche'
              : '—'}
        </span>
      </div>

      {kill.active ? (
        <div
          className="pf-portes__kill"
          role="link"
          tabIndex={0}
          onClick={() => navigate('/insights/journal')}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/insights/journal')}
          title="Limite de perte quotidienne franchie — ouvrir le journal"
        >
          <span className="db-badge db-badge--critique">KILL SWITCH</span>
          <span className="pf-portes__kill-msg">
            Limite du jour franchie · {fmtUsdSigned(kill.dailyPnlUsd)} / {fmtUsdSigned(kill.maxLoss)}
          </span>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="pf-portes__empty">
          <span className="pf-portes__empty-lbl">AUCUNE POSITION</span>
          <span className="pf-portes__empty-val">
            <TickValue
              text={`déployable ${deployableUsd == null ? 'indéterminée' : fmtUsd(deployableUsd)}`}
            />
            {chf ? <span className="pf-portes__empty-chf"> · {chf}</span> : null}
          </span>
        </div>
      ) : (
        <div className="pf-portes__rows">
          {items.map(({ r, d }) => (
            <PorteRow key={r.id} row={r} d={d} />
          ))}
        </div>
      )}
    </section>
  );
}
