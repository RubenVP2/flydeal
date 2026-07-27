// ============================================================
// MOTEUR DE PRIX — couche provider avec interface commune.
// - SimulationProvider : prix réalistes et DÉTERMINISTES
//   (seed = route + date) pour faire tourner l'app sans service
//   externe.
// - FastFlightsProvider : prix réels via le microservice Python
//   auto-hébergé "flights-service" (fast-flights), activé si
//   FAST_FLIGHTS_URL est présent dans l'environnement
//   (remplace FlightAPI.io, qui a été abandonné).
// Les options de recherche (aller-retour, passagers, cabine)
// sont portées par SearchOptions et appliquées au prix de base
// (par personne, aller simple) via applyOptions().
// Quand flights-service fournit le bloc `details` (compagnies,
// segments, horaires, appareil, CO₂ — schéma fast-flights v3),
// il est normalisé par parseFlightDetails() et joint au quote.
// ============================================================
import { distanceKm } from './airports';

// ---------- Options de recherche ----------
export type TripType = 'one-way' | 'round-trip';
export type SeatClass = 'economy' | 'premium-economy' | 'business' | 'first';

export interface SearchOptions {
  trip: TripType;
  returnDate: string | null; // YYYY-MM-DD, requis si trip = 'round-trip'
  adults: number;
  children: number;
  infants: number;
  seat: SeatClass;
}

export const DEFAULT_SEARCH_OPTIONS: SearchOptions = {
  trip: 'one-way',
  returnDate: null,
  adults: 1,
  children: 0,
  infants: 0,
  seat: 'economy',
};

// ---------- Détails de vol (fast-flights v3, via flights-service) ----------
export interface FlightLeg {
  fromCode: string;
  fromName: string;             // nom complet de l'aéroport
  toCode: string;
  toName: string;
  departure: string | null;     // "YYYY-MM-DDTHH:MM", heure locale aéroport
  arrival: string | null;
  durationMin: number;
  planeType: string | null;     // ex. "Airbus A320"
}

export interface FlightDetails {
  airlines: string[];           // ex. ["Air France", "Vueling"]
  type: string | null;          // libellé Google Flights ("best", "cheap", …)
  stops: number;                // 0 = direct
  totalDurationMin: number;     // somme des segments (hors temps d'escale)
  legs: FlightLeg[];
  carbon: { emissionG: number | null; typicalG: number | null };
}

/** Valide et normalise le bloc `details` de flights-service (camelCase). */
export function parseFlightDetails(raw: unknown): FlightDetails | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, any>;
  const legs: FlightLeg[] = Array.isArray(r.legs)
    ? r.legs.map((l: any) => ({
        fromCode: String(l?.from_code ?? ''),
        fromName: String(l?.from_name ?? ''),
        toCode: String(l?.to_code ?? ''),
        toName: String(l?.to_name ?? ''),
        departure: typeof l?.departure === 'string' ? l.departure : null,
        arrival: typeof l?.arrival === 'string' ? l.arrival : null,
        durationMin: Number(l?.duration_min ?? 0) || 0,
        planeType: typeof l?.plane_type === 'string' ? l.plane_type : null,
      }))
    : [];
  const airlines: string[] = Array.isArray(r.airlines) ? r.airlines.map(String) : [];
  if (!legs.length && !airlines.length) return null;
  const stops = Number.isFinite(Number(r.stops)) ? Number(r.stops) : Math.max(0, legs.length - 1);
  const total = Number(r.total_duration_min);
  const emission = Number(r.carbon?.emission_g);
  const typical = Number(r.carbon?.typical_g);
  return {
    airlines,
    type: typeof r.type === 'string' ? r.type : null,
    stops,
    totalDurationMin: Number.isFinite(total) ? total : legs.reduce((s, l) => s + l.durationMin, 0),
    legs,
    carbon: {
      emissionG: Number.isFinite(emission) ? emission : null,
      typicalG: Number.isFinite(typical) ? typical : null,
    },
  };
}

export interface PriceQuote {
  price: number;        // € TTC total pour tout le groupe / trajet
  currency: 'EUR';
  provider: string;
  options: SearchOptions;
  details?: FlightDetails; // présent uniquement si le provider le fournit
}

export interface PriceProvider {
  name: string;
  getPrice(origin: string, destination: string, departDate: string, options?: SearchOptions, at?: Date): Promise<PriceQuote>;
}

// Multiplicateurs cabine (par rapport à Economy).
const SEAT_MULTIPLIERS: Record<SeatClass, number> = {
  economy: 1,
  'premium-economy': 1.4,
  business: 2.2,
  first: 3.2,
};

/**
 * Convertit un prix de base (par personne, aller simple) en prix total
 * pour tout le groupe et le trajet :
 *  - aller-retour : ×1.85,
 *  - cabine : Economy ×1 · Premium Éco ×1.4 · Affaires ×2.2 · Première ×3.2,
 *  - groupe : adultes ×1 + enfants ×0.75 + bébés ×0.1.
 */
export function applyOptions(basePrice: number, options: SearchOptions): number {
  const trip = options.trip === 'round-trip' ? 1.85 : 1;
  const seat = SEAT_MULTIPLIERS[options.seat];
  const party = options.adults + options.children * 0.75 + options.infants * 0.1;
  return Math.round(basePrice * trip * seat * party * 100) / 100;
}

// ---------- PRNG déterministe (mulberry32) ----------
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Bruit gaussien (Box-Muller) à partir du PRNG seedé.
function gauss(rng: () => number): number {
  const u = Math.max(rng(), 1e-9), v = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Génère un prix de base plausible (par personne, aller simple) pour une
 * route/date donnée. Composantes :
 *  1. Base route : fonction de la distance (coût/km dégressif) + facteur propre à la paire O/D.
 *  2. Saisonnalité : juillet-août, fêtes de fin d'année plus chers ; janvier/novembre creux.
 *  3. Rampe de hausse à l'approche du départ (yield management) : prix quasi stable >60j,
 *     hausse progressive entre J-60 et J-21, forte à J-14/J-7, très forte en dernière minute.
 *  4. Bruit journalier déterministe (~±8 %), plus fort la nuit (heures creuses des yield managers).
 *  5. Événements rares déterministes : error fare (~2 %, -55 %) ou promo flash (~4 %, -30 %).
 */
export function simulatePrice(origin: string, destination: string, departDate: string, at: Date = new Date()): number {
  const km = distanceKm(origin, destination);

  // Facteur propre à la paire O/D (popularité, concurrence) — stable dans le temps.
  const routeRng = mulberry32(hashString(`${origin}-${destination}`));
  const routeFactor = 0.85 + routeRng() * 0.4; // 0.85 → 1.25
  const lowCostShare = routeRng(); // présence de low-cost sur la route

  // Base : tarif plancher + €/km dégressif.
  let base = (28 + km * (km < 1500 ? 0.11 : km < 4000 ? 0.075 : 0.055)) * routeFactor;
  if (lowCostShare > 0.55 && km < 2500) base *= 0.75; // concurrence low-cost court/moyen-courrier

  // Saisonnalité selon le mois du départ.
  const month = new Date(departDate + 'T12:00:00Z').getUTCMonth(); // 0-11
  const seasonality = [0.88, 0.92, 0.98, 1.04, 1.06, 1.12, 1.25, 1.22, 1.02, 0.97, 0.90, 1.10][month];

  // Rampe temporelle : jours restants avant départ.
  const daysToDeparture = Math.max(0, Math.round((new Date(departDate + 'T12:00:00Z').getTime() - at.getTime()) / 86400000));
  let ramp: number;
  if (daysToDeparture >= 60) ramp = 1.0;
  else if (daysToDeparture >= 21) ramp = 1.0 + (60 - daysToDeparture) * 0.006;   // +0 à +23 %
  else if (daysToDeparture >= 14) ramp = 1.23 + (21 - daysToDeparture) * 0.02;    // +23 à +37 %
  else if (daysToDeparture >= 7) ramp = 1.37 + (14 - daysToDeparture) * 0.045;    // +37 à +69 %
  else ramp = 1.69 + (7 - daysToDeparture) * 0.09;                                 // +69 à +130 %

  // Bruit journalier déterministe (même route+date+jour de check = même bruit).
  const dayKey = at.toISOString().slice(0, 10);
  const dayRng = mulberry32(hashString(`${origin}-${destination}-${departDate}-${dayKey}`));
  let noise = 1 + gauss(dayRng) * 0.08;
  // Heure creuse (2h-5h) : léger creux supplémentaire (les yield managers recalibrent la nuit).
  const hour = at.getHours();
  if (hour >= 2 && hour < 5) noise -= 0.02;

  // Événements rares mais déterministes.
  let event = 1;
  const roll = dayRng();
  if (roll < 0.02) event = 0.45;        // error fare (~-55 %)
  else if (roll < 0.06) event = 0.70;   // promo flash (~-30 %)

  const price = base * seasonality * ramp * noise * event;
  return Math.max(15, Math.round(price * 100) / 100);
}

export class SimulationProvider implements PriceProvider {
  name = 'simulation';
  async getPrice(
    origin: string,
    destination: string,
    departDate: string,
    options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
    at: Date = new Date(),
  ): Promise<PriceQuote> {
    return {
      price: applyOptions(simulatePrice(origin, destination, departDate, at), options),
      currency: 'EUR',
      provider: this.name,
      options,
    };
  }
}

// ---------- Provider fast-flights (microservice Python auto-hébergé) ----------
// Contrat : GET {FAST_FLIGHTS_URL}/api/v1/search?from_airport=CDG&to_airport=JFK
//   &depart_date=2026-09-10&return_date=2026-09-24&trip=round-trip&adults=2
//   &children=1&infants=0&seat=economy&currency=EUR&language=fr
// 200 → { "price": 412.5, "currency": "EUR", "provider": "fast-flights",
//         "flights_count": 12, "details": { airlines, legs, stops, carbon, … } }
// 404 → aucun vol trouvé · 4xx → paramètres invalides · 502 → échec du scraper.
// return_date est omis pour un aller simple ; requis pour un aller-retour.
/**
 * Erreur « aucune offre » (HTTP 404 du service) : le scraper a RÉPONDU,
 * il n'y a simplement pas de vol pour cette route/date. À distinguer
 * d'une panne (timeout, 5xx) qui, elle, doit dégrader le statut scraper.
 */
export class NoOfferError extends Error {
  readonly code = 'NO_OFFER';
}

export class FastFlightsProvider implements PriceProvider {
  name = 'fast-flights';
  private baseUrl: string | undefined;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.FAST_FLIGHTS_URL;
  }

  buildUrl(origin: string, destination: string, departDate: string, options: SearchOptions): string {
    const url = new URL('/api/v1/search', this.baseUrl ?? 'http://__missing__');
    url.searchParams.set('from_airport', origin);
    url.searchParams.set('to_airport', destination);
    url.searchParams.set('depart_date', departDate);
    if (options.trip === 'round-trip' && options.returnDate) {
      url.searchParams.set('return_date', options.returnDate);
    }
    url.searchParams.set('trip', options.trip);
    url.searchParams.set('adults', String(options.adults));
    url.searchParams.set('children', String(options.children));
    url.searchParams.set('infants', String(options.infants));
    url.searchParams.set('seat', options.seat);
    url.searchParams.set('currency', 'EUR');
    url.searchParams.set('language', 'fr');
    return url.toString();
  }

  async getPrice(
    origin: string,
    destination: string,
    departDate: string,
    options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
  ): Promise<PriceQuote> {
    if (!this.baseUrl) throw new Error('flights-service: FAST_FLIGHTS_URL manquante dans l\'environnement');

    const res = await fetch(this.buildUrl(origin, destination, departDate, options), {
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 404) throw new NoOfferError(`flights-service: aucune offre pour ${origin}-${destination} le ${departDate}`);
    if (!res.ok) throw new Error(`flights-service: recherche échouée (${res.status})`);

    const data = await res.json();
    const price = Number(data?.price);
    if (!Number.isFinite(price) || price <= 0) throw new Error('flights-service: réponse sans offre tarifée');
    const quote: PriceQuote = { price, currency: 'EUR', provider: this.name, options };
    // Détails du vol le moins cher (compagnies, segments, horaires, CO₂) —
    // absents des anciennes versions du service : la clé n'est ajoutée
    // que si le bloc est présent et exploitable.
    const details = parseFlightDetails(data?.details);
    if (details) quote.details = details;
    return quote;
  }
}

// Sélection du provider actif : flights-service si FAST_FLIGHTS_URL présente, sinon simulation.
export function getProvider(): PriceProvider {
  if (process.env.FAST_FLIGHTS_URL) return new FastFlightsProvider();
  return new SimulationProvider();
}
