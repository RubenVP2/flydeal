// ============================================================
// SCHEDULER — calcule les "moments stratégiques" de vérification
// des prix et pilote node-cron (processus unique Next.js).
// Stratégie :
//  - milieu de nuit 2h-5h (heure creuse des yield managers),
//  - mardi / mercredi (jours historiquement moins chers),
//  - fenêtres clés avant départ : J-60, J-21, J-14, J-7,
//  - sinon cadence de base : toutes les 6 h.
// ============================================================
import cron from 'node-cron';
import { listWatches, addPrice, touchWatchCheck, watchOptions, Watch } from './db';
import { getProvider } from './price-engine';
import { recordScraperSuccess, recordScraperFailure } from './scraper-status';

export function daysToDeparture(w: Watch, from: Date = new Date()): number {
  return Math.round((new Date(w.depart_date + 'T12:00:00Z').getTime() - from.getTime()) / 86400000);
}

/**
 * Calcule la prochaine exécution pertinente pour une surveillance.
 * On choisit le moment stratégique le plus proche dans le futur.
 */
export function nextCheckTime(w: Watch, from: Date = new Date()): Date {
  const candidates: Date[] = [];
  const dtd = daysToDeparture(w, from);

  // Fenêtres clés J-60 / J-21 / J-14 / J-7 : vérification horaire autour de ces seuils.
  const KEY_WINDOWS = [60, 21, 14, 7];
  const inKeyWindow = KEY_WINDOWS.some(k => Math.abs(dtd - k) <= 1);
  if (inKeyWindow) {
    candidates.push(new Date(from.getTime() + 3600000)); // toutes les heures
  }

  // Créneaux nocturnes 2h, 3h30, 5h (heure locale).
  for (const [h, m] of [[2, 0], [3, 30], [5, 0]] as const) {
    const d = new Date(from);
    d.setHours(h, m, 0, 0);
    if (d <= from) d.setDate(d.getDate() + 1);
    candidates.push(d);
  }

  // Mardi / mercredi : vérification 10h et 16h.
  const day = from.getDay(); // 0=dim
  if (day === 2 || day === 3) {
    for (const h of [10, 16]) {
      const d = new Date(from);
      d.setHours(h, 0, 0, 0);
      if (d > from) candidates.push(d);
    }
  }

  // Cadence de base : +6 h.
  candidates.push(new Date(from.getTime() + 6 * 3600000));

  // Ne pas vérifier après le départ : dernier créneau la veille à 3h.
  const dep = new Date(w.depart_date + 'T03:00:00');
  const valid = candidates.filter(c => c > from && c < dep);
  if (!valid.length) return dep; // départ passé ou imminent
  return new Date(Math.min(...valid.map(c => c.getTime())));
}

/** Exécute une vérification de prix pour toutes les routes d'une surveillance. */
export async function checkWatch(w: Watch): Promise<void> {
  const provider = getProvider();
  const now = new Date();
  const jobs: Promise<void>[] = [];
  // Suivi de santé du scraper sur CETTE vérification : une erreur autre
  // que « aucune offre » (404 — scraper fonctionnel, pas de vol dispo)
  // compte comme un échec du scraper. Détection par code d'erreur
  // (duck typing) pour rester robuste aux mocks/tests.
  let scraperFailures = 0;
  let lastScraperError: string | null = null;
  const shiftDate = (iso: string, delta: number) =>
    new Date(new Date(iso + 'T12:00:00Z').getTime() + delta * 86400000).toISOString().slice(0, 10);
  for (const o of w.origins) {
    for (const d of w.destinations) {
      for (let delta = -w.flex_days; delta <= w.flex_days; delta++) {
        const dateStr = shiftDate(w.depart_date, delta);
        // Le retour suit la même flexibilité que l'aller (aller-retour uniquement).
        const shiftedReturn = w.return_date ? shiftDate(w.return_date, delta) : null;
        const options = { ...watchOptions(w), returnDate: shiftedReturn };
        jobs.push(
          provider.getPrice(o, d, dateStr, options, now)
            .then(q => {
              // Le relevé emporte le nom du provider qui l'a produit
              // ('fast-flights' = réel, 'simulation' = fictif) et le
              // détail du vol quand le backend le fournit.
              addPrice(w.id, o, d, dateStr, q.price, undefined, q.details ?? null, q.provider);
            })
            .catch(err => {
              if (err?.code !== 'NO_OFFER') {
                scraperFailures += 1;
                lastScraperError = err?.message ?? String(err);
              }
              console.error(`[flydeal] prix ${o}->${d} ${dateStr}:`, err.message);
            })
        );
      }
    }
  }
  await Promise.all(jobs);
  // Enregistre la santé du scraper réel (en mode simulation, /api/status
  // signale déjà que les prix sont fictifs : rien à suivre).
  if (provider.name !== 'simulation') {
    if (scraperFailures > 0) recordScraperFailure(lastScraperError ?? 'erreur inconnue');
    else recordScraperSuccess(now);
  }
  touchWatchCheck(w.id, nextCheckTime(w).toISOString());
}

/** Vérifie toutes les surveillances dont l'échéance est passée. */
export async function runDueChecks(): Promise<void> {
  const now = new Date();
  for (const w of listWatches()) {
    const due = w.next_check_at ? new Date(w.next_check_at) : new Date(0);
    if (due <= now) {
      try { await checkWatch(w); } catch (e) { console.error('[flydeal] check failed', e); }
    }
  }
}

let started = false;
/** Démarre le cron interne (idempotent). Tick toutes les 5 minutes. */
export function startScheduler(): void {
  if (started) return;
  started = true;
  cron.schedule('*/5 * * * *', () => { runDueChecks(); });
  console.log('[flydeal] scheduler démarré (tick 5 min)');
  // Premier passage différé pour laisser l'app démarrer.
  setTimeout(() => { runDueChecks(); }, 15000);
}
