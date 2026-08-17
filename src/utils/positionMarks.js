// ═══════════════════════════════════════════════════════════════
//  WRITER DU PIC — qc:positionMarks (Brique Q-C, pièce NEUVE).
//
//  Enregistre, par position (clé = SIGNATURE stable, jamais l'id qui est
//  régénéré au ré-import), la série des MIDS DE CLÔTURE DE SESSION — la
//  base du pic de la porte P2 (trailing). La carte est explicite :
//  base_pic = mid_de_cloture_de_session, intraday_ignore = true. Un pic
//  intraday qui armerait le trailing serait une VIOLATION de la loi, pas
//  une optimisation → on n'enregistre qu'UN mid de clôture par jour.
//
//  AMORCE (position sans historique) : pic = max(mid d'entrée, premier
//  mid de clôture observé) ; peakSince = jour où l'enregistrement a
//  commencé. Si peakSince est POSTÉRIEUR à la date d'entrée, le pic est
//  PARTIEL (on a pu manquer un pic antérieur) → isPartial=true, et la
//  porte TRAIL doit le DIRE à l'écran (jamais un seuil présenté comme
//  exact sur un pic incomplet — le fantôme qu'É3.2 a banni).
//
//  MID PAR POSITION : le client n'a PAS de bid/ask (greeksApi les rend
//  toujours null) → le seul mark observable est pos.pc (MarkPrice ≈ mid).
//  C'est le mid de clôture retenu, échantillonné à/après la clôture RTH.
//
//  Hors du store (doctrine qc:* comme qc:nlvIntraday) : télémétrie
//  observationnelle, ne touche JAMAIS les clés comptables ibkr_u_*.
//  Horloge/jour INJECTÉS par l'appelant (déterminisme des tests) — le
//  module n'appelle jamais Date.now lui-même.
//
//  ── CONTRAT DE DONNÉES forward-compatible V1.1 (table position_marks) ──
//  Le bridge remplira la même table en intraday dès le 02.09, même schéma
//  logique. DDL cible (à concevoir — absent du repo) :
//    CREATE TABLE position_marks (
//      signature   TEXT NOT NULL,       -- positionSignature(pos)
//      mark_date   DATE NOT NULL,       -- jour de séance
//      mid         REAL NOT NULL,       -- mid retenu ce jour
//      source      TEXT NOT NULL DEFAULT 'session_close', -- 'session_close' | 'intraday'
//      PRIMARY KEY (signature, mark_date)
//    );
//  Ici on n'écrit QUE des lignes source='session_close' ; le bridge
//  ajoutera 'intraday' sans changer la clé (signature, mark_date).
// ═══════════════════════════════════════════════════════════════

import { toFloat } from './math';

export const POSITION_MARKS_KEY = 'qc:positionMarks';
export const POSITION_MARKS_EVENT = 'qc:positionMarks:change';
const SCHEMA_V = 1;

function isBrowser() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Jour d'entrée d'une position (entryTs ISO, sinon di), en 'YYYY-MM-DD'. */
export function entryDayOf(pos) {
  if (pos?.entryTs) return String(pos.entryTs).slice(0, 10);
  if (pos?.di) return String(pos.di).slice(0, 10);
  return null;
}

function readRoot() {
  if (!isBrowser()) return { v: SCHEMA_V, marks: {} };
  try {
    const raw = window.localStorage.getItem(POSITION_MARKS_KEY);
    if (!raw) return { v: SCHEMA_V, marks: {} };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.marks !== 'object') {
      return { v: SCHEMA_V, marks: {} };
    }
    return { v: SCHEMA_V, marks: parsed.marks || {} };
  } catch {
    return { v: SCHEMA_V, marks: {} };
  }
}

function writeRoot(root) {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(POSITION_MARKS_KEY, JSON.stringify(root));
    if (typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(POSITION_MARKS_EVENT));
    }
    return true;
  } catch {
    return false; // quota — silencieux
  }
}

/** Carte complète { [signature]: record }. Lecture tolérante. */
export function readPositionMarks() {
  return readRoot().marks;
}

/** Enregistrement d'une position par signature, ou null. */
export function readMark(signature) {
  if (!signature) return null;
  const rec = readRoot().marks[signature];
  return rec && typeof rec === 'object' ? rec : null;
}

/**
 * Pic (pct) au-dessus du mid d'entrée d'un enregistrement, ou null.
 * pic_pct = (pic − entryMid) / entryMid. Utilisé par la porte P2.
 */
export function picPctOf(rec) {
  if (!rec) return null;
  const entryMid = toFloat(rec.entryMid);
  const pic = toFloat(rec.pic);
  if (!(entryMid > 0) || !Number.isFinite(pic)) return null;
  return (pic - entryMid) / entryMid;
}

function recomputePic(rec) {
  const entryMid = toFloat(rec.entryMid);
  let pic = entryMid;
  for (const pt of rec.series || []) {
    const m = toFloat(pt.mid);
    if (Number.isFinite(m) && m > pic) pic = m;
  }
  rec.pic = pic;
}

/**
 * Enregistre le mid de CLÔTURE de session `day` pour chaque position
 * ouverte. Idempotent par (signature, day) : un jour déjà enregistré
 * n'est jamais réécrit. Amorce le pic au premier passage.
 *
 * @param {Array<Object>} positions  positions ouvertes (as, pc, pi, di, entryTs, …)
 * @param {Object} opts
 * @param {string} opts.day    'YYYY-MM-DD' du jour de séance (fourni par l'appelant)
 * @param {string} [opts.stamp] ISO d'horodatage (fourni ; jamais Date.now interne)
 * @param {(p:Object)=>string} [opts.sig] fonction de signature (positionSignature)
 * @returns {Object} la carte marks mise à jour
 */
export function recordSessionClose(positions, opts = {}) {
  const { day, stamp = null, sig } = opts;
  if (!day || typeof sig !== 'function' || !Array.isArray(positions)) return readPositionMarks();
  const root = readRoot();
  let mutated = false;

  for (const pos of positions) {
    if (!pos || pos.as === 'Action') continue; // options seulement (portes = premium long)
    const close = toFloat(pos.pc);
    if (!(close > 0)) continue; // pas de mark exploitable
    const signature = sig(pos);
    if (!signature) continue;

    let rec = root.marks[signature];
    if (!rec || typeof rec !== 'object') {
      // AMORCE : entryMid = mid d'entrée (prime) ; pic = max(entryMid, 1er close).
      const entryMid = toFloat(pos.pi);
      const entryDay = entryDayOf(pos);
      rec = {
        entryMid: entryMid > 0 ? entryMid : close,
        entryDay,
        peakSince: day,
        series: [{ d: day, mid: close }],
        pic: 0,
        isPartial: entryDay ? day > entryDay : false,
        updatedAt: stamp,
      };
      recomputePic(rec);
      root.marks[signature] = rec;
      mutated = true;
      continue;
    }

    // Jour déjà enregistré → idempotent (on garde le 1er mid de clôture du jour).
    if ((rec.series || []).some((pt) => pt.d === day)) continue;

    rec.series = [...(rec.series || []), { d: day, mid: close }].sort((a, b) =>
      a.d < b.d ? -1 : a.d > b.d ? 1 : 0
    );
    recomputePic(rec);
    rec.updatedAt = stamp;
    mutated = true;
  }

  if (mutated) writeRoot(root);
  return root.marks;
}
