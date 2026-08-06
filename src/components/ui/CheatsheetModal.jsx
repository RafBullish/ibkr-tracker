// ═══════════════════════════════════════════════════════════════
//  CHEATSHEET MODAL (⌘/) — aide-mémoire des raccourcis clavier.
//
//  Montée globalement dans AppShell. RÉÉCRITE en É3 §4.2.9 sur la
//  VÉRITÉ du code : chaque ligne est vérifiée contre AppShell
//  (NAV_PATHS ⌘1..9, ⌘0, ⌘K, ⌘/, ⌘B) et contre les interactions
//  réellement câblées. Les mnemonics 4-lettres (CommandBar morte en
//  1.B, jamais matchés par la palette) et le hover-underline de
//  module (chrome disparu) sont MORTS. Rien n'est annoncé qui
//  n'existe pas.
//
//  Présentation pure : aucun état hors open/close (contrôlé par le
//  parent). Utilise la primitive Modal (Radix Dialog).
// ═══════════════════════════════════════════════════════════════

import Modal from './Modal';

// Mapping RÉEL AppShell (⌘ = Ctrl sous Windows) — jamais remappé ici.
const NAVIGATION = [
  { keys: ['⌘ K', 'Ctrl K'], desc: 'Palette de commandes (pages, actions, positions)' },
  { keys: ['⌘ /', 'Ctrl /'], desc: 'Cette aide-mémoire' },
  { keys: ['⌘ B', 'Ctrl B'], desc: 'Replier / déployer la navigation' },
  { keys: ['⌘ 0'], desc: 'Pré-marché' },
  { keys: ['⌘ 1'], desc: 'Tableau de bord' },
  { keys: ['⌘ 2'], desc: 'Positions' },
  { keys: ['⌘ 3'], desc: 'Historique' },
  { keys: ['⌘ 4'], desc: 'Greeks' },
  { keys: ['⌘ 5'], desc: 'Options Live' },
  { keys: ['⌘ 6'], desc: 'Analytics' },
  { keys: ['⌘ 7'], desc: 'Calendrier' },
  { keys: ['⌘ 8'], desc: 'Journal' },
  { keys: ['⌘ 9'], desc: 'Import' },
  { keys: ['Esc'], desc: 'Fermer une modale ou la palette' },
];

// Interactions réellement câblées (vérifiées contre le code, É3).
const INTERACTIONS = [
  {
    keys: ['Clic EDGE / C-TIER'],
    desc: 'Tagger la méta Sniper de la position (éditeur Edge · Capital · β-SPY)',
  },
  { keys: ['Clic ligne Watchlist'], desc: 'Ouvrir la chaîne d’options (Options Live)' },
  { keys: ['Clic ligne Positions'], desc: 'Ouvrir le détail de la position' },
  {
    keys: ['Survol heatmap P&L'],
    desc: 'Détail de l’unité (n trades · win rate · P&L) en tooltip',
  },
  { keys: ['Ticker + Charger', 'Options Live'], desc: 'Charger la chaîne d’options du sous-jacent' },
];

function ShortcutRow({ keys, desc }) {
  return (
    <div className="cheatsheet__row">
      <div className="cheatsheet__keys">
        {keys.map((k, i) => (
          <span key={i}>
            <kbd className="cheatsheet__kbd">{k}</kbd>
            {i < keys.length - 1 ? <span className="cheatsheet__or">/</span> : null}
          </span>
        ))}
      </div>
      <div className="cheatsheet__desc">{desc}</div>
    </div>
  );
}

export default function CheatsheetModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title="Aide-mémoire · raccourcis clavier">
      <div className="cheatsheet">
        <section className="cheatsheet__section">
          <h3 className="cheatsheet__section-title">Navigation</h3>
          {NAVIGATION.map((s, i) => (
            <ShortcutRow key={i} keys={s.keys} desc={s.desc} />
          ))}
        </section>

        <section className="cheatsheet__section">
          <h3 className="cheatsheet__section-title">Interactions</h3>
          {INTERACTIONS.map((t, i) => (
            <ShortcutRow key={i} keys={t.keys} desc={t.desc} />
          ))}
        </section>

        <div className="cheatsheet__footer">QuantumCall v1.0 · Sniper OTM</div>
      </div>
    </Modal>
  );
}
