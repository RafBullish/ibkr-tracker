// ═══════════════════════════════════════════════════════════════
//  CHEATSHEET MODAL v5 Sprint 10 — keyboard shortcuts reference
//
//  Mounted globally in AppShell. Opens with Cmd+/ (or Ctrl+/).
//  Lists every shortcut in the app organized by section so the
//  trader can ramp up without reading docs.
//
//  Three sections :
//    - Navigation (workspace + commands)
//    - Grid (vim-style positions / history table)
//    - Mnemonics (Bloomberg-style 4-letter codes via CommandBar pills)
//
//  Pure presentation : no state apart from open/close (controlled
//  by parent). Uses the existing Modal primitive (Radix Dialog).
// ═══════════════════════════════════════════════════════════════

import Modal from './Modal';

const NAVIGATION = [
  { keys: ['⌘ K', 'Ctrl K'], desc: 'Ouvrir la palette de commandes (recherche globale)' },
  { keys: ['⌘ /', 'Ctrl /'], desc: 'Ouvrir cette aide-mémoire' },
  { keys: ['⌘ B', 'Ctrl B'], desc: 'Replier / déployer la navigation' },
  { keys: ['⌘ 0'], desc: 'Aller à Pré-marché' },
  { keys: ['⌘ 1'], desc: 'Aller à Tableau de bord' },
  { keys: ['⌘ 2'], desc: 'Aller à Positions' },
  { keys: ['⌘ 3'], desc: 'Aller à Historique' },
  { keys: ['⌘ 4'], desc: 'Aller à Greeks Center' },
  { keys: ['⌘ 5'], desc: 'Aller à Options Live' },
  { keys: ['⌘ 6'], desc: 'Aller à Analytics' },
  { keys: ['⌘ 7'], desc: 'Aller à Calendrier' },
  { keys: ['⌘ 8'], desc: 'Aller à Journal' },
  { keys: ['⌘ 9'], desc: 'Aller à Import' },
  { keys: ['Esc'], desc: 'Fermer une modal ou annuler la palette' },
];

const MNEMONICS = [
  { code: 'DASH', desc: 'Tableau de bord (workspace principal)' },
  { code: 'POS', desc: 'Positions ouvertes' },
  { code: 'HIST', desc: 'Historique des trades' },
  { code: 'GRKS', desc: 'Greeks Center' },
  { code: 'CHN', desc: 'Options Live · ATM-anchored' },
  { code: 'ANLY', desc: 'Analytics · KPIs avancés' },
  { code: 'CAL', desc: 'Calendrier · earnings + macro' },
  { code: 'JRNL', desc: 'Journal de trading' },
  { code: 'IMP', desc: 'Import IBKR Flex / API' },
];

const TABLE_TIPS = [
  {
    keys: ['Click cell EDGE', 'Click cell C-TIER'],
    desc: 'Ouvrir le Sniper Meta Editor pour la position',
  },
  { keys: ['Click row Watchlist'], desc: 'Naviguer vers /trading/chain pour ce ticker' },
  { keys: ['Hover cell heatmap'], desc: 'Voir le détail (n / win rate / total P&L) en tooltip' },
];

const TRADING_TIPS = [
  { keys: ['Cmd+K', 'puis tape ticker'], desc: 'Recherche fuzzy de positions / pages / actions' },
  {
    keys: ['Type Tag dans LivePositions'],
    desc: 'Tag manuel Edge/Capital/β-SPY (sidecar localStorage)',
  },
  { keys: ['Type ticker /trading/chain'], desc: "Charger la chaîne d'options Yahoo Finance" },
  { keys: ['Hover module header'], desc: 'Underline ambre identifie le module actif' },
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

function MnemonicRow({ code, desc }) {
  return (
    <div className="cheatsheet__row">
      <div className="cheatsheet__keys">
        <span className="cheatsheet__mnemonic">{code}</span>
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
          <h3 className="cheatsheet__section-title">Mnemonics 4-lettres (CommandBar)</h3>
          <p className="cheatsheet__section-hint">
            Pills cliquables en haut. Inspirés des function codes du Bloomberg Terminal.
          </p>
          {MNEMONICS.map((m) => (
            <MnemonicRow key={m.code} code={m.code} desc={m.desc} />
          ))}
        </section>

        <section className="cheatsheet__section">
          <h3 className="cheatsheet__section-title">Interactions tableaux + modules</h3>
          {TABLE_TIPS.map((t, i) => (
            <ShortcutRow key={i} keys={t.keys} desc={t.desc} />
          ))}
        </section>

        <section className="cheatsheet__section">
          <h3 className="cheatsheet__section-title">Workflows trading</h3>
          {TRADING_TIPS.map((t, i) => (
            <ShortcutRow key={i} keys={t.keys} desc={t.desc} />
          ))}
        </section>

        <div className="cheatsheet__footer">
          QuantumCall v5 · Sniper OTM v1.0 Finale ·{' '}
          <a
            href="https://github.com/RafBullish/ibkr-tracker"
            target="_blank"
            rel="noopener noreferrer"
            className="cheatsheet__link"
          >
            github.com/RafBullish/ibkr-tracker
          </a>
        </div>
      </div>
    </Modal>
  );
}
