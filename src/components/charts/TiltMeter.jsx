// ═══════════════════════════════════════════════════════════════
//  TILT METER v3.0 « Midnight Terminal »
//
//  Horizontal gauge "Calme → Tilt" per brief §10. Score 0-100
//  computed from recent journal-entry violations (fomo, revenge,
//  overtrading, early_exit, manque_de_discipline) over the last
//  14 days.
//
//  Thresholds:
//    0-25   calm      (profit tone)
//    25-50  focused   (accent tone)
//    50-75  warning   (warning tone)
//    75-100 tilt      (loss tone, pulsing)
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
          <span className="uppercase-label">Tilt Meter · 14 derniers jours</span>
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
