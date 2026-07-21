// ═══════════════════════════════════════════════════════════════
//  LAB /lab/heros2 — Brique 1.E « Héros 2 — Realized ». DEV-ONLY
//  (import.meta.env.DEV), HORS AppShell, code-split (tree-shaken du
//  build prod), PURGÉ en fin de brique. Surface d'arbitrage : 2
//  directions du bloc RÉALISÉ pleine largeur, sur DONNÉES RÉELLES du
//  store (closedTrades). En session Playwright isolée, seed le dataset
//  d'audit reproductible pour peupler la vue.
//
//  A « LE REGISTRE »  — trajectoire-first, calqué sur Héros 1 (graphe
//                       terminal + géant réalisé en overlay).
//  B « L'ÉTABLI »     — forme-first (rythme quotidien + distribution +
//                       matrice de non-perte en bandeau).
// ═══════════════════════════════════════════════════════════════

import GlobalStyles from '../theme/GlobalStyles';
import DirectionA from './heros2/DirectionA';
import DirectionB from './heros2/DirectionB';
import '../styles/lab-heros2.css';

export default function Heros2Lab() {
  return (
    <>
      {/* Applique data-theme sur <html> (GlobalStyles vit d'ordinaire
          dans AppShell ; le lab est hors AppShell → on le monte ici). */}
      <GlobalStyles />
      <div className="rz-lab">
        <header className="rz-lab__head">
          <div className="rz-lab__title">
            <span className="rz-lab__brick">1.E</span>
            HÉROS 2 — RÉALISÉ · lab d'arbitrage
          </div>
          <div className="rz-lab__note">
            2 directions du bloc <strong>Realized pleine largeur</strong>, héritées du langage 1.C→1.D
            (cadre gris · cellules-MONDE · double devise USD/CHF · graphe terminal). Données réelles du
            portefeuille. Cible : <code>1591×900 · DPR 1.35 · midnight</code>.
          </div>
        </header>

        <section className="rz-lab__dir">
          <div className="rz-lab__dirhead">
            <span className="rz-lab__dirkey">A</span>
            <span className="rz-lab__dirname">LE REGISTRE</span>
            <span className="rz-lab__dirwhy">
              Trajectoire-first. Copie conforme de Héros 1 : même cadre, cellules-MONDE, graphe terminal
              lightweight-charts, <em>géant RÉALISÉ CUMULÉ</em> en overlay. Continuité maximale — Héros 1 et
              Héros 2 se lisent comme deux étages du même instrument.
            </span>
          </div>
          <DirectionA />
        </section>

        <section className="rz-lab__dir">
          <div className="rz-lab__dirhead">
            <span className="rz-lab__dirkey">B</span>
            <span className="rz-lab__dirname">L'ÉTABLI</span>
            <span className="rz-lab__dirwhy">
              Forme-first. Le même cadre, mais le graphe montre la <em>structure</em> du réalisé : rythme
              QUOTIDIEN (barres jour) + DISTRIBUTION des issues par-trade, avec la MATRICE DE NON-PERTE en
              bandeau proéminent. Répond aux 3 mots de la roadmap (cumulé / quotidien / distribution).
            </span>
          </div>
          <DirectionB />
        </section>

        <footer className="rz-lab__foot">
          LAB DEV-only · purgé en fin de brique 1.E · aucune implémentation dans l'app avant verdict.
        </footer>
      </div>
    </>
  );
}
