// Âge relatif en français pour les relevés de prix :
// « à l'instant » / « il y a 12 min » / « il y a 3 h » / « il y a 2 j ».
// Accepte un ISO ("2026-07-01T03:00:00Z") ou le format SQLite UTC
// ("2026-07-01 03:00:00").
export function relativeAge(iso: string, now: number = Date.now()): string {
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const ms = now - t;
  if (!Number.isFinite(ms) || ms < 0) return 'à l’instant';
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

/** Âge en millisecondes d'un relevé (mêmes formats acceptés). */
export function ageMs(iso: string, now: number = Date.now()): number {
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').getTime();
  const ms = now - t;
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}
