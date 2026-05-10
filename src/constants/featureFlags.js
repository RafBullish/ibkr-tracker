// ═══════════════════════════════════════════════════════════════
//  Feature Flags — UI gates exposed at build time.
//
//  All entries here are VITE_-prefixed env vars: their values land
//  in the browser bundle. Only use for UI toggles (no secrets).
//  Strict equality with 'true' so anything else (false, missing,
//  typo) reads as OFF.
// ═══════════════════════════════════════════════════════════════

export const FEATURE_GREEK_CENTER = import.meta.env.VITE_FEATURE_GREEK_CENTER === 'true';
