// ═══════════════════════════════════════════════════════════════
//  sessionWindow — fenêtre de séance courante (Héros 1 LIVE).
//  Verrouille : séance = pré→post (04:00 → 20:00 NY) du jour de bourse
//  en cours ; hors séance (week-end, nuit) → la DERNIÈRE séance.
//  Dates fixes d'août 2026 (EDT, UTC−4) — déterministe, pas d'horloge.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { sessionWindow } from '../marketPhase';

// EDT : 04:00 NY = 08:00Z · 20:00 NY = 00:00Z (jour+1).
const iso = (s) => new Date(s);

describe('sessionWindow', () => {
  it('vendredi 21.08 en séance (18:00Z = 14:00 NY) → séance du jour', () => {
    const w = sessionWindow(iso('2026-08-21T18:00:00Z'));
    expect(w.dayKey).toBe('2026-08-21');
    expect(w.startMs).toBe(Date.parse('2026-08-21T08:00:00Z'));
    expect(w.endMs).toBe(Date.parse('2026-08-22T00:00:00Z'));
  });
  it('samedi 22.08 (week-end) → la séance de VENDREDI', () => {
    const w = sessionWindow(iso('2026-08-22T14:00:00Z'));
    expect(w.dayKey).toBe('2026-08-21');
  });
  it('dimanche 23.08 → toujours vendredi', () => {
    expect(sessionWindow(iso('2026-08-23T14:00:00Z')).dayKey).toBe('2026-08-21');
  });
  it('nuit de semaine avant 04:00 NY (mardi 06:00Z = 02:00 NY) → séance de la VEILLE', () => {
    expect(sessionWindow(iso('2026-08-18T06:00:00Z')).dayKey).toBe('2026-08-17');
  });
  it('soir de semaine après 20:00 NY (mardi 01:00Z mercredi = 21:00 NY mardi) → séance de mardi', () => {
    expect(sessionWindow(iso('2026-08-19T01:00:00Z')).dayKey).toBe('2026-08-18');
  });
  it('pré-market (10:00Z = 06:00 NY) → séance du jour', () => {
    expect(sessionWindow(iso('2026-08-21T10:00:00Z')).dayKey).toBe('2026-08-21');
  });
});
