// Seed de démonstration : 3 surveillances avec 30 jours d'historique simulé,
// insérées uniquement si la base est vide.
import { db, createWatch, addPrice, setNextCheck, Watch } from './db';
import { simulatePrice } from './price-engine';
import { nextCheckTime } from './scheduler';

export function seedIfEmpty(): void {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM watches').get() as { c: number }).c;
  if (count > 0) return;

  const now = new Date();
  const inDays = (n: number) => {
    const d = new Date(now.getTime() + n * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const demos: { origins: string[]; destinations: string[]; date: string; flex: number }[] = [
    { origins: ['CDG', 'ORY'], destinations: ['JFK'], date: inDays(45), flex: 3 },
    { origins: ['CDG'], destinations: ['NRT', 'HND'], date: inDays(90), flex: 3 },
    { origins: ['LYS'], destinations: ['LIS'], date: inDays(18), flex: 2 },
  ];

  for (const d of demos) {
    const w: Watch = createWatch(d.origins, d.destinations, d.date, d.flex);
    // 30 jours d'historique : 2 relevés/jour sur la route principale + dates flex.
    for (let day = 30; day >= 0; day--) {
      for (const hour of [3, 15]) {
        const at = new Date(now.getTime() - day * 86400000);
        at.setHours(hour, Math.floor(Math.random() * 50), 0, 0);
        const iso = at.toISOString().replace('T', ' ').slice(0, 19);
        for (const o of d.origins) {
          for (const dst of d.destinations) {
            addPrice(w.id, o, dst, d.date, simulatePrice(o, dst, d.date, at), iso);
          }
        }
      }
    }
    setNextCheck(w.id, nextCheckTime(w).toISOString());
  }
  console.log('[flydeal] base seedée avec 3 surveillances de démonstration');
}
