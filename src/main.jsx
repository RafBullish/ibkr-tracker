import './styles/tokens.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
// D1.2 — IBM Plex Sans Condensed = police de TOUS les chiffres de l'app
// (héros, KPI, tables). Graisses 600 + 700 seulement (pas d'italique) : les
// chiffres sont toujours ≥600. Import runtime global (candidate retenue par
// Rafael en phase D1).
import '@fontsource/ibm-plex-sans-condensed/600.css';
import '@fontsource/ibm-plex-sans-condensed/700.css';
import './styles/fonts.css';
import './styles/global.css';
import './styles/animations.css';
import './styles/responsive.css';
import './styles/components.css';
import './styles/dashboard.css';
import './styles/aura-boost.css';
import './styles/primitives.css';
// v3-components.css is loaded last so its rules win over component-level
// styles when class names overlap.
import './styles/v3-components.css';
// v4-shell.css adds CommandBar + StatusBar chrome on top of v3.
import './styles/v4-shell.css';
// v4-dashboard.css adds the 12-col bento grid for /dashboard.
import './styles/v4-dashboard.css';
// v5-chain.css : Sprint 3 institutional refonte of /trading/chain.
import './styles/v5-chain.css';
// canonical.css — palette canonique (DA Brutalisme Financier). Chargé en dernier
// pour faire autorité quand les pages migreront. Étape additive : aucune page
// ne le consomme encore, aucun changement visuel attendu.
import './styles/canonical.css';
// obsidienne-charts.css — kit data-viz Obsidienne (v1.0 · 1.A) : tooltip
// unique .obs-tooltip, dot/pulse LIVE, overrides scopés .obsidienne-chart.
// Juste après canonical.css (consomme ses tokens), avant les pages-*.
import './styles/obsidienne-charts.css';
// pages-positions.css — page-vitrine /trading/positions, première consommatrice
// de la palette canonique. Scopée à .positions-v3 / .positions-flat /
// .positions-empty — n'affecte aucune autre page.
import './styles/pages-positions.css';
// pages-greeks.css — page-vitrine /trading/greeks, deuxième consommatrice de la
// palette canonique. Scopée à .greeks-page / .greeks-v3__* / .greeks-empty —
// n'affecte aucune autre page.
import './styles/pages-greeks.css';
// pages-import.css — page-vitrine /settings/import, troisième consommatrice de
// la palette canonique. Scopée à .import-page / .import-page__* — n'affecte
// aucune autre page. Les anciennes règles .import-v3__* ont été retirées de
// v3-components.css au même commit (zéro doublon).
import './styles/pages-import.css';
// pages-settings.css — page-vitrine /settings/general, quatrième consommatrice
// de la palette canonique. Fichier PARTAGÉ entre les futures pages settings :
// General est la 1re, Api.jsx et Journal.jsx s'y brancheront lors de leurs
// propres sprints de migration. Les règles .settings-v3__section/__row/__toggle
// /__api-* ont été retirées de v3-components.css (zéro doublon) ;
// .settings-v3__input reste temporairement parce qu'Import.jsx la consomme.
import './styles/pages-settings.css';
// pages-history.css — page-vitrine /trading/history, cinquième consommatrice
// de la palette canonique. KPI strip pattern Greeks + panels pattern Positions
// + COPIE LOCALE .history-page__panel-head (pattern panel-head local par page ;
// .dashboard-v3__panel-head retiré après la migration U9 d'Analytics/Journal).
// .history-v3__delete-btn reste partagé dans v3-components.css.
import './styles/pages-history.css';
// pages-premarket.css — page-vitrine /premarket, sixième consommatrice de la
// palette canonique. Les 61 règles .premarket-* extraites de v5-chain.css
// (qui ne contient désormais plus que les règles .chain-v5__*, à migrer plus
// tard) et rebaptisées .premarket-page__* avec tokens canoniques.
import './styles/pages-premarket.css';
// pages-dashboard.css — page-vitrine /dashboard, septième consommation des
// tokens canoniques via la stratégie TRANSITION ZONE (alias rétrocompat dans
// canonical.css plutôt que chirurgie sur les 20+ sous-composants). Ce fichier
// porte uniquement le wrapper .dashboard-page + cibles canoniques neuves
// (.dashboard-page__panel/__panel-head) pour les futures migrations.
import './styles/pages-dashboard.css';
// v1-dashboard.css — Dashboard ère produit v1.0 (brique 1.A) : base <1440
// de la Ligne de commandement (.command-deck). Palier ≥1440 dans c3-hires.
import './styles/v1-dashboard.css';
// pages-calendar.css — page-vitrine /insights/calendar, huitième et dernière
// consommation des tokens canoniques. Calendar a été désintoxiquée de la
// palette JS divergente (`T from '../../theme/tokens'`) — l'import T est
// retiré, les 99 références T.* converties en var(--*) canoniques ou classes
// scopées. theme/tokens.js reste intact (ErrorBoundary, CommandPalette,
// WinRateDonut, ThemeSwitcher en dépendent) — purge dans CANONICAL-PURGE.
import './styles/pages-calendar.css';
// v1-shell.css — Le Shell v1.0 (brique 1.B) : grille AppShell 3 rangées
// (TickerTape pleine largeur · SideNav+main · StatusBar) + SideNav base.
// Juste avant c3-hires.css (qui reste dernier).
import './styles/v1-shell.css';
// v1-heros.css — Bloc Héros 1 (brique 1.D) : Equity/NLV pleine largeur
// (frontière + zone KPI Bi-héros + graphe terminal lightweight-charts +
// stats). Scopé .lh-* au bloc. Avant c3-hires.css.
import './styles/v1-heros.css';
// v1-heros2.css — Bloc Héros 2 (brique 1.E · Réalisé) : jumeau de Héros 1,
// classes .h2-* (deck réalisé + matrice de non-perte, split graphe terminal /
// distribution). Après v1-heros.css (réutilise .lh-*), avant c3-hires.css.
import './styles/v1-heros2.css';
// c3-hires.css — PALIER HAUTE RÉSOLUTION C.3.0 (≥1440px). Importé EN
// DERNIER pour gagner par ordre de source. Densifie l'usage fenêtré
// ~1591 px / dpr 1.35 ; n'affecte pas le mobile (<1440).
import './styles/c3-hires.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from './components/layout/Toast';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>
);
