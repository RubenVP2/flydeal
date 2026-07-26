'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface Airport { iata: string; name: string; city: string; country: string }

// Champ de sélection multi-aéroports avec autocomplete sur l'API /api/airports.
export default function AirportPicker({ label, values, onChange }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`);
      setResults(await res.json());
      setOpen(true);
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-sm font-medium mb-1.5 opacity-70">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 bg-accent/10 text-accent px-2.5 py-1 rounded-full text-sm font-medium">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} aria-label={`Retirer ${v}`}>
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => q && setOpen(true)}
        placeholder="Ville, aéroport ou code IATA…"
        className="w-full rounded-xl bg-black/[0.04] dark:bg-white/[0.07] px-3.5 py-2.5 text-sm outline-none focus:ring-2 ring-accent/50 transition"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full glass rounded-xl overflow-hidden max-h-60 overflow-y-auto">
          {results.filter(a => !values.includes(a.iata)).map(a => (
            <li key={a.iata}>
              <button
                type="button"
                className="w-full text-left px-3.5 py-2.5 text-sm hover:bg-accent/10 transition-colors flex justify-between"
                onClick={() => { onChange([...values, a.iata]); setQ(''); setOpen(false); }}
              >
                <span>{a.city} — {a.name}</span>
                <span className="font-mono font-semibold text-accent">{a.iata}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
