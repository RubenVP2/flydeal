import Link from 'next/link';
import { Plus, ChevronRight, Clock, Trash2, Pencil } from 'lucide-react';
import { listWatches, getPrices, Watch } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { computeDealScore } from '@/lib/deal-score';
import { distanceKm } from '@/lib/airports';
import { simulatePrice } from '@/lib/price-engine';
import { getPrimarySeriesPoints } from '@/lib/series';
import ScoreGauge from '@/components/ScoreGauge';
import Sparkline from '@/components/Sparkline';
import DeleteButton from '@/components/DeleteButton';

export const dynamic = 'force-dynamic';

const VERDICT = {
  good: { emoji: '🟢', label: 'Bonne affaire' },
  ok: { emoji: '🟡', label: 'Prix correct' },
  bad: { emoji: '🔴', label: 'Attendez' },
} as const;

function nextIn(iso: string | null): string {
  if (!iso) return 'planification…';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'imminente';
  const h = Math.floor(ms / 3600000), m = Math.round((ms % 3600000) / 60000);
  return h > 24 ? `dans ${Math.round(h / 24)} j` : h > 0 ? `dans ${h} h ${m} min` : `dans ${m} min`;
}

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

export default function Dashboard() {
  ensureInitialized();
  const watches = listWatches();
  const rows = watches.map(w => {
    const prices = getPrices(w.id);
    // Prix courant, score et sparkline : série principale uniquement,
    // pour ne pas mélanger des relevés de routes/dates différentes.
    const primary = getPrimarySeriesPoints(w, prices);
    const currentPrice = primary.length ? primary[primary.length - 1].price
      : simulatePrice(w.origins[0], w.destinations[0], w.depart_date);
    const score = computeDealScore({
      currentPrice, history: primary, distanceKm: distanceKm(w.origins[0], w.destinations[0]), departDate: w.depart_date,
      // Normalisation €/km : le prix est un total groupe/trajet.
      travelers: w.adults + w.children + w.infants,
      roundTrip: w.trip === 'round-trip',
    });
    return { w, primary, currentPrice, score };
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm opacity-60 mt-0.5">{watches.length} surveillance{watches.length > 1 ? 's' : ''} active{watches.length > 1 ? 's' : ''}</p>
        </div>
        <Link href="/nouvelle" className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-full hover:opacity-90 transition">
          <Plus size={16} /> Nouvelle surveillance
        </Link>
      </div>

      {!rows.length && (
        <div className="card text-center py-14">
          <p className="text-lg font-medium">Aucune surveillance</p>
          <p className="text-sm opacity-60 mt-1">Créez votre première surveillance pour commencer à traquer les prix.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map(({ w, primary, currentPrice, score }) => {
          const v = VERDICT[score.verdict];
          const spark = primary.slice(-30).map(p => p.price);
          return (
            <div key={w.id} className="card relative group hover:shadow-lg transition-shadow">
              <Link href={`/surveillance/${w.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-lg tracking-tight">
                      {w.origins.join(' / ')} → {w.destinations.join(' / ')}
                    </p>
                    <p className="text-xs opacity-60 mt-0.5">
                      {watchMeta(w)} · {w.last_checked_at ? `vérifié ${w.last_checked_at.slice(5, 16)}` : 'jamais vérifié'}
                    </p>
                  </div>
                  <ScoreGauge score={score.score} size={64} />
                </div>
                <div className="flex items-end justify-between mt-4">
                  <div>
                    <p className="text-2xl font-bold">{currentPrice.toFixed(0)} €</p>
                    <p className="text-xs mt-0.5" style={{ color: score.score >= 65 ? '#30D158' : score.score >= 40 ? '#FF9F0A' : '#FF453A' }}>
                      {v.emoji} {v.label}
                    </p>
                  </div>
                  {spark.length > 1 && <Sparkline data={spark} />}
                </div>
                <p className="flex items-center gap-1.5 text-xs opacity-50 mt-3">
                  <Clock size={12} /> Prochaine vérification {nextIn(w.next_check_at)}
                  <ChevronRight size={12} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
                </p>
              </Link>
              <div className="absolute top-4 right-[88px] flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <Link href={`/surveillance/${w.id}/edit`} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10" aria-label="Modifier">
                  <Pencil size={14} />
                </Link>
                <DeleteButton id={w.id} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
