// ============================================================
// TESTS — utilitaires aéroports (lib/airports.ts)
// Couvre : distanceKm (grand cercle, symétrie, cas limites),
// getAirport, searchAirports.
// Lancer : npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { distanceKm, getAirport, searchAirports, AIRPORTS } from './airports';

describe('distanceKm', () => {
  it('calcule une distance grand cercle plausible (CDG-JFK ≈ 5837 km)', () => {
    const d = distanceKm('CDG', 'JFK');
    expect(d).toBeGreaterThan(5600);
    expect(d).toBeLessThan(6000);
  });

  it('est symétrique et nulle pour un même aéroport', () => {
    expect(distanceKm('CDG', 'JFK')).toBe(distanceKm('JFK', 'CDG'));
    expect(distanceKm('CDG', 'CDG')).toBe(0);
  });
});

describe('getAirport', () => {
  it('retrouve un aéroport par code IATA (insensible à la casse)', () => {
    expect(getAirport('cdg')?.city).toBe('Paris');
    expect(getAirport('XXX')).toBeUndefined();
  });
});

describe('searchAirports', () => {
  it('recherche par ville, nom ou code', () => {
    const results = searchAirports('paris');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(a => AIRPORTS.includes(a))).toBe(true);
    expect(searchAirports('JFK')[0].iata).toBe('JFK');
  });

  it('respecte la limite et renvoie vide sans correspondance', () => {
    expect(searchAirports('a', 3)).toHaveLength(3);
    expect(searchAirports('zzzzzz')).toHaveLength(0);
  });
});
