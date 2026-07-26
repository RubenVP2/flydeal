// ============================================================
// TESTS — moteur de prix FlyDeal
// Couvre :
//  1. SimulationProvider : déterminisme, plausibilité, rampe yield.
//  2. applyOptions() : multiplicateurs trajet / cabine / groupe.
//  3. FastFlightsProvider : construction d'URL conforme au contrat
//     du microservice flights-service, happy path (fetch mocké),
//     parsing du bloc `details` et gestion des erreurs (404, 502,
//     réponse sans prix, URL absente).
//  4. getProvider() : sélection fast-flights vs simulation selon
//     FAST_FLIGHTS_URL.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SimulationProvider,
  FastFlightsProvider,
  simulatePrice,
  applyOptions,
  getProvider,
  parseFlightDetails,
  DEFAULT_SEARCH_OPTIONS,
  SearchOptions,
} from './price-engine';

function mockFetchJson(body: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

// Réponse conforme au contrat flights-service (200).
const SAMPLE_RESPONSE = {
  price: 412.5,
  currency: 'EUR',
  provider: 'fast-flights',
  trip: 'round-trip',
  flights_count: 12,
};

// Bloc `details` conforme au schéma flights-service (snake_case).
const SAMPLE_DETAILS = {
  airlines: ['Air France'],
  type: 'best',
  stops: 0,
  total_duration_min: 465,
  legs: [
    {
      from_code: 'CDG',
      from_name: 'Paris Charles de Gaulle',
      to_code: 'JFK',
      to_name: 'New York John F. Kennedy',
      departure: '2026-09-10T10:35',
      arrival: '2026-09-10T13:20',
      duration_min: 465,
      plane_type: 'Boeing 777-300ER',
    },
  ],
  carbon: { emission_g: 750000, typical_g: 900000 },
};

const ROUND_TRIP: SearchOptions = {
  trip: 'round-trip', returnDate: '2026-09-24', adults: 2, children: 1, infants: 0, seat: 'economy',
};

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
    const quote = await provider.getPrice('CDG', 'JFK', '2026-12-01', DEFAULT_SEARCH_OPTIONS, at);
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

  it('applique les options de recherche au prix de base simulé', async () => {
    const at = new Date('2026-07-26T10:00:00Z');
    const base = simulatePrice('CDG', 'JFK', '2026-12-01', at);
    const quote = await provider.getPrice('CDG', 'JFK', '2026-12-01', ROUND_TRIP, at);
    expect(quote.options).toEqual(ROUND_TRIP);
    expect(quote.price).toBe(applyOptions(base, ROUND_TRIP));
  });

  it('utilise les options par défaut quand aucune n\'est fournie', async () => {
    const at = new Date('2026-07-26T10:00:00Z');
    const quote = await provider.getPrice('CDG', 'JFK', '2026-12-01', undefined, at);
    expect(quote.options).toEqual(DEFAULT_SEARCH_OPTIONS);
    expect(quote.price).toBe(simulatePrice('CDG', 'JFK', '2026-12-01', at));
  });
});

describe('applyOptions', () => {
  it('laisse le prix inchangé avec les options par défaut', () => {
    expect(applyOptions(100, DEFAULT_SEARCH_OPTIONS)).toBe(100);
  });

  it('majore un aller-retour de ×1.85', () => {
    expect(applyOptions(100, { ...DEFAULT_SEARCH_OPTIONS, trip: 'round-trip', returnDate: '2026-09-24' })).toBe(185);
  });

  it('applique les multiplicateurs de cabine', () => {
    expect(applyOptions(100, { ...DEFAULT_SEARCH_OPTIONS, seat: 'premium-economy' })).toBe(140);
    expect(applyOptions(100, { ...DEFAULT_SEARCH_OPTIONS, seat: 'business' })).toBe(220);
    expect(applyOptions(100, { ...DEFAULT_SEARCH_OPTIONS, seat: 'first' })).toBe(320);
  });

  it('pondère le groupe : adulte ×1, enfant ×0.75, bébé ×0.1', () => {
    expect(applyOptions(100, { ...DEFAULT_SEARCH_OPTIONS, adults: 2, children: 1, infants: 1 })).toBe(285);
  });

  it('combine trajet, cabine et groupe, arrondi au centime', () => {
    const opts: SearchOptions = { trip: 'round-trip', returnDate: '2026-09-24', adults: 1, children: 0, infants: 1, seat: 'first' };
    // 100 × 1.85 × 3.2 × 1.1 = 651.2
    expect(applyOptions(100, opts)).toBe(651.2);
  });
});

describe('parseFlightDetails', () => {
  it('normalise le bloc details de flights-service en camelCase', () => {
    const d = parseFlightDetails(SAMPLE_DETAILS)!;
    expect(d.airlines).toEqual(['Air France']);
    expect(d.stops).toBe(0);
    expect(d.totalDurationMin).toBe(465);
    expect(d.legs).toHaveLength(1);
    expect(d.legs[0]).toEqual({
      fromCode: 'CDG',
      fromName: 'Paris Charles de Gaulle',
      toCode: 'JFK',
      toName: 'New York John F. Kennedy',
      departure: '2026-09-10T10:35',
      arrival: '2026-09-10T13:20',
      durationMin: 465,
      planeType: 'Boeing 777-300ER',
    });
    expect(d.carbon).toEqual({ emissionG: 750000, typicalG: 900000 });
  });

  it('déduit stops et durée totale des segments si absents', () => {
    const d = parseFlightDetails({
      legs: [
        { from_code: 'CDG', from_name: 'Paris', to_code: 'MAD', to_name: 'Madrid', duration_min: 110 },
        { from_code: 'MAD', from_name: 'Madrid', to_code: 'BOG', to_name: 'Bogota', duration_min: 590 },
      ],
    })!;
    expect(d.stops).toBe(1);
    expect(d.totalDurationMin).toBe(700);
  });

  it.each([null, undefined, {}, { legs: [], airlines: [] }, 'x'])('renvoie null sans contenu exploitable : %j', (raw) => {
    expect(parseFlightDetails(raw)).toBeNull();
  });
});

describe('FastFlightsProvider', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, FAST_FLIGHTS_URL: 'http://localhost:8000' };
  });
  afterEach(() => {
    process.env = OLD_ENV;
    vi.restoreAllMocks();
  });

  it('construit l\'URL exacte du contrat flights-service (aller simple)', () => {
    const p = new FastFlightsProvider();
    expect(p.buildUrl('CDG', 'JFK', '2026-09-10', DEFAULT_SEARCH_OPTIONS)).toBe(
      'http://localhost:8000/api/v1/search?from_airport=CDG&to_airport=JFK&depart_date=2026-09-10&trip=one-way&adults=1&children=0&infants=0&seat=economy&currency=EUR&language=fr'
    );
  });

  it('construit l\'URL exacte du contrat flights-service (aller-retour)', () => {
    const p = new FastFlightsProvider();
    expect(p.buildUrl('CDG', 'JFK', '2026-09-10', ROUND_TRIP)).toBe(
      'http://localhost:8000/api/v1/search?from_airport=CDG&to_airport=JFK&depart_date=2026-09-10&return_date=2026-09-24&trip=round-trip&adults=2&children=1&infants=0&seat=economy&currency=EUR&language=fr'
    );
  });

  it('omet return_date en aller simple même si une date est présente', () => {
    const p = new FastFlightsProvider();
    const url = p.buildUrl('CDG', 'JFK', '2026-09-10', { ...DEFAULT_SEARCH_OPTIONS, returnDate: '2026-09-24' });
    expect(url).not.toContain('return_date');
  });

  it('renvoie le prix total de la réponse flights-service', async () => {
    vi.stubGlobal('fetch', mockFetchJson(SAMPLE_RESPONSE));
    const quote = await new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10', ROUND_TRIP);
    expect(quote).toEqual({ price: 412.5, currency: 'EUR', provider: 'fast-flights', options: ROUND_TRIP });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/api/v1/search?');
  });

  it('joint les détails du vol quand flights-service les fournit', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ ...SAMPLE_RESPONSE, details: SAMPLE_DETAILS }));
    const quote = await new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10', ROUND_TRIP);
    expect(quote.details?.airlines).toEqual(['Air France']);
    expect(quote.details?.legs[0].planeType).toBe('Boeing 777-300ER');
    expect(quote.details?.stops).toBe(0);
  });

  it('ignore silencieusement un bloc details inexploitable', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ ...SAMPLE_RESPONSE, details: 'corrompu' }));
    const quote = await new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10', ROUND_TRIP);
    expect(quote.details).toBeUndefined();
  });

  it('lève une erreur explicite si FAST_FLIGHTS_URL est absente', async () => {
    delete process.env.FAST_FLIGHTS_URL;
    await expect(new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10'))
      .rejects.toThrow(/FAST_FLIGHTS_URL/);
  });

  it('lève une erreur "aucune offre" sur HTTP 404', async () => {
    vi.stubGlobal('fetch', mockFetchJson({}, 404));
    await expect(new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10'))
      .rejects.toThrow(/aucune offre/);
  });

  it('lève une erreur avec le statut sur HTTP 502 (échec du scraper)', async () => {
    vi.stubGlobal('fetch', mockFetchJson({}, 502));
    await expect(new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10'))
      .rejects.toThrow(/502/);
  });

  it.each([{ price: 0 }, { price: -5 }, { price: 'abc' }, {}])('lève une erreur si la réponse est sans offre tarifée : %j', async (body) => {
    vi.stubGlobal('fetch', mockFetchJson(body));
    await expect(new FastFlightsProvider().getPrice('CDG', 'JFK', '2026-09-10'))
      .rejects.toThrow(/sans offre/);
  });
});

describe('getProvider', () => {
  const OLD_ENV = process.env;
  afterEach(() => { process.env = OLD_ENV; });

  it('sélectionne FastFlightsProvider quand FAST_FLIGHTS_URL est définie', () => {
    process.env = { ...OLD_ENV, FAST_FLIGHTS_URL: 'http://localhost:8000' };
    expect(getProvider().name).toBe('fast-flights');
  });

  it('retombe sur la simulation sans URL de service', () => {
    process.env = { ...OLD_ENV };
    delete process.env.FAST_FLIGHTS_URL;
    expect(getProvider().name).toBe('simulation');
  });
});
