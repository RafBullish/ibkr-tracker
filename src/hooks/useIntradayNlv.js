// ═══════════════════════════════════════════════════════════════
//  useIntradayNlv — writer + lecteur du buffer NLV intraday (FF-données)
//
//  WRITER (useIntradayNlvWriter, monté UNE fois dans AppShell, comme
//  useIbkrLive) : pendant la séance RTH NY uniquement (useMarketSession,
//  phase 'open'), pousse la NLV courante du store vers le buffer
//  qc:nlvIntraday. AUCUNE requête réseau : la NLV live existe déjà côté
//  store (usePortfolioMetrics — override bridge < 1 h compris). Le hook
//  tique à la minute ; la garde MIN_SAMPLE_GAP de l'util impose la
//  cadence effective ~5 min. Hors séance : zéro écriture, zéro timer
//  supplémentaire (le tick de session est le seul réveil).
//
//  LECTEUR (useIntradayNlvDays) : snapshot du buffer, re-rendu sur
//  l'événement NLV_INTRADAY_EVENT (écriture locale) et sur 'storage'
//  (autre onglet). Consommé par Héros 1 pour densifier 1D/5D.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import useMarketSession from './useMarketSession';
import { usePortfolioMetrics } from './usePortfolioMetrics';
import {
  appendIntradaySample,
  readIntradayDays,
  NLV_INTRADAY_EVENT,
  NLV_INTRADAY_KEY,
} from '../utils/nlvIntraday';
import { TIME } from '../constants/timing';

export function useIntradayNlvWriter() {
  // Tick minute : re-render léger, l'util drop tout échantillon < 4.5 min
  // après le précédent. `session` est un objet neuf à chaque tick → le
  // useEffect se ré-évalue à la minute même si la NLV n'a pas bougé
  // (courbe dense y compris sur NLV plate).
  const session = useMarketSession({ tickMs: TIME.ONE_MINUTE_MS });
  const metrics = usePortfolioMetrics();
  const nlv = metrics?.netLiquidationValueUsd;

  useEffect(() => {
    if (!session.isOpen) return; // RTH NY uniquement — jamais hors séance
    if (typeof nlv !== 'number' || !Number.isFinite(nlv) || nlv <= 0) return;
    appendIntradaySample(nlv);
  }, [session, nlv]);
}

export function useIntradayNlvDays() {
  const [days, setDays] = useState(readIntradayDays);

  useEffect(() => {
    const refresh = () => setDays(readIntradayDays());
    const onStorage = (e) => {
      if (!e || !e.key || e.key === NLV_INTRADAY_KEY) refresh();
    };
    window.addEventListener(NLV_INTRADAY_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(NLV_INTRADAY_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return days;
}
