// Seed de démonstration : 3 surveillances insérées uniquement si la base
// est vide. AUCUN historique de prix n'est fabriqué : les relevés démarrent
// au jour J (premier passage du scheduler), car le backend flights-service
// ne fournit pas de données historiques — seulement le prix courant.
import { db, createWatch, setNextCheck, Watch } from './db';
import { SearchOptions, DEFAULT_SEARCH_OPTIONS } from './price-engine';
import { nextCheckTime } from './scheduler';

export function seedIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM watches').get() as { c: number }).c;
  if (count > 0) return;

  const now = new Date();
  const inDays = (n: number) => {
    const d = new Date(now.getTime() + n * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const demos: { origins: string[]; destinations: string[]; date: string; flex: number; options?: SearchOptions }[] = [
    // Aller-retour 2 adultes pour illustrer les options de recherche.
    {
      origins: ['CDG', 'ORY'], destinations: ['JFK'], date: inDays(45), flex: 3,
      options: { trip: 'round-trip', returnDate: inDays(52), adults: 2, children: 0, infants: 0, seat: 'economy' },
    },
    { origins: ['CDG'], destinations: ['NRT', 'HND'], date: inDays(90), flex: 3 },
    { origins: ['LYS'], destinations: ['LIS'], date: inDays(18), flex: 2 },
  ];

  for (const d of demos) {
    const w: Watch = createWatch(d.origins, d.destinations, d.date, d.flex, d.options ?? DEFAULT_SEARCH_OPTIONS);
    setNextCheck(w.id, nextCheckTime(w).toISOString());
  }
  console.log('[flydeal] base seedée avec 3 surveillances de démonstration');
}
