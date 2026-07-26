// ============================================================
// MODULE CONTOURNEMENTS — génère les tactiques applicables à une
// surveillance, avec économie estimée quand calculable.
// ============================================================
import { ALTERNATE_AIRPORTS, SPLIT_HUBS, distanceKm } from './airports';
import { simulatePrice } from './price-engine';
import { Watch, PricePoint } from './db';

export interface Tactic {
  id: string;
  title: string;
  description: string;
  estimatedSavings: number | null; // €, null si non calculable
  savingsPct: number | null;
  warning: string | null;
  detail?: { label: string; price: number }[]; // ex. prix des dates voisines
}

export function computeTactics(w: Watch, prices: PricePoint[], currentPrice: number): Tactic[] {
  const tactics: Tactic[] = [];
  const now = new Date();
  const origin = w.origins[0];
  const dest = w.destinations[0];
  const baseDate = w.depart_date;

  // 1. Dates flexibles ±3 jours : prix des dates voisines (déterministe).
  const neighbors: { label: string; price: number }[] = [];
  for (let d = -3; d <= 3; d++) {
    if (d === 0) continue;
    const dd = new Date(new Date(baseDate + 'T12:00:00Z').getTime() + d * 86400000);
    const ds = dd.toISOString().slice(0, 10);
    neighbors.push({ label: `${d > 0 ? '+' : ''}${d} j (${ds})`, price: simulatePrice(origin, dest, ds, now) });
  }
  const cheapestNeighbor = neighbors.reduce((m, n) => (n.price < m.price ? n : m), neighbors[0]);
  tactics.push({
    id: 'flex-dates',
    title: 'Dates flexibles ± 3 jours',
    description: 'Décaler le départ d\'un jour ou deux change souvent radicalement le prix : les grilles tarifaires (buckets) diffèrent selon le jour de la semaine. Voici les prix simulés des dates voisines.',
    estimatedSavings: Math.max(0, Math.round(currentPrice - cheapestNeighbor.price)),
    savingsPct: currentPrice > 0 ? Math.max(0, Math.round(((currentPrice - cheapestNeighbor.price) / currentPrice) * 100)) : null,
    warning: null,
    detail: neighbors.sort((a, b) => a.price - b.price),
  });

  // 2. Aéroports alternatifs proches.
  const alts = [...(ALTERNATE_AIRPORTS[origin] || []).map(a => ({ from: origin, to: a })),
                ...(ALTERNATE_AIRPORTS[dest] || []).map(a => ({ from: a, to: dest }))];
  if (alts.length) {
    const altPrices = alts.map(({ from, to }) => ({
      label: `${from} → ${to === dest ? to : to}`, price: simulatePrice(from, to, baseDate, now),
    }));
    const bestAlt = altPrices.reduce((m, n) => (n.price < m.price ? n : m), altPrices[0]);
    tactics.push({
      id: 'alt-airports',
      title: 'Aéroports alternatifs',
      description: 'Certaines métropoles ont plusieurs aéroports (souvent desservis par des low-cost). Comparer les paires voisines peut fortement baisser le prix, au prix d\'un transfert terrestre.',
      estimatedSavings: Math.max(0, Math.round(currentPrice - bestAlt.price)),
      savingsPct: currentPrice > 0 ? Math.max(0, Math.round(((currentPrice - bestAlt.price) / currentPrice) * 100)) : null,
      warning: 'Ajoutez le coût et le temps du transfert vers l\'aéroport alternatif.',
      detail: altPrices.sort((a, b) => a.price - b.price),
    });
  }

  // 3. Split ticketing : 2 billets séparés via un hub intermédiaire.
  const km = distanceKm(origin, dest);
  if (km > 2500) {
    const hub = SPLIT_HUBS.find(h => h !== origin && h !== dest &&
      Math.abs(distanceKm(origin, h) + distanceKm(h, dest) - km) < km * 0.35);
    if (hub) {
      const p1 = simulatePrice(origin, hub, baseDate, now);
      const p2 = simulatePrice(hub, dest, baseDate, now);
      const splitTotal = p1 + p2;
      tactics.push({
        id: 'split-ticket',
        title: 'Split ticketing (2 billets séparés)',
        description: `Acheter ${origin}→${hub} puis ${hub}→${dest} séparément exploite les différences de grilles tarifaires entre marchés. Les compagnies tarifient chaque segment indépendamment.`,
        estimatedSavings: Math.max(0, Math.round(currentPrice - splitTotal)),
        savingsPct: currentPrice > 0 ? Math.max(0, Math.round(((currentPrice - splitTotal) / currentPrice) * 100)) : null,
        warning: 'En cas de retard du 1er vol, la compagnie du 2e billet n\'a aucune obligation. Prévoyez une marge de correspondance généreuse (4 h+) et voyagez léger (bagages non enregistrés en continu).',
        detail: [
          { label: `${origin} → ${hub}`, price: p1 },
          { label: `${hub} → ${dest}`, price: p2 },
          { label: 'Total 2 billets', price: splitTotal },
        ],
      });
    }
  }

  // 4. Hidden-city ticketing (avec avertissement légal explicite).
  tactics.push({
    id: 'hidden-city',
    title: 'Hidden-city ticketing',
    description: 'Réserver un vol avec escale dont la destination finale est au-delà de votre ville cible, et descendre à l\'escale. Un vol A→C avec escale à B peut être moins cher que A→B direct.',
    estimatedSavings: null,
    savingsPct: null,
    warning: '⚠️ Pratique contraire aux conditions de transport de la plupart des compagnies : annulation possible du reste du billet, perte des miles, voire exclusion du programme de fidélité. Impossible avec des bagages en soute. À utiliser en connaissance de cause, aller simple uniquement.',
  });

  // 5. Multi-devises / point de vente alternatif.
  const estFx = Math.round(currentPrice * 0.06);
  tactics.push({
    id: 'pos-currency',
    title: 'Multi-devises / point de vente alternatif',
    description: 'Le même billet peut être tarifé différemment selon le pays de vente (point of sale) et la devise. Vérifier le prix sur le site local de la compagnie (ex. version .fr vs site du pays de la compagnie) révèle parfois des écarts.',
    estimatedSavings: estFx,
    savingsPct: 6,
    warning: 'Attention aux frais de change de votre carte bancaire (souvent 1,5-2,5 %) qui grignotent le gain.',
  });

  // 6. Navigation privée / VPN — mythe vs réalité.
  tactics.push({
    id: 'incognito',
    title: 'Navigation privée / VPN : mythe vs réalité',
    description: 'Mythe largement exagéré : les études récentes montrent que les compagnies ne gonflent PAS les prix en fonction de vos cookies. En revanche, le pays d\'accès (adresse IP / point de vente) peut réellement changer la tarification — c\'est là qu\'un VPN a un effet mesurable.',
    estimatedSavings: null,
    savingsPct: null,
    warning: null,
  });

  // 7. Aller-retour vs 2 allers simples / mix de compagnies.
  const rt = simulatePrice(origin, dest, baseDate, now) * 1.9;
  const twoOneways = currentPrice * 2 * 0.96; // légère remise fréquente sur A/R
  tactics.push({
    id: 'oneway-mix',
    title: 'Aller-retour vs 2 allers simples',
    description: 'Comparer systématiquement l\'aller-retour à deux allers simples, y compris sur deux compagnies différentes. Les low-cost tarifient au segment : le mix de compagnies est souvent gagnant, et permet de choisir les horaires à la carte.',
    estimatedSavings: Math.max(0, Math.round(rt - twoOneways)),
    savingsPct: null,
    warning: 'Avec deux compagnies différentes, chaque billet a ses propres règles de modification et de bagages.',
  });

  // 8. Fenêtre d'achat optimale calculée depuis l'historique.
  if (prices.length >= 10) {
    const byHour = new Map<number, { sum: number; n: number }>();
    const byDow = new Map<number, { sum: number; n: number }>();
    for (const p of prices) {
      const d = new Date(p.checked_at);
      const h = byHour.get(d.getHours()) || { sum: 0, n: 0 };
      h.sum += p.price; h.n++; byHour.set(d.getHours(), h);
      const w2 = byDow.get(d.getDay()) || { sum: 0, n: 0 };
      w2.sum += p.price; w2.n++; byDow.set(d.getDay(), w2);
    }
    const bestHour = [...byHour.entries()].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)[0];
    const bestDow = [...byDow.entries()].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)[0];
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const avgAll = prices.reduce((s, p) => s + p.price, 0) / prices.length;
    const bestAvg = bestHour[1].sum / bestHour[1].n;
    tactics.push({
      id: 'best-window',
      title: 'Fenêtre d\'achat optimale (calculée)',
      description: `D'après ${prices.length} relevés sur cette route, les prix les plus bas ont été observés le ${days[bestDow[0]]} vers ${bestHour[0]}h. C'est le créneau où les yield managers recalibrent leurs grilles.`,
      estimatedSavings: Math.max(0, Math.round(avgAll - bestAvg)),
      savingsPct: Math.max(0, Math.round(((avgAll - bestAvg) / avgAll) * 100)),
      warning: null,
    });
  }

  // 9. Alerte error-fare si un point historique est très bas.
  if (prices.length >= 5) {
    const min = Math.min(...prices.map(p => p.price));
    const median = [...prices].sort((a, b) => a.price - b.price)[Math.floor(prices.length / 2)].price;
    if (min < median * 0.6) {
      tactics.push({
        id: 'error-fare',
        title: '🚨 Error fare détectée dans l\'historique',
        description: `Un prix de ${min.toFixed(0)} € a été observé, soit ${Math.round((1 - min / median) * 100)} % sous la médiane. Probable erreur tarifaire ou promo flash. Ces événements disparaissent en quelques heures : FlyDeal les détecte lors des vérifications nocturnes.`,
        estimatedSavings: Math.round(currentPrice - min),
        savingsPct: Math.round(((currentPrice - min) / currentPrice) * 100),
        warning: 'Une error fare peut être annulée par la compagnie (rare mais possible). Attendez la confirmation électronique avant de réserver hôtels/activités.',
      });
    }
  }

  return tactics;
}
