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
// pages-chain.css (ex-v5-chain.css, renommée + splittée É3 §4.2.10) :
// /trading/chain au langage cockpit. Position de cascade INCHANGÉE ;
// .perf-attr__* vivent dans pages-history.css, .cheatsheet__* dans
// modals.css.
import './styles/pages-chain.css';
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
// pages-settings.css — page-vitrine /settings/general + /settings/api (brique
// 2.D : les deux partagent .settings-page). Fichier PARTAGÉ. Bandeaux de
// commandement, corps 2 colonnes (General), tableau dense des services (API),
// zone dangereuse durcie. .settings-v3__input + .api-service-* ont été RETIRÉS
// de v3-components.css en 2.D (Import migré vers .settings-page__input,
// ApiServiceCard supprimé — grep 0).
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
// pages-analytics.css — page-vitrine /insights/analytics (brique 2.B). Créée :
// la page n'avait pas de feuille dédiée (styles épars dans v3-components.css).
// Scopée .analytics-v3 / .analytics-command / .analytics-rhythm. Avant les v1-*.
import './styles/pages-analytics.css';
// v1-dashboard.css — cockpit du Dashboard v1.0 : cadre .cockpit (1.D)
// + MarketDeck .mk-* (étage marché 1.C, base <1440 ; palier ≥1440 dans
// c3-hires). L'ex-Ligne de commandement est morte (É4 §5.3).
import './styles/v1-dashboard.css';
// pages-calendar.css — page-vitrine /insights/calendar, huitième et dernière
// consommation des tokens canoniques. Calendar a été désintoxiquée de la
// palette JS divergente (`T from '../../theme/tokens'`) — l'import T est
// retiré, les 99 références T.* converties en var(--*) canoniques ou classes
// scopées. theme/tokens.js reste intact (ErrorBoundary, ThemeSwitcher,
// useLiveTheme en dépendent ; CommandPalette libérée en É3) — purge dans
// CANONICAL-PURGE.
import './styles/pages-calendar.css';
// pages-journal.css — page-vitrine /insights/journal recomposée au langage
// cockpit (brique 2.C2). Ses styles vivaient dans v3-components.css (tokens
// legacy) → purgés là-bas, recomposés ici au système canonique. Dernière
// consommatrice pages-* avant les v1-*.
import './styles/pages-journal.css';
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
// v1-decision.css — Bande décision (brique 1.F) : étage DÉCISION du
// Dashboard (ATTENTION · FORME · CAPITAL) + harmonisation veille
// (Watchlist/CalendarMini). Classes .db-* ; réutilise .mk-title/.pf-c
// (v1-heros.css). Après v1-heros2.css, avant c3-hires.css.
import './styles/v1-decision.css';
// modals.css — LA maison des modales et du chrome flottant (É3 §4.3) :
// Modal générique cockpit, add-trade-form, cheatsheet (⌘/), palette ⌘K
// (.cmdk). Après les feuilles de pages (ses règles remplacent les
// ex-blocs de v3-components/v5-chain), avant c3-hires.css.
import './styles/modals.css';
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
