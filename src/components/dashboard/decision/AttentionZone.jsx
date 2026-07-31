// ═══════════════════════════════════════════════════════════════
//  BANDE DÉCISION (1.F) — ZONE ATTENTION (la plus large).
//  « Dois-je agir ? » — lignes de positions à gate CRITIQUE ou ARMÉ,
//  triées par urgence (modèle pur decision/model.deriveAttention).
//  Kill switch déclenché = ligne prioritaire pleine largeur en tête.
//  Clic ligne → /trading/positions?focus={id} (deep-link U4).
//  État vide DESIGNÉ : « Tous les gates au vert — N surveillées ».
//  Ambre = signal décisionnel (badge, hairline critique) — jamais P&L.
// ═══════════════════════════════════════════════════════════════

import { useNavigate } from 'react-router-dom';
import { fmtUsdSigned } from '../hero1/kit';

// 1.F-c1 C3 — registre terminal : ARMED / CRITICAL (parité avec le
// vocabulaire validé de la page : ARMED de l'AgendaCell, LIVE/REAL de
// la StatusBar). Le reste de la bande reste en français.
const BADGE = { critique: 'CRITICAL', arme: 'ARMED' };

export default function AttentionZone({ attention }) {
  const navigate = useNavigate();
  const a = attention;

  const go = (target) => () => navigate(target);
  const onKey = (target) => (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      navigate(target);
    }
  };

  return (
    <div className="db-zone db-zone--attention" aria-label="Attention — gates et alertes">
      <div className="mk-title">
        ATTENTION
        {a.lines.length > 0 ? ` · ${a.lines.length}` : ''}
      </div>
      {a.kill ? (
        <div
          className="db-kill"
          role="link"
          tabIndex={0}
          onClick={go('/insights/journal')}
          onKeyDown={onKey('/insights/journal')}
          title="Limite de perte quotidienne franchie — ouvrir le journal"
        >
          <span className="db-badge db-badge--critique">KILL SWITCH</span>
          <span className="db-kill__msg">
            Limite du jour franchie · {fmtUsdSigned(a.kill.dailyPnlUsd)} / {fmtUsdSigned(a.kill.maxLoss)}
          </span>
        </div>
      ) : null}
      {a.empty ? (
        <div className="db-allclear">
          <span className="db-allclear__dot" aria-hidden="true" />
          <span className="db-allclear__msg">Tous les gates au vert</span>
          <span className="db-allclear__sub">
            {a.watchedCount > 0
              ? `${a.watchedCount} position${a.watchedCount > 1 ? 's' : ''} surveillée${a.watchedCount > 1 ? 's' : ''} — DTE · SL · TP`
              : 'aucune position option ouverte'}
          </span>
        </div>
      ) : (
        <ul className="db-lines" aria-label="Positions à surveiller">
          {a.shown.map((l) => {
            const target = `/trading/positions?focus=${encodeURIComponent(l.id)}`;
            return (
              <li
                key={l.id}
                className={`db-line db-line--${l.severity}`}
                role="link"
                tabIndex={0}
                onClick={go(target)}
                onKeyDown={onKey(target)}
                title={`${l.ticker}${l.sub ? ` ${l.sub}` : ''} — ${l.metric} · ouvrir la position`}
              >
                <span className={`db-badge db-badge--${l.severity}`}>{BADGE[l.severity]}</span>
                <span className="db-line__tk">{l.ticker}</span>
                {l.sub ? <span className="db-line__sub">{l.sub}</span> : null}
                <span className="db-line__metric">{l.metric}</span>
                {l.others > 0 ? (
                  <span
                    className="db-line__more"
                    title={`+${l.others} signal${l.others > 1 ? 'aux' : ''} · ${l.otherMetrics.join(' · ')}`}
                  >
                    +{l.others}
                  </span>
                ) : null}
              </li>
            );
          })}
          {a.moreCount > 0 ? (
            <li
              className="db-lines__overflow"
              role="link"
              tabIndex={0}
              onClick={go('/trading/positions')}
              onKeyDown={onKey('/trading/positions')}
              title="Ouvrir la page Positions"
            >
              +{a.moreCount} autre{a.moreCount > 1 ? 's' : ''}
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
