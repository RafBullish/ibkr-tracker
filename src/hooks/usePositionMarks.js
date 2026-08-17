// ═══════════════════════════════════════════════════════════════
//  usePositionMarks — writer + lecteur du pic (qc:positionMarks, Q-C)
//
//  WRITER (usePositionMarksWriter, monté UNE fois dans AppShell, comme le
//  writer NLV intraday) : enregistre le MID DE CLÔTURE DE SESSION de chaque
//  position ouverte, UNE fois par jour de séance, pendant la phase 'after'
//  (16:00–20:00 NY, post-clôture RTH ≈ soir de Genève). JAMAIS en séance :
//  la carte impose base_pic = mid_de_cloture, intraday_ignore = true. La
//  phase 'after' n'existe que les jours de bourse → capture week-end-safe.
//  recordSessionClose est idempotent par (signature, jour) → un seul point
//  de clôture par jour même si l'app reste ouverte toute la soirée.
//
//  LIMITE ASSUMÉE : l'app doit être ouverte pendant l'after-hours NY pour
//  qu'un jour soit capturé. Le bridge V1.1 remplira la même table en
//  intraday dès le 02.09 (même schéma). D'ici là, un pic issu d'un
//  historique partiel est marqué isPartial → la porte TRAIL le dit.
//
//  LECTEUR (usePositionMarksMap) : snapshot de la carte des pics, re-rendu
//  sur l'événement d'écriture locale et sur 'storage' (autre onglet).
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import useMarketSession from './useMarketSession';
import { useOpenPositions, useSettings } from '../store/useStore';
import { positionSignature } from '../utils/positions';
import {
  recordSessionClose,
  readPositionMarks,
  POSITION_MARKS_EVENT,
  POSITION_MARKS_KEY,
} from '../utils/positionMarks';
import { TIME, FRESHNESS } from '../constants/timing';

/** Jour de séance NY ('YYYY-MM-DD') d'un instant. */
function nyDay(d) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function usePositionMarksWriter() {
  const session = useMarketSession({ tickMs: TIME.ONE_MINUTE_MS });
  const positions = useOpenPositions();
  const settings = useSettings();

  useEffect(() => {
    // Base = mid de CLÔTURE : uniquement pendant l'after-hours (post-clôture),
    // jamais en séance. La phase 'after' est intrinsèquement jour-de-bourse.
    if (session.phase !== 'after') return;
    if (!positions || positions.length === 0) return;
    const now = new Date();
    // Fraîcheur FEED-LEVEL : aucun horodatage de mark PAR POSITION n'existe,
    // donc pos.pc n'est de confiance que si le snapshot live est frais (même
    // seuil canonique que le badge LIVE / useAvailableCapital). Non frais →
    // le writer laisse un TROU (jamais de mid douteux) qui nourrit isPartial.
    const ts = settings?.ibkrLiveData?.timestamp;
    const ageMs = ts ? now.getTime() - new Date(ts).getTime() : Infinity;
    const fresh = Number.isFinite(ageMs) && ageMs >= 0 && ageMs < FRESHNESS.LIVE_DATA_MAX_AGE_MS;
    recordSessionClose(positions, {
      day: nyDay(now),
      stamp: now.toISOString(),
      sig: positionSignature,
      fresh,
    });
  }, [session, positions, settings]);
}

export function usePositionMarksMap() {
  const [marks, setMarks] = useState(readPositionMarks);

  useEffect(() => {
    const refresh = () => setMarks(readPositionMarks());
    const onStorage = (e) => {
      if (!e || !e.key || e.key === POSITION_MARKS_KEY) refresh();
    };
    window.addEventListener(POSITION_MARKS_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(POSITION_MARKS_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return marks;
}
