// ============================================================
// STATUT DU SCRAPER — suivi en mémoire des succès/échecs du
// moteur de prix réel (flights-service / fast-flights).
// But : rendre visible la fiabilité des prix affichés.
//  - Mode "simulation" (FAST_FLIGHTS_URL absente) : les prix sont
//    fictifs par construction → scraper.ok = false.
//  - Mode "live" : le scheduler enregistre chaque vérification ;
//    consecutiveFailures ≥ 1 signale un scraper en difficulté.
// État volatil (redémarrage = remise à zéro) : le choix le plus
// simple et robuste, une base SQLite n'apporterait rien ici — au
// pire, la bannière d'alerte réapparaît après 3 nouveaux échecs.
// Singleton global pour survivre au hot-reload Next.js (comme db).
// ============================================================

export interface ScraperState {
  consecutiveFailures: number;
  lastSuccessAt: string | null; // ISO
  lastError: string | null;
}

export interface AppStatus {
  mode: 'live' | 'simulation';
  scraper: {
    ok: boolean;
    consecutiveFailures: number;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  updatedAt: string; // ISO — date de calcul du statut
}

const g = globalThis as unknown as { __flydealScraperState?: ScraperState };
const state: ScraperState = g.__flydealScraperState ??
  (g.__flydealScraperState = { consecutiveFailures: 0, lastSuccessAt: null, lastError: null });

/** Le scraper a répondu avec au moins un prix exploitable. */
export function recordScraperSuccess(at: Date = new Date()): void {
  state.consecutiveFailures = 0;
  state.lastSuccessAt = at.toISOString();
  state.lastError = null;
}

/** Le scraper n'a fourni aucun prix exploitable (panne, timeout, 5xx…). */
export function recordScraperFailure(message: string): void {
  state.consecutiveFailures += 1;
  state.lastError = message;
}

/** Mode de prix actif : réel si FAST_FLIGHTS_URL est configurée (même logique que getProvider()). */
export function priceMode(): 'live' | 'simulation' {
  return process.env.FAST_FLIGHTS_URL ? 'live' : 'simulation';
}

/** Statut courant exposé par /api/status. */
export function getStatus(): AppStatus {
  const mode = priceMode();
  return {
    mode,
    scraper: {
      // En simulation les prix sont fictifs par construction : pas de scraper sain.
      ok: mode === 'live' && state.consecutiveFailures === 0,
      consecutiveFailures: state.consecutiveFailures,
      lastSuccessAt: state.lastSuccessAt,
      lastError: state.lastError,
    },
    updatedAt: new Date().toISOString(),
  };
}
