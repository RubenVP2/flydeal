// ============================================================
// PRIX COURANT — dernier prix RÉELLEMENT relevé d'une série.
// Règle absolue : JAMAIS de prix simulé en secours. Sans relevé
// (surveillance fraîche, scraper en panne au démarrage), on
// renvoie null : l'UI affiche alors un état explicite (« Aucun
// relevé pour le moment ») au lieu d'un montant fictif présenté
// comme réel, et aucun deal-score/verdict n'est calculé.
// simulatePrice reste réservé au SimulationProvider (mode démo,
// déjà badgé « prix SIMULÉS » sur toutes les pages).
// ============================================================
import { PricePoint } from './db';

/** Dernier prix mesuré de la série (ordre chronologique), ou null si aucun relevé. */
export function latestMeasuredPrice(primary: PricePoint[]): number | null {
  return primary.length ? primary[primary.length - 1].price : null;
}
