// ═══════════════════════════════════════════════════════════════
//  marketPhase — phase NY + prochaine transition RTH (v1.0 · 1.C)
//
//  Adapté de l'utilitaire de countdown du Premarket (nextPhase,
//  PreMarketBriefing.jsx — résolution minute) et de la mécanique de
//  cible datée de useMarketSession (nyDateToUtc, saut des week-ends),
//  combinés pour le Market Deck : phase 4 états + cible en epoch →
//  compte à rebours H:MM:SS.
//
//  Phases (heures New York) : pre 04:00-09:30 · open 09:30-16:00 ·
//  after 16:00-20:00 · closed sinon (week-end inclus).
//  Cible : phase open → la CLÔTURE RTH (16:00) ; toute autre phase →
//  la prochaine OUVERTURE RTH (09:30 d'un jour ouvré).
// ═══════════════════════════════════════════════════════════════

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nyParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    weekday: WEEKDAYS.indexOf(get('weekday')),
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

// Compose une Date UTC correspondant à {h:m} heure de New York d'un jour
// donné (technique offset-probe de useMarketSession).
function nyDateToUtc(year, month, day, hourEt, minuteEt) {
  const probe = new Date(Date.UTC(year, month - 1, day, hourEt, minuteEt));
  const etProbe = nyParts(probe);
  const etMinutes = etProbe.minutes;
  const utcMinutes = hourEt * 60 + minuteEt;
  const deltaMin = utcMinutes - etMinutes;
  return new Date(probe.getTime() + deltaMin * 60_000);
}

/**
 * @returns {{ phase: 'pre'|'open'|'after'|'closed',
 *             targetKind: 'open'|'close',
 *             targetMs: number,
 *             nyLabel: string }}
 */
export function computeMarketPhase(now = new Date()) {
  const p = nyParts(now);
  const isWeekday = p.weekday >= 1 && p.weekday <= 5;
  const OPEN = 9 * 60 + 30;
  const CLOSE = 16 * 60;
  const PRE = 4 * 60;
  const AFTER_END = 20 * 60;

  let phase = 'closed';
  if (isWeekday) {
    if (p.minutes >= OPEN && p.minutes < CLOSE) phase = 'open';
    else if (p.minutes >= PRE && p.minutes < OPEN) phase = 'pre';
    else if (p.minutes >= CLOSE && p.minutes < AFTER_END) phase = 'after';
  }

  let target;
  let targetKind;
  if (phase === 'open') {
    targetKind = 'close';
    target = nyDateToUtc(p.year, p.month, p.day, 16, 0);
  } else {
    targetKind = 'open';
    // Prochaine 09:30 NY d'un jour OUVRÉ après `now`.
    let candidate = isWeekday && p.minutes < OPEN ? nyDateToUtc(p.year, p.month, p.day, 9, 30) : null;
    if (!candidate) {
      for (let i = 1; i <= 7; i += 1) {
        const probe = new Date(now.getTime() + i * 86_400_000);
        const pp = nyParts(probe);
        if (pp.weekday >= 1 && pp.weekday <= 5) {
          candidate = nyDateToUtc(pp.year, pp.month, pp.day, 9, 30);
          break;
        }
      }
    }
    target = candidate;
  }

  const nyLabel = new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);

  return { phase, targetKind, targetMs: target ? target.getTime() : null, nyLabel };
}

/** Formate un delta ms en « H:MM:SS » (heures non paddées, cf. brief). */
export function formatCountdown(deltaMs) {
  if (deltaMs == null || !Number.isFinite(deltaMs) || deltaMs < 0) return '—';
  const totalSec = Math.floor(deltaMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
