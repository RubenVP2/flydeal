'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AirportPicker from './AirportPicker';

export default function WatchForm({ initial, watchId }: {
  initial?: { origins: string[]; destinations: string[]; depart_date: string; flex_days: number };
  watchId?: number;
}) {
  const router = useRouter();
  const [origins, setOrigins] = useState<string[]>(initial?.origins ?? []);
  const [destinations, setDestinations] = useState<string[]>(initial?.destinations ?? []);
  const [departDate, setDepartDate] = useState(initial?.depart_date ?? '');
  const [flex, setFlex] = useState(initial?.flex_days ?? 3);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await fetch('/api/watches', {
      method: watchId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: watchId, origins, destinations, depart_date: departDate, flex_days: flex }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error || 'Erreur'); return; }
    router.push('/');
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="card space-y-5 animate-fade-in">
      <AirportPicker label="Aéroports de départ" values={origins} onChange={setOrigins} />
      <AirportPicker label="Aéroports d'arrivée" values={destinations} onChange={setDestinations} />
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5 opacity-70">Date de départ</label>
          <input type="date" required value={departDate} onChange={e => setDepartDate(e.target.value)}
            className="w-full rounded-xl bg-black/[0.04] dark:bg-white/[0.07] px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-accent/50 transition" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5 opacity-70">Flexibilité : ± {flex} j</label>
          <input type="range" min={0} max={7} value={flex} onChange={e => setFlex(Number(e.target.value))}
            className="w-full accent-[#0A84FF] mt-3" />
        </div>
      </div>
      {error && <p className="text-sm text-[#FF453A]">{error}</p>}
      <button disabled={loading || !origins.length || !destinations.length || !departDate}
        className="w-full rounded-xl bg-accent text-white font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-40 transition">
        {loading ? 'Enregistrement…' : watchId ? 'Mettre à jour la surveillance' : 'Créer la surveillance'}
      </button>
    </form>
  );
}
