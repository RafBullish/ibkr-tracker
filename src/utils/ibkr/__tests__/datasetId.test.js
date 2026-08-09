// ═══════════════════════════════════════════════════════════════
//  datasetId — identité stable d'un relevé Flex (chantier NLV).
//  Verrous : stabilité du hash (même contenu → même id, ré-import =
//  même dataset), sensibilité au contenu, format, fallbacks.
// ═══════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  hashCsvContent,
  buildDatasetId,
  DATASET_UNKNOWN_ACCOUNT,
  DATASET_UNKNOWN_PERIOD,
} from '../datasetId';

describe('hashCsvContent', () => {
  it('stable : même contenu → même hash 8 hex', () => {
    const h1 = hashCsvContent('a,b,c\n1,2,3');
    const h2 = hashCsvContent('a,b,c\n1,2,3');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{8}$/);
  });

  it('sensible au contenu : un octet de différence → hash différent', () => {
    expect(hashCsvContent('a,b,c\n1,2,3')).not.toBe(hashCsvContent('a,b,c\n1,2,4'));
  });

  it('entrées dégénérées : vide/null → hash déterministe, pas de crash', () => {
    expect(hashCsvContent('')).toMatch(/^[0-9a-f]{8}$/);
    expect(hashCsvContent(null)).toBe(hashCsvContent(''));
  });
});

describe('buildDatasetId', () => {
  it('format compte:période:hash, dates normalisées sans tirets', () => {
    const id = buildDatasetId({
      accountId: 'U23437309',
      fromDate: '2025-08-08',
      toDate: '2026-08-07',
      hash: 'a1b2c3d4',
    });
    expect(id).toBe('U23437309:20250808-20260807:a1b2c3d4');
  });

  it('deux CSV du MÊME compte mais de périodes différentes → datasets distincts', () => {
    const real = buildDatasetId({ accountId: 'U23437309', fromDate: '20250808', toDate: '20260807', hash: 'aaaaaaaa' });
    const test = buildDatasetId({ accountId: 'U23437309', fromDate: '20260101', toDate: '20260731', hash: 'bbbbbbbb' });
    expect(real).not.toBe(test);
  });

  it('fallbacks honnêtes quand le CSV ne porte pas l’identité', () => {
    const id = buildDatasetId({ accountId: '', fromDate: '', toDate: '', hash: 'deadbeef' });
    expect(id).toBe(`${DATASET_UNKNOWN_ACCOUNT}:${DATASET_UNKNOWN_PERIOD}:deadbeef`);
  });
});
