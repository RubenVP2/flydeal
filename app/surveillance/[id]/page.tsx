import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { getWatch, getPrices, Watch } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { computeDealScore } from '@/lib/deal-score';
import { computeTactics } from '@/lib/tactics';
import { distanceKm } from '@/lib/airports';
import { simulatePrice } from '@/lib/price-engine';
import { groupPricesBySeries, getPrimarySeriesPoints, primarySeriesKey } from '@/lib/series';
import PriceHeatmap from '@/components/PriceHeatmap';
import VerdictPanel from '@/components/VerdictPanel';
import TacticsPanel from '@/components/TacticsPanel';
import CheckNowButton from '@/components/CheckNowButton';

export const dynamic = 'force-dynamic';

const SEAT_LABELS: Record<string, string> = {
  economy: 'Économie', 'premium-economy': 'Premium Éco', business: 'Affaires', first: 'Première',
};

// Ligne compacte de métadonnées : dates, flexibilité, passagers, cabine.
function watchMeta(w: Watch): string {
  const parts = [`Départ ${w.depart_date}`];
  if (w.trip === 'round-trip' && w.return_date) parts.push(`Retour ${w.return_date}`);
  parts.push(`±${w.flex_days} j`);
  const party = [`${w.adults} ad.`];
  if (w.children) party.push(`${w.children} enf.`);
  if (w.infants) party.push(`${w.infants} bébé`);
  parts.push(party.join(' '));
  parts.push(SEAT_LABELS[w.seat] ?? w.seat);
  return parts.join(' · ');
}

export default function WatchDetail({ params }: { params: { id: string } }) {
  ensureInitialized();
  const w = getWatch(Number(params.id));
  if (!w) notFound();
  const prices = getPrices(w.id);
  const km = distanceKm(w.origins[0], w.destinations[0]);

  // Score et prix actuel : calculés UNIQUEMENT sur la série principale
  // (1er aéroport de départ → 1er d'arrivée, date cible). Mélanger les
  // relevés des routes/dates flexibles fausserait moyenne et percentile.
  const primary = getPrimarySeriesPoints(w, prices);
  const currentPrice = primary.length
    ? primary[primary.length - 1].price
    : simulatePrice(w.origins[0], w.destinations[0], w.depart_date);
  const score = computeDealScore({
    currentPrice, history: primary, distanceKm: km, departDate: w.depart_date,
    // Normalisation €/km : le prix est un total groupe/trajet.
    travelers: w.adults + w.children + w.infants,
    roundTrip: w.trip === 'round-trip',
  });
  const tactics = computeTactics(w, prices, currentPrice);

  // Points pour la heatmap : fenêtre des 30 derniers jours de relevés,
  // toutes séries confondues (routes × dates flexibles), avec le détail
  // du vol mesuré quand le backend l'a fourni. Les séries sont ordonnées
  // principale d'abord — la heatmap garde cet ordre de lignes.
  // Aucune donnée passée fabriquée : seuls les relevés mesurés.
  const cutoff = Date.now() - 30 * 86400000;
  const pKey = primarySeriesKey(w);
  const heatmapPoints = groupPricesBySeries(prices, pKey)
    .flatMap(s => s.points)
    .filter(p => new Date(p.checked_at.replace(' ', 'T') + 'Z').getTime() >= cutoff)
    .map(p => ({
      origin: p.origin,
      destination: p.destination,
      departDate: p.depart_date,
      price: p.price,
      checkedAt: p.checked_at,
      details: p.details,
      provider: p.provider, // 'fast-flights' = réel · 'simulation' = fictif · null = source inconnue
    }));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/" className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1 mb-1"><ArrowLeft size={12} /> Retour</Link>
          <h1 className="text-2xl font-bold tracking-tight">{w.origins.join(' / ')} → {w.destinations.join(' / ')}</h1>
          <p className="text-sm opacity-60 mt-0.5">
            {watchMeta(w)} · {km.toLocaleString('fr-FR')} km · {prices.length} relevés
          </p>
        </div>
        <CheckNowButton id={w.id} />
      </div>

      <VerdictPanel score={score} />

      <div className="card">
        <h2 className="font-semibold mb-4">Prix par route et date <span className="text-xs font-normal opacity-50">(dates flexibles · 30 derniers jours · touchez une cellule pour le détail)</span></h2>
        {heatmapPoints.length
          ? <PriceHeatmap points={heatmapPoints} />
          : <p className="text-sm opacity-50 py-10 text-center">Pas encore de relevé — la heatmap se construit à partir de la première vérification de la surveillance.</p>}
      </div>

      <div>
        <h2 className="font-semibold mb-1">Tactiques de contournement</h2>
        <p className="text-xs opacity-50 mb-3">
          Les montants marqués « Données mesurées » sont calculés à partir de vos relevés enregistrés. Les tactiques marquées « Méthode » expliquent une pratique documentée, sans chiffre projeté.
        </p>
        <TacticsPanel tactics={tactics} />
      </div>

      <div className="card text-sm flex items-center gap-2 opacity-70">
        <Clock size={14} />
        Prochaine vérification : {w.next_check_at ? new Date(w.next_check_at).toLocaleString('fr-FR') : 'planification en cours'}
        {w.last_checked_at && <span className="ml-auto flex items-center gap-1"><RefreshCw size={12} /> Dernière : {new Date(w.last_checked_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR')}</span>}
      </div>
    </div>
  );
}
