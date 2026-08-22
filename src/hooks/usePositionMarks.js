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

/**
 * Addendum 2 n°1 — la porte juge la fraîcheur de la SOURCE du chiffre
 * qu'elle enregistre. `pos.pc` n'a AUCUN producteur quotes dans l'app
 * (UPDATE_LIVE_PRICE : 0 dispatcheur) : sa source réelle est l'IMPORT de
 * rapport (Flex/CSV), horodaté par `settings.pcSyncedAt` au moment où les
 * marks sont écrits. Seuil 5 min (PC_SOURCE_MAX_AGE_MS) : un mid de
 * clôture vieux de 59 min n'est pas un mid de clôture — 1 h abandonné.
 * `ibkrLiveData.timestamp` (bridge) n'est PLUS JAMAIS consulté ici : le
 * bridge n'est pas la source du pc (c'était le défaut Q3 — bridge frais
 * + pc périmé aurait enregistré un mid douteux comme sain). PUR, testé.
 */
export function pcSourceFresh(pcSyncedAt, nowMs) {
  if (typeof pcSyncedAt !== 'string' || !pcSyncedAt) return false;
  const t = new Date(pcSyncedAt).getTime();
  if (!Number.isFinite(t)) return false;
  const ageMs = nowMs - t;
  return ageMs >= 0 && ageMs < FRESHNESS.PC_SOURCE_MAX_AGE_MS;
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
    // Porte de fraîcheur = provenance du pc (pcSourceFresh, 5 min). Non
    // frais → le writer laisse un TROU (jamais de mid douteux) qui nourrit
    // isPartial. En pratique : l'import du soir déclenche ce writer dans
    // la foulée (le changement de state re-exécute l'effet) → capture
    // immédiate ; un vieux pc n'est plus jamais promu clôture du jour.
    const fresh = pcSourceFresh(settings?.pcSyncedAt, now.getTime());
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
