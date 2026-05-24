/**
 * marketHours.js — Détection horaires marché par classe d'asset
 * Utilisé par TickerTape, gates Sniper, et bandeau footer.
 * Tous les calculs en UTC, conversion locale gérée par Date.
 */

const ASSET_CLASS_HOURS = {
  // Indices US : NYSE/NASDAQ 09:30-16:00 ET, du lundi au vendredi
  US_INDICES: {
    timezone: 'America/New_York',
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    days: [1, 2, 3, 4, 5], // Lun-Ven
  },
  // FX : marché 24h/5j, ferme vendredi 17h ET, rouvre dimanche 17h ET
  FX: {
    timezone: 'America/New_York',
    is24h: true,
    weekClose: { day: 5, hour: 17, minute: 0 }, // Ven 17h ET
    weekOpen: { day: 0, hour: 17, minute: 0 },  // Dim 17h ET
  },
  // Crypto : 24/7
  CRYPTO: {
    is24h7: true,
  },
  // Commodities (GOLD via GLOBEX) : Dim 18h ET → Ven 17h ET, pause quotidienne 17h-18h ET
  COMMODITIES: {
    timezone: 'America/New_York',
    weekOpen: { day: 0, hour: 18, minute: 0 },
    weekClose: { day: 5, hour: 17, minute: 0 },
    dailyPause: { startHour: 17, endHour: 18 },
  },
  // Equities (positions ouvertes) : mêmes horaires que US_INDICES
  EQUITIES: {
    timezone: 'America/New_York',
    openHour: 9,
    openMinute: 30,
    closeHour: 16,
    closeMinute: 0,
    days: [1, 2, 3, 4, 5],
  },
};

/**
 * Convertit une Date en composants horaires dans une timezone donnée.
 * Utilise Intl.DateTimeFormat pour gérer DST automatiquement.
 */
function getTimeInTimezone(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = weekdayMap[parts.find(p => p.type === 'weekday').value];
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  return { weekday, hour, minute };
}

/**
 * Retourne true si le marché de la classe est ouvert maintenant.
 * @param {string} assetClass - 'US_INDICES' | 'FX' | 'CRYPTO' | 'COMMODITIES' | 'EQUITIES'
 * @param {Date} [now=new Date()] - Date de référence (pour test)
 * @returns {boolean}
 */
export function isMarketOpen(assetClass, now = new Date()) {
  const config = ASSET_CLASS_HOURS[assetClass];
  if (!config) return false;

  if (config.is24h7) return true;

  const { weekday, hour, minute } = getTimeInTimezone(now, config.timezone);
  const minutesNow = hour * 60 + minute;

  if (config.is24h) {
    // FX logic : ouvert sauf entre vendredi 17h ET et dimanche 17h ET
    if (weekday === 6) return false; // Samedi entier fermé
    if (weekday === 5 && minutesNow >= config.weekClose.hour * 60) return false;
    if (weekday === 0 && minutesNow < config.weekOpen.hour * 60) return false;
    return true;
  }

  if (config.dailyPause) {
    // Commodities logic : pause quotidienne 17h-18h ET + fermé samedi
    if (weekday === 6) return false;
    if (weekday === 5 && minutesNow >= config.weekClose.hour * 60) return false;
    if (weekday === 0 && minutesNow < config.weekOpen.hour * 60) return false;
    if (minutesNow >= config.dailyPause.startHour * 60 && minutesNow < config.dailyPause.endHour * 60) return false;
    return true;
  }

  // Standard equity hours (US_INDICES, EQUITIES)
  if (!config.days.includes(weekday)) return false;
  const openMinutes = config.openHour * 60 + config.openMinute;
  const closeMinutes = config.closeHour * 60 + config.closeMinute;
  return minutesNow >= openMinutes && minutesNow < closeMinutes;
}

/**
 * Mapping ticker → classe d'asset (pour TickerTape)
 */
export const TICKER_ASSET_CLASS = {
  // Indices US
  SPX: 'US_INDICES',
  NDX: 'US_INDICES',
  DJI: 'US_INDICES',
  RUT: 'US_INDICES',
  VIX: 'US_INDICES',
  // Crypto
  BTC: 'CRYPTO',
  ETH: 'CRYPTO',
  // FX
  'USD/CHF': 'FX',
  'EUR/USD': 'FX',
  // Commodities
  GOLD: 'COMMODITIES',
};

/**
 * Détermine la classe d'asset d'un ticker.
 * Fallback EQUITIES si le ticker n'est pas dans la map (positions ouvertes).
 */
export function getAssetClass(ticker) {
  return TICKER_ASSET_CLASS[ticker] || 'EQUITIES';
}
