// ═══════════════════════════════════════════════════════════════
//  useNlvHistory — lecteurs réactifs des magasins NLV par dataset
//  (qc:nlvCsv:* et qc:nlvDaily:*). Même patron événementiel que
//  useIntradayNlvDays : re-render sur NLV_HISTORY_EVENT (écriture
//  locale — import d'un CSV, snapshot quotidien) et sur 'storage'
//  (autre onglet). Resync au changement de dataset actif.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import {
  readCsvSeries,
  readDailySnapshots,
  NLV_HISTORY_EVENT,
  NLV_CSV_KEY_PREFIX,
  NLV_DAILY_KEY_PREFIX,
} from '../utils/nlvHistory';

function useNlvStore(datasetId, read, keyPrefix) {
  const [value, setValue] = useState(() => read(datasetId));

  useEffect(() => {
    const refresh = () => setValue(read(datasetId));
    refresh(); // resync au changement de dataset
    const onStorage = (e) => {
      if (!e || !e.key || e.key.startsWith(keyPrefix)) refresh();
    };
    window.addEventListener(NLV_HISTORY_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(NLV_HISTORY_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [datasetId, read, keyPrefix]);

  return value;
}

/** Série NAV dérivée du CSV du dataset ({source, baseCurrency, days…} | null). */
export function useCsvNavSeries(datasetId) {
  return useNlvStore(datasetId, readCsvSeries, NLV_CSV_KEY_PREFIX);
}

/** Snapshots quotidiens écrits par l'app pour le dataset (triés par date). */
export function useNlvDailySnapshots(datasetId) {
  return useNlvStore(datasetId, readDailySnapshots, NLV_DAILY_KEY_PREFIX);
}
