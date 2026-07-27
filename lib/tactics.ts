// ============================================================
// MODULE CONTOURNEMENTS — tactiques applicables à une
// surveillance. Règle d'or : AUCUN chiffre inventé.
//  - Les économies affichées ne sont calculées qu'à partir de
//    prix réellement relevés par FlyDeal sur la route exacte
//    (mêmes aéroports, même date de départ).
//  - Quand aucune donnée mesurée n'est disponible, la tactique
//    explique la méthode sans annoncer de montant.
// Chaque tactique porte un badge de provenance :
//  - 'observed' : calculée sur vos relevés enregistrés,
//  - 'method'   : méthode générale, sans chiffre projeté.
// ============================================================
import { ALTERNATE_AIRPORTS, SPLIT_HUBS, distanceKm, getAirport } from './airports';
import { Watch, PricePoint } from './db';
import { getPrimarySeriesPoints } from './series';

export interface Tactic {
  id: string;
  title: string;
  description: string;
  estimatedSavings: number | null; // €, null si non calculable à partir de relevés réels
  savingsPct: number | null;
  warning: string | null;
  source: 'observed' | 'method';
  detail?: { label: string; price: number | null }[];
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Dernier prix relevé pour chaque date de départ, sur la route principale uniquement. */
function latestPricePerDate(w: Watch, prices: PricePoint[]): Map<string, PricePoint> {
  const origin = w.origins[0], dest = w.destinations[0];
  const map = new Map<string, PricePoint>();
  for (const p of prices) {
    if (p.origin !== origin || p.destination !== dest) continue;
    const prev = map.get(p.depart_date);
    if (!prev || p.checked_at > prev.checked_at) map.set(p.depart_date, p);
  }
  return map;
}

// currentPrice : dernier prix réellement relevé, null si aucun relevé
// (jamais de prix simulé) — les économies chiffrées restent alors null.
export function computeTactics(w: Watch, prices: PricePoint[], currentPrice: number | null): Tactic[] {
  const tactics: Tactic[] = [];
  const origin = w.origins[0];
  const dest = w.destinations[0];
  const baseDate = w.depart_date;
  const series = getPrimarySeriesPoints(w, prices);

  // 1. Dates flexibles : compare UNIQUEMENT les prix réellement relevés
  //    (chaque vérification mesure les dates ± flexibilité autour de la cible).
  const byDate = latestPricePerDate(w, prices);
  const rows = [...byDate.values()]
    .map(p => ({
      label: p.depart_date === baseDate ? `${fmtDate(p.depart_date)} — votre date` : fmtDate(p.depart_date),
      price: p.price,
      date: p.depart_date,
    }))
    .sort((a, b) => a.price - b.price);
  const otherDates = rows.filter(r => r.date !== baseDate);
  const cheapestOther = otherDates.length ? otherDates[0] : null;
  const flexSavings = cheapestOther && currentPrice != null ? Math.max(0, Math.round(currentPrice - cheapestOther.price)) : null;
  tactics.push({
    id: 'flex-dates',
    title: 'Dates flexibles : comparer les jours voisins',
    description: otherDates.length
      ? `Les compagnies remplissent leurs avions par "classes de réservation" : un même siège peut changer de prix d'un jour à l'autre selon le taux de remplissage prévu. Voici les prix réellement relevés par FlyDeal pour votre route, sur les dates proches de votre départ (± ${w.flex_days} j).`
      : `Les compagnies remplissent leurs avions par "classes de réservation" : un même siège peut changer de prix d'un jour à l'autre. FlyDeal relève les dates proches de votre départ (± ${w.flex_days} j) à chaque vérification — la comparaison chiffrée apparaîtra ici dès les prochains relevés.`,
    estimatedSavings: flexSavings && flexSavings > 0 ? flexSavings : null,
    savingsPct: flexSavings && flexSavings > 0 && currentPrice ? Math.round((flexSavings / currentPrice) * 100) : null,
    warning: null,
    source: otherDates.length ? 'observed' : 'method',
    detail: rows.length ? rows.map(({ label, price }) => ({ label, price })) : undefined,
  });

  // 2. Aéroports alternatifs proches : liste factuelle des aéroports de la
  //    même métropole. Aucun prix projeté tant qu'ils ne sont pas mesurés.
  const alts = [
    ...(ALTERNATE_AIRPORTS[origin] || []).map(a => ({ from: a, to: dest, kind: 'départ' })),
    ...(ALTERNATE_AIRPORTS[dest] || []).map(a => ({ from: origin, to: a, kind: 'arrivée' })),
  ];
  if (alts.length) {
    tactics.push({
      id: 'alt-airports',
      title: 'Aéroports alternatifs',
      description: `Votre route touche une métropole desservie par plusieurs aéroports, souvent avec des compagnies low-cost en plus des compagnies historiques. Comparer ces paires dans un moteur de recherche (Google Flights, Kayak) fait souvent baisser le prix, au prix d'un transfert terrestre. Les économies exactes ne sont affichées que si vous créez une surveillance sur l'une de ces paires : FlyDeal n'invente pas de prix.`,
      estimatedSavings: null,
      savingsPct: null,
      warning: 'Ajoutez le coût et le temps du transfert vers l\'aéroport alternatif (train, navette, péages) avant de conclure.',
      source: 'method',
      detail: alts.map(({ from, to, kind }) => ({
        label: `${from} → ${to} (${getAirport(kind === 'départ' ? from : to)?.name ?? (kind === 'départ' ? from : to)})`,
        price: null,
      })),
    });
  }

  // 3. Split ticketing : 2 billets séparés via un hub intermédiaire.
  const km = distanceKm(origin, dest);
  if (km > 2500) {
    const hub = SPLIT_HUBS.find(h => h !== origin && h !== dest &&
      Math.abs(distanceKm(origin, h) + distanceKm(h, dest) - km) < km * 0.35);
    if (hub) {
      tactics.push({
        id: 'split-ticket',
        title: 'Split ticketing (2 billets séparés)',
        description: `Sur un long-courrier comme ${origin} → ${dest}, acheter ${origin} → ${hub} puis ${hub} → ${dest} séparément peut coûter moins cher : chaque billet est tarifé sur son propre marché, avec des compagnies différentes en concurrence sur chaque segment. ${getAirport(hub)?.name ?? hub} est un hub naturel sur ce trajet. Comparez le total des deux billets au prix direct avant de décider — FlyDeal ne projette pas d'économie chiffrée sans relevé sur ces segments.`,
        estimatedSavings: null,
        savingsPct: null,
        warning: 'En cas de retard du 1er vol, la compagnie du 2e billet n\'a aucune obligation. Prévoyez une marge de correspondance généreuse (4 h+) et voyagez léger (bagages non enregistrés en continu).',
        source: 'method',
        detail: [
          { label: `${origin} → ${hub}`, price: null },
          { label: `${hub} → ${dest}`, price: null },
        ],
      });
    }
  }

  // 4. Hidden-city ticketing (avec avertissement légal explicite).
  tactics.push({
    id: 'hidden-city',
    title: 'Hidden-city ticketing',
    description: 'Réserver un vol avec escale dont la destination finale est au-delà de votre ville cible, et descendre à l\'escale. Un vol A → C avec escale à B peut être moins cher que A → B direct, car les compagnies bradent parfois les itinéraires avec correspondance pour concurrencer d\'autres hubs.',
    estimatedSavings: null,
    savingsPct: null,
    warning: '⚠️ Pratique contraire aux conditions de transport de la plupart des compagnies : annulation possible du reste du billet, perte des miles, voire exclusion du programme de fidélité. Impossible avec des bagages en soute. À utiliser en connaissance de cause, aller simple uniquement.',
    source: 'method',
  });

  // 5. Multi-devises / point de vente alternatif.
  tactics.push({
    id: 'pos-currency',
    title: 'Multi-devises / point de vente alternatif',
    description: 'Un même billet peut être tarifé différemment selon le pays depuis lequel il est vendu (le "point of sale") : chaque marché a ses propres grilles et promotions locales. Vérifiez le prix sur le site local de la compagnie (version du pays de départ vs version française, par exemple) — l\'écart varie d\'une route à l\'autre, c\'est pourquoi FlyDeal ne vous annonce pas de montant type : mesurez-le au moment de l\'achat.',
    estimatedSavings: null,
    savingsPct: null,
    warning: 'Attention aux frais de change de votre carte bancaire (souvent 1,5 à 2,5 %) qui grignotent le gain. Une carte sans frais à l\'étranger supprime ce risque.',
    source: 'method',
  });

  // 6. Navigation privée / VPN — mythe vs réalité.
  tactics.push({
    id: 'incognito',
    title: 'Navigation privée / VPN : mythe vs réalité',
    description: 'Contrairement à une idée reçue, les études et tests menés ces dernières années n\'ont pas trouvé de preuve que les compagnies gonflent leurs prix en fonction de vos cookies ou de vos recherches répétées : les variations que vous observez viennent des classes de réservation qui s\'épuisent en temps réel. En revanche, le pays depuis lequel vous consultez le site (adresse IP / point de vente) peut réellement changer la tarification — c\'est là qu\'un VPN a un effet mesurable.',
    estimatedSavings: null,
    savingsPct: null,
    warning: null,
    source: 'method',
  });

  // 7. Aller-retour vs 2 allers simples / mix de compagnies.
  tactics.push({
    id: 'oneway-mix',
    title: 'Aller-retour vs 2 allers simples',
    description: 'Les compagnies low-cost tarifient chaque vol indépendamment : pour elles, un aller-retour n\'est que la somme de deux allers simples. Comparez donc systématiquement votre aller-retour à deux allers simples, y compris sur deux compagnies différentes — le mix permet aussi de choisir les horaires à la carte. À l\'inverse, les compagnies historiques appliquent souvent des conditions tarifaires avantageuses sur l\'aller-retour : les deux calculs sont à faire avant de payer.',
    estimatedSavings: null,
    savingsPct: null,
    warning: 'Avec deux compagnies différentes, chaque billet a ses propres règles de modification, de remboursement et de bagages.',
    source: 'method',
  });

  // 8. Fenêtre d'achat optimale, calculée sur les relevés de la route exacte.
  if (series.length >= 10) {
    const byHour = new Map<number, { sum: number; n: number }>();
    const byDow = new Map<number, { sum: number; n: number }>();
    for (const p of series) {
      const d = new Date(p.checked_at.replace(' ', 'T') + 'Z');
      const h = byHour.get(d.getHours()) || { sum: 0, n: 0 };
      h.sum += p.price; h.n++; byHour.set(d.getHours(), h);
      const w2 = byDow.get(d.getDay()) || { sum: 0, n: 0 };
      w2.sum += p.price; w2.n++; byDow.set(d.getDay(), w2);
    }
    const bestHour = [...byHour.entries()].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)[0];
    const bestDow = [...byDow.entries()].sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)[0];
    const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const avgAll = series.reduce((s, p) => s + p.price, 0) / series.length;
    const bestAvg = bestHour[1].sum / bestHour[1].n;
    tactics.push({
      id: 'best-window',
      title: 'Fenêtre d\'observation la plus favorable (mesurée)',
      description: `D'après les ${series.length} relevés enregistrés par FlyDeal sur cette route exacte (${origin} → ${dest}, départ ${baseDate}), les prix les plus bas ont été observés en moyenne le ${days[bestDow[0]]} vers ${bestHour[0]}h. C'est une statistique issue de vos propres relevés, pas une règle universelle : elle affinera sa précision au fil des vérifications.`,
      estimatedSavings: Math.max(0, Math.round(avgAll - bestAvg)) || null,
      savingsPct: Math.max(0, Math.round(((avgAll - bestAvg) / avgAll) * 100)) || null,
      warning: null,
      source: 'observed',
    });
  }

  // 9. Alerte error-fare si un relevé réel est très sous la médiane.
  if (series.length >= 5) {
    const min = Math.min(...series.map(p => p.price));
    const sorted = [...series].sort((a, b) => a.price - b.price);
    const median = sorted[Math.floor(sorted.length / 2)].price;
    if (min < median * 0.6 && currentPrice != null) {
      tactics.push({
        id: 'error-fare',
        title: '🚨 Error fare détectée dans vos relevés',
        description: `Un prix de ${min.toFixed(0)} € a réellement été relevé par FlyDeal sur cette route, soit ${Math.round((1 - min / median) * 100)} % sous la médiane de vos ${series.length} relevés. Il s'agit très probablement d'une erreur tarifaire ou d'une promo flash : ces événements disparaissent en quelques heures. FlyDeal surveille cette route en continu et relèvera une telle baisse dès sa réapparition.`,
        estimatedSavings: Math.max(0, Math.round(currentPrice - min)) || null,
        savingsPct: Math.max(0, Math.round(((currentPrice - min) / currentPrice) * 100)) || null,
        warning: 'Une error fare peut être annulée par la compagnie (rare mais possible). Attendez la confirmation électronique du billet avant de réserver hôtels ou activités.',
        source: 'observed',
      });
    }
  }

  return tactics;
}
