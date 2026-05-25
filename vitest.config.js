// ═══════════════════════════════════════════════════════════════
//  Vitest configuration — A1.5 characterisation suite.
//  Node environment ; the suite covers pure modules in src/utils
//  (no DOM, no React). Coverage is OFF for now — A2 will decide
//  whether to bolt it on.
// ═══════════════════════════════════════════════════════════════

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.js'],
  },
});
