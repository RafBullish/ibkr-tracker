// ═══════════════════════════════════════════════════════════════
//  ALERTS FEED v4 brick 8 — module col 7-12 row 4 (200 px)
//
//  Log stream chronologique style IDE. Format ligne :
//    HH:MM:SS │ LEVEL │ MESSAGE
//
//  Convention : NEWEST AT TOP (Linux/IDE convention, lecture
//  recent-first). Pas de auto-scroll mécanisé — la fixture est
//  statique. Live stream sera traité en brick alerts engine.
//
//  Pause toggle dans le header : preview console.log uniquement.
//  Hovering pause sera ré-activé quand le stream live arrive.
// ═══════════════════════════════════════════════════════════════

import { useState } from 'react';
import { formatTimestamp, classifyLevel } from '../../utils/alertsFeed';

export default function AlertsFeed({ data, area = 'alert' }) {
  const [paused, setPaused] = useState(false);
  const entries = Array.isArray(data) ? data : [];
  const isEmpty = entries.length === 0;

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    console.log('[AlertsFeed] pause toggle (preview):', next);
  };

  return (
    <section className="module alerts-feed" style={{ gridArea: area }}>
      <header className="module-header">
        <span className="module-header__title">Alerts Feed · Live</span>
        <button
          type="button"
          className="alerts-feed__pause-btn"
          onClick={togglePause}
          aria-pressed={paused}
          title={paused ? 'Reprendre le stream' : 'Mettre en pause'}
        >
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </header>
      <div className="module-body alerts-feed__body">
        {isEmpty ? (
          <div className="alerts-feed__empty module-empty">
            <span className="module-empty__title">Aucune alerte</span>
            <span className="module-empty__sub">
              Les gates Sniper (DTE / SL / EARN) et conditions IV s&apos;affichent ici dès
              qu&apos;elles déclenchent sur tes positions.
            </span>
          </div>
        ) : (
          <ul className="alerts-feed__list" aria-label="Alerts log">
            {entries.map((e, i) => {
              const level = classifyLevel(e.level);
              return (
                <li key={`${e.ts}-${i}`} className="alerts-feed__row">
                  <span className="alerts-feed__time">{formatTimestamp(e.ts)}</span>
                  <span className="alerts-feed__sep" aria-hidden="true">
                    │
                  </span>
                  <span className={`alerts-feed__level alerts-feed__level--${level.tone}`}>
                    {level.label}
                  </span>
                  <span className="alerts-feed__sep" aria-hidden="true">
                    │
                  </span>
                  <span className="alerts-feed__msg">{e.msg}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
