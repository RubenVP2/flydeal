// ============================================================
// SÉRIES DE PRIX — regroupe les relevés par route + date de
// départ. Chaque vérification enregistre un relevé par
// combinaison (origine × destination × date flexible) : sans
// regroupement, le graphique et le score mélangeaient des prix
// qui ne sont pas comparables entre eux (routes ou dates
// différentes), ce qui produisait des zigzags et des écarts.
// Une série = UNE route (aéroport départ → arrivée) pour UNE
// date de départ. C'est l'unité comparable et affichable.
// ============================================================
import { PricePoint, Watch } from './db';

export interface PriceSeries {
  key: string;           // "CDG|JFK|2026-09-10"
  origin: string;        // code IATA de l'aéroport de départ
  destination: string;   // code IATA de l'aéroport d'arrivée
  departDate: string;    // YYYY-MM-DD
  points: PricePoint[];  // relevés en ordre chronologique
}

export function seriesKey(origin: string, destination: string, departDate: string): string {
  return `${origin}|${destination}|${departDate}`;
}

/** Série "principale" d'une surveillance : 1er aéroport de départ, 1er d'arrivée, date cible. */
export function primarySeriesKey(w: Watch): string {
  return seriesKey(w.origins[0], w.destinations[0], w.depart_date);
}

/** Regroupe les relevés en séries, triées : série principale d'abord si fournie, puis par dernier relevé. */
export function groupPricesBySeries(prices: PricePoint[], primaryKey?: string): PriceSeries[] {
  const map = new Map<string, PriceSeries>();
  for (const p of prices) {
    const key = seriesKey(p.origin, p.destination, p.depart_date);
    let s = map.get(key);
    if (!s) {
      s = { key, origin: p.origin, destination: p.destination, departDate: p.depart_date, points: [] };
      map.set(key, s);
    }
    s.points.push(p); // getPrices() est déjà en ordre chrono
  }
  const series = [...map.values()];
  series.sort((a, b) => {
    if (primaryKey) {
      if (a.key === primaryKey) return -1;
      if (b.key === primaryKey) return 1;
    }
    const la = a.points[a.points.length - 1]?.checked_at ?? '';
    const lb = b.points[b.points.length - 1]?.checked_at ?? '';
    return lb.localeCompare(la);
  });
  return series;
}

/** Relevés de la série principale uniquement (base du score et des statistiques). */
export function getPrimarySeriesPoints(w: Watch, prices: PricePoint[]): PricePoint[] {
  const key = primarySeriesKey(w);
  return prices.filter(p => seriesKey(p.origin, p.destination, p.depart_date) === key);
}
