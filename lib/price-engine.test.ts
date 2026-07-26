// ============================================================
// TESTS — moteur de prix FlyDeal
// Couvre :
//  1. SimulationProvider : déterminisme, plausibilité, rampe yield.
//  2. FlightApiProvider  : construction d'URL, extraction du prix
//     le plus bas depuis une réponse réelle FlightAPI.io (fetch mocké),
//     gestion des erreurs (404/410/429, sans clé, sans offre).
//  3. getProvider() : sélection FlightAPI vs simulation selon FLY_API_KEY.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SimulationProvider,
  FlightApiProvider,
  simulatePrice,
  extractLowestPrice,
  getProvider,
} from './price-engine';

// Réponse réaliste inspirée de la doc FlightAPI.io (Oneway Trip API).
const SAMPLE_RESPONSE = {
  itineraries: [
    {
      id: 'it1',
      pricing_options: [
        { id: 'p1', price: { amount: 152.4, update_status: 'current' }, items: [] },
        { id: 'p2', price: { amount: 98.9, update_status: 'current' }, items: [] },
      ],
    },
    {
      id: 'it2',
      pricing_options: [
        { id: 'p3', price: { amount: 210.0, update_status: 'current' }, items: [] },
        { id: 'p4', price: { amount: null }, items: [] }, // à ignorer
      ],
    },
  ],
  legs: [],
  segments: [],
};

function mockFetchJson(body: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe('SimulationProvider', () => {
  const provider = new SimulationProvider();

  it('est déterministe pour une même route/date/jour', () => {
    const at = new Date('2026-07-26T10:00:00Z');
    const a = simulatePrice('LYS', 'NCE', '2026-09-10', at);
    const b = simulatePrice('LYS', 'NCE', '2026-09-10', at);
    expect(a).toBe(b);
  });

  it('renvoie un prix positif et plausible (>= 15 €)', async () => {
    const at = new Date('2026-07-26T10:00:00Z');
    const quote = await provider.getPrice('CDG', 'JFK', '2026-12-01', at);
    expect(quote.price).toBeGreaterThanOrEqual(15);
    expect(quote.currency).toBe('EUR');
    expect(quote.provider).toBe('simulation');
  });

  it('applique une rampe yield : un départ lointain coûte moins cher qu\'un départ imminent (même route)', () => {
    const at = new Date('2026-07-26T10:00:00Z');
    const lointain = simulatePrice('LYS', 'BCN', '2026-12-24', at); // J+150
    const imminent = simulatePrice('LYS', 'BCN', '2026-07-29', at); // J+3
    // Sans événement rare, la dernière minute est systématiquement plus chère.
    expect(imminent).toBeGreaterThan(lointain);
  });
});

describe('extractLowestPrice', () => {
  it('retourne le montant le plus bas parmi toutes les options', () => {
    expect(extractLowestPrice(SAMPLE_RESPONSE)).toBe(98.9);
  });

  it('retourne null si la réponse est vide ou sans itinéraire', () => {
    expect(extractLowestPrice({})).toBeNull();
    expect(extractLowestPrice({ itineraries: [] })).toBeNull();
    expect(extractLowestPrice(null)).toBeNull();
  });
});

describe('FlightApiProvider', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, FLY_API_KEY: 'test-key-123' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('construit l\'URL Oneway Trip conforme à la doc FlightAPI.io', () => {
    const p = new FlightApiProvider();
    expect(p.buildUrl('KEY', 'LYS', 'NCE', '2026-09-10')).toBe(
      'https://api.flightapi.io/onewaytrip/KEY/LYS/NCE/2026-09-10/1/0/0/Economy/EUR'
    );
  });

  it('renvoie le prix le plus bas de la réponse FlightAPI.io', async () => {
    vi.stubGlobal('fetch', mockFetchJson(SAMPLE_RESPONSE));
    const quote = await new FlightApiProvider().getPrice('LYS', 'NCE', '2026-09-10');
    expect(quote).toEqual({ price: 98.9, currency: 'EUR', provider: 'flightapi' });
    // La clé FLY_API_KEY est bien injectée dans l'URL appelée.
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/onewaytrip/test-key-123/');
  });

  it('lève une erreur explicite si FLY_API_KEY est absente', async () => {
    delete process.env.FLY_API_KEY;
    await expect(new FlightApiProvider().getPrice('LYS', 'NCE', '2026-09-10'))
      .rejects.toThrow(/FLY_API_KEY/);
  });

  it.each([404, 410])('lève une erreur "aucune offre" sur HTTP %i', async (status) => {
    vi.stubGlobal('fetch', mockFetchJson({}, status));
    await expect(new FlightApiProvider().getPrice('LYS', 'NCE', '2026-09-10'))
      .rejects.toThrow(/aucune offre/);
  });

  it('lève une erreur quota sur HTTP 429', async () => {
    vi.stubGlobal('fetch', mockFetchJson({}, 429));
    await expect(new FlightApiProvider().getPrice('LYS', 'NCE', '2026-09-10'))
      .rejects.toThrow(/429/);
  });

  it('lève une erreur si la réponse ne contient aucune offre tarifée', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ itineraries: [] }));
    await expect(new FlightApiProvider().getPrice('LYS', 'NCE', '2026-09-10'))
      .rejects.toThrow(/sans offre/);
  });
});

describe('getProvider', () => {
  const OLD_ENV = process.env;
  afterEach(() => { process.env = OLD_ENV; });

  it('sélectionne FlightApiProvider quand FLY_API_KEY est définie', () => {
    process.env = { ...OLD_ENV, FLY_API_KEY: 'abc' };
    expect(getProvider().name).toBe('flightapi');
  });

  it('retombe sur la simulation sans clé', () => {
    process.env = { ...OLD_ENV };
    delete process.env.FLY_API_KEY;
    expect(getProvider().name).toBe('simulation');
  });
});
