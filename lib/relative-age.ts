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

/**
 * Message de la bannière « prix possiblement périmés » (scraper en
 * échec répété). Formulation correcte en français : relativeAge()
 * renvoie « il y a 3 h », donc on écrit « dernière actualisation
 * réussie : il y a 3 h » — jamais « depuis il y a 3 h ».
 */
export function stalePricesMessage(lastSuccessAt: string | null, now: number = Date.now()): string {
  const suffix = 'les montants affichés peuvent être périmés.';
  return lastSuccessAt
    ? `Les prix n'ont pas pu être actualisés — dernière actualisation réussie : ${relativeAge(lastSuccessAt, now)} — ${suffix}`
    : `Les prix n'ont pas pu être actualisés pour le moment — ${suffix}`;
}
