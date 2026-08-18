// ═══════════════════════════════════════════════════════════════
//  SIDECAR MÉTADONNÉES DE SAISIE — Brique Q-B « la saisie »
//
//  Les métadonnées saisies à la main sur une position (earningsDate,
//  entryNote + données d'ENTRÉE — micro-brique « capture à l'entrée »)
//  vivent dans un sidecar localStorage KEYÉ PAR SIGNATURE
//  (tk|as|dir|ty|st|ex), pas par id. L'id est régénéré à chaque
//  ré-import ; la signature, elle, est stable → une annotation SURVIT
//  au ré-import du même CSV. Même patron que qc:sniperMeta, mais un
//  seul objet-carte sous une clé unique (`ibkr_u_m`).
//
//  DONNÉES D'ENTRÉE (le Flex ne les porte pas) : `midAtEntry`,
//  `bidAtEntry`, `askAtEntry` (prime + fourchette au moment de l'achat),
//  `thetaAtEntryPerDay` (θ/jour par action), `deltaAtEntry` (INDICATIF —
//  affiché, jamais jugé). Elles alimentent les portes de VIOLATION E2
//  (θ/mid ≤ registre) et E4 (spread/mid ≤ registre) — calculées sur les
//  valeurs D'ENTRÉE, jamais sur le mark courant. Noms `<x>AtEntry` =
//  convention déjà lue par violations.js / le schéma (ne pas réinventer).
//
//  earningsDate est un TRI-ÉTAT : une date 'YYYY-MM-DD' | 'AUCUN'
//  (sous-jacent sans résultats, ETF…) | null (non renseigné / legacy).
//  C'est la SEULE source de la porte P4 (câblage du gate = Q-C).
//
//  Lecture tolérante : null sur absence / JSON corrompu, jamais de throw.
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = 'ibkr_u_m';

function isBrowser() {
  return typeof window !== 'undefined' && !!window.localStorage;
}

/** Une earningsDate valide = 'AUCUN', une date 'YYYY-MM-DD', ou null. */
function sanitizeEarningsDate(v) {
  if (v === 'AUCUN') return 'AUCUN';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function sanitizeNote(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, 500);
}

// Prix/prime : nombre fini STRICTEMENT positif (0 ou négatif = invalide).
function sanitizePositiveNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}
// θ / δ : nombre fini SIGNÉ (θ souvent négatif pour du long premium ;
// δ dans [-1, 1]). Le signe est conservé ; E2 en prend la magnitude.
function sanitizeSignedNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const earningsDate = sanitizeEarningsDate(raw.earningsDate);
  const entryNote = sanitizeNote(raw.entryNote);
  const midAtEntry = sanitizePositiveNum(raw.midAtEntry);
  const bidAtEntry = sanitizePositiveNum(raw.bidAtEntry);
  const askAtEntry = sanitizePositiveNum(raw.askAtEntry);
  const thetaAtEntryPerDay = sanitizeSignedNum(raw.thetaAtEntryPerDay);
  const deltaAtEntry = sanitizeSignedNum(raw.deltaAtEntry);
  // Entrée VIDE = TOUS les champs nuls → supprimée du sidecar (une capture
  // ne portant que des données d'entrée, sans earnings ni note, DOIT survivre).
  if (
    earningsDate == null &&
    entryNote == null &&
    midAtEntry == null &&
    bidAtEntry == null &&
    askAtEntry == null &&
    thetaAtEntryPerDay == null &&
    deltaAtEntry == null
  ) {
    return null;
  }
  const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : null;
  return {
    earningsDate,
    entryNote,
    midAtEntry,
    bidAtEntry,
    askAtEntry,
    thetaAtEntryPerDay,
    deltaAtEntry,
    updatedAt,
  };
}

function readMap() {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lit la métadonnée saisie pour une signature. Renvoie
 * { earningsDate, entryNote, updatedAt } ou null (absence / corrompu /
 * tous champs nuls).
 */
export function readPositionMeta(signature) {
  if (!signature) return null;
  return sanitizeEntry(readMap()[signature]);
}

/**
 * Écrit / fusionne la métadonnée d'une signature. `patch` peut porter
 * earningsDate et/ou entryNote ; les champs absents du patch sont
 * conservés. Renvoie l'entrée finale (ou null si elle se vide).
 * `stamp` = ISO d'horodatage (fourni par l'appelant ; le module n'appelle
 * pas Date.now pour rester testable et déterministe).
 */
export function writePositionMeta(signature, patch, stamp) {
  if (!signature || !patch || typeof patch !== 'object') return null;
  const map = readMap();
  const current = sanitizeEntry(map[signature]) || {};
  const pick = (k) => (k in patch ? patch[k] : current[k]);
  const merged = {
    earningsDate: pick('earningsDate'),
    entryNote: pick('entryNote'),
    midAtEntry: pick('midAtEntry'),
    bidAtEntry: pick('bidAtEntry'),
    askAtEntry: pick('askAtEntry'),
    thetaAtEntryPerDay: pick('thetaAtEntryPerDay'),
    deltaAtEntry: pick('deltaAtEntry'),
    updatedAt: typeof stamp === 'string' ? stamp : current.updatedAt || null,
  };
  const next = sanitizeEntry(merged);
  if (next == null) {
    delete map[signature];
  } else {
    map[signature] = next;
  }
  writeMap(map);
  return next;
}

/** Carte complète { [signature]: meta } — utilisée pour ré-hydrater à l'import. */
export function readAllPositionMeta() {
  const map = readMap();
  const out = {};
  for (const sig of Object.keys(map)) {
    const meta = sanitizeEntry(map[sig]);
    if (meta) out[sig] = meta;
  }
  return out;
}
