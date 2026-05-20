// ═══════════════════════════════════════════════════════════════
//  useMarketSession — NY regular hours (RTH 9:30-16:00 ET)
//
//  Hook minimaliste pour savoir si le marché US est ouvert maintenant
//  et calculer le délai jusqu'au prochain open. Pas de gestion des
//  holidays NYSE (jours fériés US) — c'est une approximation week-day
//  based. Suffisant pour le bloc "MARKET CLOSED · NEXT OPEN" du
//  Day P&L (4K refonte Phase B.4).
//
//  Retourne :
//    {
//      isOpen           : bool — true entre 9:30 et 16:00 ET, weekdays
//      nextOpenAt       : Date — prochaine ouverture (9:30 ET d'un jour ouvré)
//      hoursUntilOpen   : number — heures restantes avant nextOpenAt
//      minutesUntilOpen : number — minutes complémentaires (0-59)
//      phase            : 'pre' | 'open' | 'after' | 'closed'
//    }
//
//  Tick : 30 s (re-render léger). Suffisant pour un countdown h+m.
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Parse une Date "vue depuis America/New_York" : retourne weekday + minutes
// depuis minuit local NY.
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
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    minutes: parseInt(get('hour'), 10) * 60 + parseInt(get('minute'), 10),
  };
}

// Compose une Date UTC qui correspond à 9:30 ET d'une date NY donnée.
// Approche : calculer l'offset NY ↔ UTC via la différence entre la
// même instant formatée avec/sans le fuseau cible.
function nyDateToUtc(year, month, day, hourEt, minuteEt) {
  // On part de "9:30 UTC du jour {year-month-day}", puis on ajoute
  // l'offset (positif côté ouest, EST = -5, EDT = -4). On détermine
  // l'offset en mesurant la diff entre la formatée NY et UTC.
  const probe = new Date(Date.UTC(year, month - 1, day, hourEt, minuteEt));
  // Combien d'heures vaut "this instant" en ET vs en UTC ?
  const etProbe = nyParts(probe);
  const etMinutesAsUtcDay = etProbe.hour * 60 + etProbe.minute;
  const utcMinutes = hourEt * 60 + minuteEt;
  // Si ET montre une heure plus petite que UTC → ET est en retard
  // (offset négatif). L'écart en minutes = offset à ajouter au probe.
  const deltaMin = utcMinutes - etMinutesAsUtcDay;
  return new Date(probe.getTime() + deltaMin * 60_000);
}

function computeSession(now) {
  const p = nyParts(now);
  const isWeekday = p.weekday >= 1 && p.weekday <= 5;
  const openMin = 9 * 60 + 30;
  const closeMin = 16 * 60;
  const preStart = 4 * 60;
  const afterEnd = 20 * 60;

  let phase = 'closed';
  if (isWeekday) {
    if (p.minutes >= openMin && p.minutes < closeMin) phase = 'open';
    else if (p.minutes >= preStart && p.minutes < openMin) phase = 'pre';
    else if (p.minutes >= closeMin && p.minutes < afterEnd) phase = 'after';
  }
  const isOpen = phase === 'open';

  // Compute nextOpenAt : prochain 9:30 ET d'un jour ouvré (Mon-Fri),
  // après "now". Si on est aujourd'hui weekday avant 9:30 → today 9:30.
  // Sinon → on cherche le prochain jour ouvré.
  let candidate = nyDateToUtc(p.year, p.month, p.day, 9, 30);
  if (!isWeekday || p.minutes >= openMin) {
    // Avancer d'un jour jusqu'à tomber sur un weekday
    for (let i = 1; i <= 7; i++) {
      const probeUtc = new Date(candidate.getTime() + i * 86_400_000);
      const probeP = nyParts(probeUtc);
      if (probeP.weekday >= 1 && probeP.weekday <= 5) {
        candidate = nyDateToUtc(probeP.year, probeP.month, probeP.day, 9, 30);
        break;
      }
    }
  }

  const deltaMs = candidate.getTime() - now.getTime();
  const totalMin = Math.max(0, Math.floor(deltaMs / 60_000));
  const hoursUntilOpen = Math.floor(totalMin / 60);
  const minutesUntilOpen = totalMin % 60;

  return {
    isOpen,
    phase,
    nextOpenAt: candidate,
    hoursUntilOpen,
    minutesUntilOpen,
  };
}

export default function useMarketSession({ tickMs = 30_000 } = {}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);
  return computeSession(now);
}
