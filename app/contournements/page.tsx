import Link from 'next/link';
import { Compass } from 'lucide-react';
import { listWatches, getPrices } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { computeTactics } from '@/lib/tactics';
import { simulatePrice } from '@/lib/price-engine';
import TacticsPanel from '@/components/TacticsPanel';

export const dynamic = 'force-dynamic';

// Page dédiée : toutes les tactiques de contournement, regroupées par surveillance.
export default function ContournementsPage() {
  ensureInitialized();
  const watches = listWatches();
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <span className="bg-accent text-white rounded-xl p-2"><Compass size={20} /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contournements</h1>
          <p className="text-sm opacity-60">Tactiques légales (et une grise, clairement signalée) pour payer moins cher.</p>
        </div>
      </div>
      {!watches.length && (
        <div className="card text-center py-12">
          <p className="font-medium">Aucune surveillance active</p>
          <p className="text-sm opacity-60 mt-1">Créez une surveillance pour obtenir des tactiques chiffrées.</p>
          <Link href="/nouvelle" className="inline-block mt-4 bg-accent text-white text-sm font-medium px-4 py-2 rounded-full">Nouvelle surveillance</Link>
        </div>
      )}
      {watches.map(w => {
        const prices = getPrices(w.id);
        const current = prices.length ? prices[prices.length - 1].price : simulatePrice(w.origins[0], w.destinations[0], w.depart_date);
        const tactics = computeTactics(w, prices, current);
        return (
          <section key={w.id}>
            <h2 className="font-semibold mb-3">
              <Link href={`/surveillance/${w.id}`} className="hover:text-accent transition-colors">
                {w.origins.join(' / ')} → {w.destinations.join(' / ')} · {w.depart_date}
              </Link>
              <span className="text-sm font-normal opacity-50 ml-2">prix actuel {current.toFixed(0)} €</span>
            </h2>
            <TacticsPanel tactics={tactics} />
          </section>
        );
      })}
    </div>
  );
}
