// ============================================================
// TESTS — deal score (lib/deal-score.ts), ciblés sur le
// sous-score « Prix par km » : currentPrice est un TOTAL
// groupe/trajet, la médiane de référence est par personne et par
// trajet simple — le prix doit être normalisé par le nombre de
// voyageurs et par 2 pour un aller-retour.
// Lancer : npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { computeDealScore, DealScoreInput } from './deal-score';

const NOW = new Date('2026-07-01T12:00:00Z');

function input(overrides: Partial<DealScoreInput> = {}): DealScoreInput {
  return {
    currentPrice: 320,
    history: [],
    distanceKm: 1000,
    departDate: '2026-08-15',
    now: NOW,
    ...overrides,
  };
}

function perkm(i: DealScoreInput) {
  return computeDealScore(i).components.find(c => c.key === 'perkm')!;
}

describe('deal-score — sous-score €/km normalisé', () => {
  it('par défaut : prix traité comme 1 voyageur, aller simple', () => {
    const c = perkm(input());
    // 320 € / 1000 km = 32 c€/km → ratio 2 vs médiane 16 c€/km → score 0.
    expect(c.detail).toContain('32.0 c€/km');
    expect(c.value).toBe(0);
  });

  it('divise par le nombre de voyageurs', () => {
    const c = perkm(input({ travelers: 2 }));
    // 320 / 2 = 160 € par personne → 16 c€/km = médiane → score 50.
    expect(c.detail).toContain('16.0 c€/km');
    expect(c.value).toBe(50);
  });

  it('divise par 2 pour un aller-retour', () => {
    const c = perkm(input({ roundTrip: true }));
    expect(c.detail).toContain('16.0 c€/km');
    expect(c.value).toBe(50);
  });

  it('groupe + aller-retour : les deux divisions se combinent', () => {
    const c = perkm(input({ travelers: 2, roundTrip: true }));
    // 320 / 2 voyageurs / 2 trajets = 80 € → 8 c€/km → ratio 0.5 → score 100.
    expect(c.detail).toContain('8.0 c€/km');
    expect(c.value).toBe(100);
  });

  it('le détail explicite la normalisation (par personne et par trajet)', () => {
    expect(perkm(input({ travelers: 3 })).detail).toContain('par personne et par trajet');
  });
});

describe('deal-score — structure du résultat', () => {
  it('retourne 5 composantes pondérées et un verdict cohérent', () => {
    const r = computeDealScore(input());
    expect(r.components).toHaveLength(5);
    expect(r.components.reduce((s, c) => s + c.weight, 0)).toBeCloseTo(1);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(['good', 'ok', 'bad']).toContain(r.verdict);
    expect(r.confidence).toBe('low'); // pas d'historique
  });

  it('confiance « high » avec un historique fourni', () => {
    const history = Array.from({ length: 60 }, (_, i) => ({
      price: 300 + i,
      checked_at: new Date(NOW.getTime() - (60 - i) * 3600000).toISOString(),
    }));
    expect(computeDealScore(input({ history })).confidence).toBe('high');
  });
});
