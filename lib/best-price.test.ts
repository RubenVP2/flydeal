// ============================================================
// TESTS — meilleur prix de la heatmap (lib/best-price.ts) :
// le badge « Meilleur prix » doit marquer sa source quand le
// minimum vient d'un relevé simulé ou de source inconnue.
// Lancer : npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { findBestPriceCell, bestPriceSourceLabel, PricedCell } from './best-price';

function cells(entries: [string, number, string | null][]): Map<string, PricedCell> {
  return new Map(entries.map(([key, price, provider]) => [key, { price, provider }]));
}

describe('findBestPriceCell', () => {
  it('renvoie la cellule au prix le plus bas, avec sa source', () => {
    const best = findBestPriceCell(cells([
      ['CDG|JFK::2026-09-10', 420, 'fast-flights'],
      ['CDG|JFK::2026-09-11', 380, 'simulation'],
      ['CDG|JFK::2026-09-12', 450, 'fast-flights'],
    ]));
    expect(best).toEqual({ key: 'CDG|JFK::2026-09-11', price: 380, provider: 'simulation' });
  });

  it('garde la première cellule en cas d\'égalité', () => {
    const best = findBestPriceCell(cells([
      ['a', 100, 'fast-flights'],
      ['b', 100, 'simulation'],
    ]));
    expect(best?.key).toBe('a');
  });

  it('renvoie null sans cellule', () => {
    expect(findBestPriceCell(new Map())).toBeNull();
  });
});

describe('bestPriceSourceLabel', () => {
  it('un minimum simulé est marqué « (simulé) »', () => {
    expect(bestPriceSourceLabel('simulation')).toBe('(simulé)');
  });

  it('un minimum de source inconnue (provider NULL) est marqué « (source inconnue) »', () => {
    expect(bestPriceSourceLabel(null)).toBe('(source inconnue)');
  });

  it('un minimum réel (fast-flights) n\'a pas de mention', () => {
    expect(bestPriceSourceLabel('fast-flights')).toBe('');
  });
});
