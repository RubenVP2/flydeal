import { notFound } from 'next/navigation';
import { getWatch } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import WatchForm from '@/components/WatchForm';

export const dynamic = 'force-dynamic';

export default function EditWatchPage({ params }: { params: { id: string } }) {
  ensureInitialized();
  const w = getWatch(Number(params.id));
  if (!w) notFound();
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Modifier la surveillance</h1>
      <WatchForm watchId={w.id} initial={{ origins: w.origins, destinations: w.destinations, depart_date: w.depart_date, flex_days: w.flex_days }} />
    </div>
  );
}
