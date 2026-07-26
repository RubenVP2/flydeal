'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AirportPicker from './AirportPicker';

// Libellés français des cabines (dupliqué en miniature dans les pages serveur).
export const SEAT_LABELS: Record<string, string> = {
  economy: 'Économie',
  'premium-economy': 'Premium Éco',
  business: 'Affaires',
  first: 'Première',
};

export default function WatchForm({ initial, watchId }: {
  initial?: {
    origins: string[]; destinations: string[]; depart_date: string; flex_days: number;
    trip?: 'one-way' | 'round-trip'; return_date?: string | null;
    adults?: number; children?: number; infants?: number; seat?: string;
  };
  watchId?: number;
}) {
  const router = useRouter();
  const [origins, setOrigins] = useState<string[]>(initial?.origins ?? []);
  const [destinations, setDestinations] = useState<string[]>(initial?.destinations ?? []);
  const [departDate, setDepartDate] = useState(initial?.depart_date ?? '');
  const [flex, setFlex] = useState(initial?.flex_days ?? 3);
  const [trip, setTrip] = useState<'one-way' | 'round-trip'>(initial?.trip ?? 'one-way');
  const [returnDate, setReturnDate] = useState(initial?.return_date ?? '');
  const [adults, setAdults] = useState(initial?.adults ?? 1);
  const [children, setChildren] = useState(initial?.children ?? 0);
  const [infants, setInfants] = useState(initial?.infants ?? 0);
  const [seat, setSeat] = useState(initial?.seat ?? 'economy');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const res = await fetch('/api/watches', {
      method: watchId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: watchId, origins, destinations, depart_date: departDate, flex_days: flex,
        trip, return_date: trip === 'round-trip' ? returnDate : null,
        adults, children, infants, seat,
      }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error || 'Erreur'); return; }
    router.push('/');
    router.refresh();
  };

  const inputCls = 'w-full rounded-xl bg-black/[0.04] dark:bg-white/[0.07] px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-accent/50 transition';
  const labelCls = 'block text-sm font-medium mb-1.5 opacity-70';

  return (
    <form onSubmit={submit} className="card space-y-5 animate-fade-in">
      <AirportPicker label="Aéroports de départ" values={origins} onChange={setOrigins} />
      <AirportPicker label="Aéroports d'arrivée" values={destinations} onChange={setDestinations} />

      <div>
        <label className={labelCls}>Type de trajet</label>
        <div className="grid grid-cols-2 gap-2">
          {([['one-way', 'Aller simple'], ['round-trip', 'Aller-retour']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setTrip(value)}
              className={`rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                trip === value
                  ? 'bg-accent text-white'
                  : 'bg-black/[0.04] dark:bg-white/[0.07] hover:opacity-80'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Date de départ</label>
          <input type="date" required value={departDate} onChange={e => setDepartDate(e.target.value)} className={inputCls} />
        </div>
        {trip === 'round-trip' ? (
          <div>
            <label className={labelCls}>Date de retour</label>
            <input type="date" required min={departDate || undefined} value={returnDate} onChange={e => setReturnDate(e.target.value)} className={inputCls} />
          </div>
        ) : (
          <div>
            <label className={labelCls}>Flexibilité : ± {flex} j</label>
            <input type="range" min={0} max={7} value={flex} onChange={e => setFlex(Number(e.target.value))}
              className="w-full accent-[#0A84FF] mt-3" />
          </div>
        )}
      </div>

      {trip === 'round-trip' && (
        <div>
          <label className={labelCls}>Flexibilité : ± {flex} j</label>
          <input type="range" min={0} max={7} value={flex} onChange={e => setFlex(Number(e.target.value))}
            className="w-full accent-[#0A84FF]" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelCls}>Adultes</label>
          <input type="number" min={1} max={9} required value={adults} onChange={e => setAdults(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Enfants</label>
          <input type="number" min={0} max={8} value={children} onChange={e => setChildren(Number(e.target.value))} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Bébés</label>
          <input type="number" min={0} max={8} value={infants} onChange={e => setInfants(Number(e.target.value))} className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Cabine</label>
        <select value={seat} onChange={e => setSeat(e.target.value)} className={inputCls}>
          {Object.entries(SEAT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-[#FF453A]">{error}</p>}
      <button disabled={loading || !origins.length || !destinations.length || !departDate || (trip === 'round-trip' && !returnDate)}
        className="w-full rounded-xl bg-accent text-white font-medium py-2.5 text-sm hover:opacity-90 disabled:opacity-40 transition">
        {loading ? 'Enregistrement…' : watchId ? 'Mettre à jour la surveillance' : 'Créer la surveillance'}
      </button>
    </form>
  );
}
