// ============================================================
// MOTEUR DE PRIX — couche provider avec interface commune.
// - SimulationProvider : prix réalistes et DÉTERMINISTES
//   (seed = route + date) pour faire tourner l'app sans clé API.
// - FlightApiProvider : prix réels via FlightAPI.io
//   (https://www.flightapi.io/), activé si FLY_API_KEY est
//   présent dans l'environnement (remplace Amadeus, dont
//   l'API Developers a été décommissionnée).
// ============================================================
import { distanceKm } from './airports';

export interface PriceQuote {
  price: number;        // € TTC aller simple
  currency: 'EUR';
  provider: string;
}

export interface PriceProvider {
  name: string;
  getPrice(origin: string, destination: string, departDate: string, at?: Date): Promise<PriceQuote>;
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
 * Génère un prix plausible pour une route/date donnée.
 * Composantes :
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
  async getPrice(origin: string, destination: string, departDate: string, at: Date = new Date()): Promise<PriceQuote> {
    return { price: simulatePrice(origin, destination, departDate, at), currency: 'EUR', provider: this.name };
  }
}

// ---------- Provider FlightAPI.io (activé via FLY_API_KEY) ----------
// Doc : https://docs.flightapi.io/flight-price-api/oneway-trip-api
// Endpoint : GET {base}/onewaytrip/{key}/{from}/{to}/{YYYY-MM-DD}/1/0/0/Economy/EUR
// Réponse : { itineraries: [{ pricing_options: [{ price: { amount } }] }], legs, segments }
// Codes erreur : 404 pas de vol/utilisateur · 410 timeout · 429 quota dépassé.
export const FLIGHTAPI_BASE_URL = 'https://api.flightapi.io';

/**
 * Extrait le prix le plus bas (€) d'une réponse Oneway Trip de FlightAPI.io.
 * Parcourt tous les itinéraires × options de prix ; ignore les montants invalides.
 */
export function extractLowestPrice(data: any): number | null {
  const amounts: number[] = [];
  for (const itin of data?.itineraries ?? []) {
    for (const opt of itin?.pricing_options ?? []) {
      const amount = Number(opt?.price?.amount);
      if (Number.isFinite(amount) && amount > 0) amounts.push(amount);
    }
  }
  return amounts.length ? Math.min(...amounts) : null;
}

export class FlightApiProvider implements PriceProvider {
  name = 'flightapi';
  private baseUrl: string;

  constructor(baseUrl: string = FLIGHTAPI_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  buildUrl(apiKey: string, origin: string, destination: string, departDate: string): string {
    return `${this.baseUrl}/onewaytrip/${apiKey}/${origin}/${destination}/${departDate}/1/0/0/Economy/EUR`;
  }

  async getPrice(origin: string, destination: string, departDate: string): Promise<PriceQuote> {
    const apiKey = process.env.FLY_API_KEY;
    if (!apiKey) throw new Error('FlightAPI: FLY_API_KEY manquante dans l\'environnement');

    const res = await fetch(this.buildUrl(apiKey, origin, destination, departDate), {
      signal: AbortSignal.timeout(30000),
    });
    if (res.status === 429) throw new Error('FlightAPI: quota dépassé (429) — ralentir la cadence ou upgrader le plan');
    if (res.status === 404 || res.status === 410) throw new Error(`FlightAPI: aucune offre pour ${origin}-${destination} le ${departDate} (${res.status})`);
    if (!res.ok) throw new Error(`FlightAPI offers failed: ${res.status}`);

    const data = await res.json();
    const price = extractLowestPrice(data);
    if (price === null) throw new Error('FlightAPI: réponse sans offre tarifée');
    return { price, currency: 'EUR', provider: this.name };
  }
}

// Sélection du provider actif : FlightAPI si FLY_API_KEY présente, sinon simulation.
export function getProvider(): PriceProvider {
  if (process.env.FLY_API_KEY) return new FlightApiProvider();
  return new SimulationProvider();
}
