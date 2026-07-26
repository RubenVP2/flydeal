// Initialisation serveur (Node runtime uniquement) : seed + scheduler.
import { seedIfEmpty } from './seed';
import { startScheduler } from './scheduler';

let initialized = false;
export function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  try {
    seedIfEmpty();
    startScheduler();
  } catch (e) {
    console.error('[flydeal] init error', e);
  }
}
