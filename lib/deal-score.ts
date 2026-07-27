// ============================================================
// ALGORITHME DEAL SCORE — cœur du produit.
// Combine 5 signaux en un score composite 0-100 :
//  1. Z-score du prix actuel vs moyenne mobile 30 jours.
//  2. Percentile historique du prix actuel.
//  3. Prix normalisé €/km vs médiane de référence.
//  4. Tendance 7 jours (régression linéaire sur l'historique).
//  5. Jours restants vs "sweet spot" d'achat (fenêtre optimale).
// Chaque signal produit un sous-score 0-100, pondéré puis sommé.
// Le verdict découle du score : 🟢 ≥65 / 🟡 40-64 / 🔴 <40.
// ============================================================

export interface DealScoreInput {
  currentPrice: number;        // prix actuel (€) — total groupe/trajet
  history: { price: number; checked_at: string }[]; // historique complet (ordre chrono)
  distanceKm: number;          // distance de la route (aller simple)
  departDate: string;          // YYYY-MM-DD
  travelers?: number;          // nb total de voyageurs (défaut 1) — pour normaliser le €/km
  roundTrip?: boolean;         // aller-retour (défaut false) — idem
  now?: Date;
}

export interface DealScoreResult {
  score: number;               // 0-100
  verdict: 'good' | 'ok' | 'bad';
  verdictLabel: string;
  confidence: 'low' | 'medium' | 'high';
  dropProbability: number;     // probabilité estimée de baisse future (0-1)
  components: { key: string; label: string; value: number; weight: number; detail: string }[];
}

// Médiane empirique €/km longue distance (référence interne).
const MEDIAN_EUR_PER_KM = 0.16;

function percentile(sorted: number[], v: number): number {
  let count = 0;
  for (const x of sorted) if (x <= v) count++;
  return sorted.length ? count / sorted.length : 0.5;
}

function linRegSlope(points: { x: number; y: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let num = 0, den = 0;
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den === 0 ? 0 : num / den;
}

// Transforme un z en sous-score : z=-2 (très bon marché) → 100, z=+2 → 0.
const zToScore = (z: number) => Math.max(0, Math.min(100, 50 - z * 25));

export function computeDealScore(input: DealScoreInput): DealScoreResult {
  const now = input.now ?? new Date();
  const prices = input.history.map(h => h.price);
  const components: DealScoreResult['components'] = [];

  // --- 1. Z-score vs moyenne mobile 30 jours (poids 30 %) ---
  const cutoff = now.getTime() - 30 * 86400000;
  const recent = input.history.filter(h => new Date(h.checked_at).getTime() >= cutoff).map(h => h.price);
  const sample = recent.length >= 5 ? recent : prices;
  const mean = sample.reduce((s, p) => s + p, 0) / Math.max(1, sample.length);
  const sd = Math.sqrt(sample.reduce((s, p) => s + (p - mean) ** 2, 0) / Math.max(1, sample.length)) || mean * 0.05 || 1;
  const z = (input.currentPrice - mean) / sd;
  components.push({
    key: 'zscore', label: 'Position vs moyenne 30 j', weight: 0.30, value: zToScore(z),
    detail: `Z-score ${z.toFixed(2)} (moyenne ${mean.toFixed(0)} €, σ ${sd.toFixed(0)} €)`,
  });

  // --- 2. Percentile historique (poids 25 %) ---
  const sorted = [...prices].sort((a, b) => a - b);
  const pct = percentile(sorted, input.currentPrice); // 0 = prix le plus bas jamais vu
  const pctScore = Math.max(0, Math.min(100, (1 - pct) * 100));
  components.push({
    key: 'percentile', label: 'Percentile historique', weight: 0.25, value: pctScore,
    detail: `Plus cher que ${Math.round(pct * 100)} % des relevés`,
  });

  // --- 3. Prix normalisé €/km (poids 15 %) ---
  // currentPrice est le TOTAL du groupe et du trajet alors que
  // MEDIAN_EUR_PER_KM est calibrée par personne et par trajet simple :
  // on normalise donc par le nombre de voyageurs et par 2 pour un
  // aller-retour. Choix conservateur : on compte chaque voyageur
  // (enfant/bébé inclus) pour 1, sans appliquer les rabais jeunes —
  // approximation simple, documentée ; le €/km résultant est légèrement
  // optimiste pour les groupes avec enfants.
  const travelers = Math.max(1, Math.round(input.travelers ?? 1));
  const legs = input.roundTrip ? 2 : 1;
  const perPersonPerLeg = input.currentPrice / travelers / legs;
  const eurPerKm = perPersonPerLeg / Math.max(1, input.distanceKm);
  const ratio = eurPerKm / MEDIAN_EUR_PER_KM; // 1 = médiane
  const kmScore = Math.max(0, Math.min(100, 100 - (ratio - 0.5) * 100));
  components.push({
    key: 'perkm', label: 'Prix par km', weight: 0.15, value: kmScore,
    detail: `${(eurPerKm * 100).toFixed(1)} c€/km (par personne et par trajet) vs médiane ${(MEDIAN_EUR_PER_KM * 100).toFixed(0)} c€/km`,
  });

  // --- 4. Tendance 7 jours, régression linéaire (poids 20 %) ---
  const cutoff7 = now.getTime() - 7 * 86400000;
  const week = input.history.filter(h => new Date(h.checked_at).getTime() >= cutoff7);
  const trendPts = week.map(h => ({ x: new Date(h.checked_at).getTime() / 86400000, y: h.price }));
  const slope = linRegSlope(trendPts); // €/jour
  // Hausse de 5 €/jour → score 0 ; baisse de 5 €/jour → score 100.
  const trendScore = Math.max(0, Math.min(100, 50 - slope * 10));
  components.push({
    key: 'trend', label: 'Tendance 7 jours', weight: 0.20, value: trendScore,
    detail: slope >= 0 ? `+${slope.toFixed(2)} €/jour (hausse)` : `${slope.toFixed(2)} €/jour (baisse)`,
  });

  // --- 5. Sweet spot d'achat (poids 10 %) ---
  // Heuristique : fenêtre optimale d'achat entre J-60 et J-21. Trop tard = pénalité forte.
  const daysLeft = Math.round((new Date(input.departDate + 'T12:00:00Z').getTime() - now.getTime()) / 86400000);
  let spotScore: number;
  if (daysLeft > 90) spotScore = 55;              // trop tôt, grilles pas toutes ouvertes
  else if (daysLeft >= 21) spotScore = 100;       // fenêtre idéale
  else if (daysLeft >= 14) spotScore = 65;
  else if (daysLeft >= 7) spotScore = 40;
  else spotScore = 15;                             // dernière minute : quasi toujours cher
  components.push({
    key: 'timing', label: 'Fenêtre d\'achat', weight: 0.10, value: spotScore,
    detail: daysLeft >= 0 ? `J-${daysLeft} avant départ` : 'Départ passé',
  });

  // --- Score composite ---
  const score = Math.round(components.reduce((s, c) => s + c.value * c.weight, 0));

  // Confiance : fonction de la quantité d'historique disponible.
  const confidence: DealScoreResult['confidence'] =
    prices.length >= 60 ? 'high' : prices.length >= 15 ? 'medium' : 'low';

  // Probabilité heuristique de baisse future :
  //  - base : position dans la fenêtre d'achat (tôt → plus de chances que ça baisse).
  //  - ajustée par la tendance (prix en baisse → baisse plus probable).
  //  - ajustée par le percentile (prix déjà bas → peu de marge de baisse).
  let dropProb = 0.5;
  if (daysLeft > 60) dropProb += 0.15;
  else if (daysLeft < 14) dropProb -= 0.20;
  else if (daysLeft < 7) dropProb -= 0.30;
  dropProb += slope < 0 ? 0.15 : -0.10;
  dropProb += pct > 0.7 ? 0.10 : pct < 0.3 ? -0.10 : 0;
  dropProb = Math.max(0.02, Math.min(0.95, dropProb));

  const verdict: DealScoreResult['verdict'] = score >= 65 ? 'good' : score >= 40 ? 'ok' : 'bad';
  const verdictLabel =
    verdict === 'good' ? 'Bonne affaire — Achetez' :
    verdict === 'ok' ? 'Prix correct — Surveillez' : 'Mauvaise affaire — Attendez';

  return { score, verdict, verdictLabel, confidence, dropProbability: Math.round(dropProb * 100) / 100, components };
}
