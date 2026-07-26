// ============================================================
// MOTEUR DE PRIX — couche provider avec interface commune.
// - SimulationProvider : prix réalistes et DÉTERMINISTES
//   (seed = route + date) pour faire tourner l'app sans clé API.
// - AmadeusProvider : stub propre, activé si AMADEUS_CLIENT_ID /
//   AMADEUS_CLIENT_SECRET présents dans l'environnement.
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

// ---------- Provider Amadeus (activé via variables d'env) ----------
export class AmadeusProvider implements PriceProvider {
  name = 'amadeus';
  private token: string | null = null;
  private tokenExpiry = 0;

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;
    const res = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=client_credentials&client_id=${process.env.AMADEUS_CLIENT_ID}&client_secret=${process.env.AMADEUS_CLIENT_SECRET}`,
    });
    if (!res.ok) throw new Error('Amadeus auth failed');
    const data = await res.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return this.token!;
  }

  async getPrice(origin: string, destination: string, departDate: string): Promise<PriceQuote> {
    const token = await this.getToken();
    const url = `https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departDate}&adults=1&nonStop=false&max=5&currencyCode=EUR`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Amadeus offers failed: ${res.status}`);
    const data = await res.json();
    const prices = (data.data || []).map((o: any) => parseFloat(o.price?.grandTotal)).filter((p: number) => p > 0);
    if (!prices.length) throw new Error('Amadeus: no offers');
    return { price: Math.min(...prices), currency: 'EUR', provider: this.name };
  }
}

// Sélection du provider actif : Amadeus si clés présentes, sinon simulation.
export function getProvider(): PriceProvider {
  if (process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET) return new AmadeusProvider();
  return new SimulationProvider();
}
