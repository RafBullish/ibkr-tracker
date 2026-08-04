// ═══════════════════════════════════════════════════════════════
//  TILT METER — jauge de discipline « Calme → Tilt » (brique 2.C2).
//
//  Score 0-100 dérivé des violations documentées dans le journal
//  (FOMO, Revenge, Overtrading, Early exit, Manque de discipline) sur
//  les 14 derniers jours.
//
//  COULEUR — EXCEPTION NOMMÉE (§4.3) : ce composant, et lui seul sur le
//  Journal, garde l'échelle vert → ambre → rouge. Il ne mesure ni un
//  ratio ni un montant, mais un état de discipline dont la dérive
//  produit la perte d'argent réel — une jauge de risque comportemental,
//  au même titre qu'un gate CRITICAL. Partout ailleurs : neutre.
//
//  Zones :
//    0-25   CALME   (vert)
//    25-50  FOCUS   (vert atténué)
//    50-75  WARNING (ambre)
//    75-100 TILT    (rouge)
// ═══════════════════════════════════════════════════════════════

import InfoTooltip from '../ui/InfoTooltip';

const TILT_TOOLTIP = {
  title: 'Tilt Meter',
  body: 'Score comportemental 0-100 dérivé des violations documentées dans le journal : FOMO, Revenge trading, Overtrading, Early exit, Manque de discipline. Basé sur les 14 derniers jours.',
  formula: 'Σ(poids violations 14j) / max × 100',
  example: 'Score 80 = zone de tilt marqué. Recommandation : pause session, révision plan.',
};

function toneForScore(score) {
  if (score < 25)
    return { label: 'CALME', tone: 'profit', text: 'Discipline et exécution solides.' };
  if (score < 50)
    return { label: 'FOCUS', tone: 'accent', text: 'Quelques écarts, mais globalement maîtrisé.' };
  if (score < 75)
    return {
      label: 'WARNING',
      tone: 'warning',
      text: 'Plusieurs violations récentes — attention.',
    };
  return { label: 'TILT', tone: 'loss', text: 'Zone de tilt. Pause session recommandée.' };
}

export default function TiltMeter({ score = 0, className, dailyKillSwitchActive }) {
  const pct = Math.max(0, Math.min(100, score));
  const tone = toneForScore(pct);

  return (
    <div className={['tilt-meter', className].filter(Boolean).join(' ')} data-tone={tone.tone}>
      <div className="tilt-meter__head">
        <div className="tilt-meter__title">
          <span className="mk-title">Tilt Meter · 14 derniers jours</span>
          <InfoTooltip content={TILT_TOOLTIP} size={12} />
        </div>
        {dailyKillSwitchActive && (
          <span className="tilt-meter__kill" role="alert">
            KILL SWITCH ACTIF
          </span>
        )}
      </div>

      <div
        className="tilt-meter__track"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`Tilt score ${Math.round(pct)}`}
      >
        <div className="tilt-meter__segments">
          <span className="tilt-meter__segment" data-zone="calm" />
          <span className="tilt-meter__segment" data-zone="focus" />
          <span className="tilt-meter__segment" data-zone="warn" />
          <span className="tilt-meter__segment" data-zone="tilt" />
        </div>
        <div className="tilt-meter__indicator" style={{ left: `${pct}%` }} aria-hidden="true">
          <span className="tilt-meter__indicator-dot" />
        </div>
      </div>

      <div className="tilt-meter__ticks" aria-hidden="true">
        <span>0 · Calme</span>
        <span>50 · Warning</span>
        <span>100 · Tilt</span>
      </div>

      <div className="tilt-meter__footer">
        <div>
          <span className="tilt-meter__score mono">{Math.round(pct)}</span>
          <span className="tilt-meter__score-label">/100</span>
        </div>
        <div className="tilt-meter__status">
          <span className="tilt-meter__status-label" data-tone={tone.tone}>
            {tone.label}
          </span>
          <span className="tilt-meter__status-text">{tone.text}</span>
        </div>
      </div>
    </div>
  );
}
