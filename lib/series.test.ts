// ============================================================
// TESTS — regroupement des relevés en séries (lib/series.ts) et
// exactitude des tactiques (lib/tactics.ts).
// Garantit que :
//  - une série = une route + une date de départ, sans mélange ;
//  - la série principale correspond à la route/date cible ;
//  - les tactiques n'affichent des économies que depuis des
//    relevés réels, jamais de chiffres fabriqués.
// Lancer : npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import { groupPricesBySeries, getPrimarySeriesPoints, primarySeriesKey, seriesKey } from './series';
import { computeTactics } from './tactics';
import type { PricePoint, Watch } from './db';

function mkWatch(overrides: Partial<Watch> = {}): Watch {
  return {
    id: 1,
    origins: ['CDG'],
    destinations: ['JFK'],
    depart_date: '2026-09-10',
    flex_days: 2,
    trip: 'one-way',
    return_date: null,
    adults: 1,
    children: 0,
    infants: 0,
    seat: 'economy',
    created_at: '2026-07-01 00:00:00',
    last_checked_at: null,
    next_check_at: null,
    ...overrides,
  };
}

let pid = 0;
function mkPoint(origin: string, destination: string, departDate: string, price: number, checkedAt: string): PricePoint {
  return { id: ++pid, watch_id: 1, origin, destination, depart_date: departDate, price, checked_at: checkedAt };
}

describe('seriesKey / primarySeriesKey', () => {
  it('construit une clé route + date', () => {
    expect(seriesKey('CDG', 'JFK', '2026-09-10')).toBe('CDG|JFK|2026-09-10');
    expect(primarySeriesKey(mkWatch())).toBe('CDG|JFK|2026-09-10');
  });
});

describe('groupPricesBySeries', () => {
  it('sépare les routes et les dates sans mélanger les prix', () => {
    const prices = [
      mkPoint('CDG', 'JFK', '2026-09-10', 500, '2026-07-25 02:00:00'),
      mkPoint('CDG', 'JFK', '2026-09-11', 450, '2026-07-25 02:00:00'), // date flexible
      mkPoint('ORY', 'JFK', '2026-09-10', 470, '2026-07-25 02:00:00'), // autre origine
      mkPoint('CDG', 'JFK', '2026-09-10', 480, '2026-07-26 02:00:00'),
    ];
    const series = groupPricesBySeries(prices, 'CDG|JFK|2026-09-10');
    expect(series).toHaveLength(3);
    const primary = series.find(s => s.key === 'CDG|JFK|2026-09-10')!;
    expect(primary.points.map(p => p.price)).toEqual([500, 480]);
    // La série principale est triée en premier.
    expect(series[0].key).toBe('CDG|JFK|2026-09-10');
  });

  it('retourne une liste vide sans relevés', () => {
    expect(groupPricesBySeries([])).toEqual([]);
  });
});

describe('getPrimarySeriesPoints', () => {
  it('ne retient que la route et la date cible', () => {
    const prices = [
      mkPoint('CDG', 'JFK', '2026-09-10', 500, '2026-07-25 02:00:00'),
      mkPoint('CDG', 'JFK', '2026-09-09', 450, '2026-07-25 02:00:00'),
      mkPoint('ORY', 'JFK', '2026-09-10', 470, '2026-07-25 02:00:00'),
    ];
    const primary = getPrimarySeriesPoints(mkWatch(), prices);
    expect(primary).toHaveLength(1);
    expect(primary[0].price).toBe(500);
  });
});

describe('computeTactics — exactitude des données', () => {
  it('dates flexibles : compare uniquement les prix réellement relevés', () => {
    const w = mkWatch();
    const prices = [
      mkPoint('CDG', 'JFK', '2026-09-10', 500, '2026-07-25 02:00:00'), // date cible
      mkPoint('CDG', 'JFK', '2026-09-09', 420, '2026-07-25 02:00:00'),
      mkPoint('CDG', 'JFK', '2026-09-11', 610, '2026-07-25 02:00:00'),
    ];
    const tactics = computeTactics(w, prices, 500);
    const flex = tactics.find(t => t.id === 'flex-dates')!;
    expect(flex.source).toBe('observed');
    expect(flex.estimatedSavings).toBe(80); // 500 - 420, relevés réels
    expect(flex.detail).toHaveLength(3);
    expect(flex.detail!.every(d => d.price !== null)).toBe(true);
  });

  it('dates flexibles : aucun chiffre projeté sans relevé sur les dates voisines', () => {
    const w = mkWatch();
    const prices = [mkPoint('CDG', 'JFK', '2026-09-10', 500, '2026-07-25 02:00:00')];
    const tactics = computeTactics(w, prices, 500);
    const flex = tactics.find(t => t.id === 'flex-dates')!;
    expect(flex.source).toBe('method');
    expect(flex.estimatedSavings).toBeNull();
  });

  it('aucune tactique "méthode" n\'annonce d\'économie chiffrée inventée', () => {
    const w = mkWatch();
    const tactics = computeTactics(w, [], 500);
    for (const t of tactics) {
      if (t.source === 'method') {
        expect(t.estimatedSavings).toBeNull();
        expect(t.savingsPct).toBeNull();
      }
    }
    // Multi-devises : plus de "6 %" fabriqué.
    const pos = tactics.find(t => t.id === 'pos-currency')!;
    expect(pos.estimatedSavings).toBeNull();
    // Aller-retour vs 2 allers : plus de comparaison incohérente.
    const mix = tactics.find(t => t.id === 'oneway-mix')!;
    expect(mix.estimatedSavings).toBeNull();
  });

  it('error fare : détectée uniquement sur la série principale', () => {
    const w = mkWatch();
    const prices: PricePoint[] = [];
    // 9 relevés autour de 500 + un relevé très bas sur la route cible.
    for (let i = 0; i < 9; i++) prices.push(mkPoint('CDG', 'JFK', '2026-09-10', 500 + i, `2026-07-1${i} 02:00:00`));
    prices.push(mkPoint('CDG', 'JFK', '2026-09-10', 180, '2026-07-19 02:00:00'));
    // Un prix très bas sur une AUTRE date ne doit pas déclencher l'alerte seul.
    prices.push(mkPoint('CDG', 'JFK', '2026-09-11', 150, '2026-07-19 02:00:00'));
    const tactics = computeTactics(w, prices, 505);
    const ef = tactics.find(t => t.id === 'error-fare');
    expect(ef).toBeDefined();
    expect(ef!.source).toBe('observed');
    expect(ef!.description).toContain('180');
  });
});
