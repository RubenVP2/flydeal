import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { getWatch, getPrices, Watch } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { computeDealScore } from '@/lib/deal-score';
import { computeTactics } from '@/lib/tactics';
import { distanceKm } from '@/lib/airports';
import { simulatePrice } from '@/lib/price-engine';
import PriceHistoryChart from '@/components/PriceHistoryChart';
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
  const currentPrice = prices.length ? prices[prices.length - 1].price : simulatePrice(w.origins[0], w.destinations[0], w.depart_date);
  const score = computeDealScore({ currentPrice, history: prices, distanceKm: km, departDate: w.depart_date });
  const tactics = computeTactics(w, prices, currentPrice);
  const stats = prices.length ? {
    min: Math.min(...prices.map(p => p.price)),
    max: Math.max(...prices.map(p => p.price)),
    avg: Math.round(prices.reduce((s, p) => s + p.price, 0) / prices.length),
  } : null;

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
        <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold">Historique du prix</h2>
          {stats && (
            <p className="text-xs opacity-60">
              Min <span className="text-[#30D158] font-semibold">{stats.min.toFixed(0)} €</span> ·
              Moy <span className="font-semibold"> {stats.avg} €</span> ·
              Max <span className="text-[#FF453A] font-semibold"> {stats.max.toFixed(0)} €</span> ·
              Actuel <span className="font-semibold"> {currentPrice.toFixed(0)} €</span>
            </p>
          )}
        </div>
        {prices.length > 1 ? <PriceHistoryChart prices={prices} /> : <p className="text-sm opacity-50 py-10 text-center">Pas encore assez de relevés.</p>}
      </div>

      <div>
        <h2 className="font-semibold mb-3">Tactiques de contournement</h2>
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
