// ============================================================
// TESTS — âge relatif des relevés (lib/relative-age.ts)
// Formats acceptés : ISO et SQLite UTC ("YYYY-MM-DD HH:MM:SS").
// Lancer : npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { relativeAge, ageMs, stalePricesMessage } from './relative-age';

const NOW = new Date('2026-07-01T12:00:00Z').getTime();

describe('relativeAge', () => {
  it('formate les âges en français', () => {
    expect(relativeAge('2026-07-01T11:59:40Z', NOW)).toBe('à l’instant');
    expect(relativeAge('2026-07-01T11:48:00Z', NOW)).toBe('il y a 12 min');
    expect(relativeAge('2026-07-01T09:00:00Z', NOW)).toBe('il y a 3 h');
    expect(relativeAge('2026-06-29T12:00:00Z', NOW)).toBe('il y a 2 j');
  });

  it('accepte le format SQLite UTC ("YYYY-MM-DD HH:MM:SS")', () => {
    expect(relativeAge('2026-07-01 09:00:00', NOW)).toBe('il y a 3 h');
  });

  it('une date future ou invalide donne « à l’instant »', () => {
    expect(relativeAge('2026-07-02T12:00:00Z', NOW)).toBe('à l’instant');
    expect(relativeAge('pas une date', NOW)).toBe('à l’instant');
  });
});

describe('ageMs', () => {
  it('mesure l\'âge en millisecondes, borné à 0', () => {
    expect(ageMs('2026-07-01T09:00:00Z', NOW)).toBe(3 * 3600000);
    expect(ageMs('2026-07-02T00:00:00Z', NOW)).toBe(0);
    expect(ageMs('invalide', NOW)).toBe(0);
  });
});

describe('stalePricesMessage (bannière scraper en échec)', () => {
  it('formulation correcte : « dernière actualisation réussie : il y a 3 h »', () => {
    const msg = stalePricesMessage('2026-07-01T09:00:00Z', NOW);
    expect(msg).toBe(
      "Les prix n'ont pas pu être actualisés — dernière actualisation réussie : il y a 3 h — les montants affichés peuvent être périmés."
    );
    // Jamais le solécisme « depuis il y a ».
    expect(msg).not.toContain('depuis il y a');
  });

  it('sans dernier succès connu : message neutre', () => {
    expect(stalePricesMessage(null, NOW)).toBe(
      "Les prix n'ont pas pu être actualisés pour le moment — les montants affichés peuvent être périmés."
    );
  });
});
