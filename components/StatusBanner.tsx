'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { relativeAge } from '@/lib/relative-age';

// ============================================================
// BANNIÈRE DE STATUT — fiabilité des prix affichés, visible sur
// toutes les pages. Interroge /api/status toutes les 60 s.
//  · Mode simulation (FAST_FLIGHTS_URL absente) → bannière rouge :
//    les prix affichés sont FICTIFS, jamais présentés comme réels.
//  · Mode live mais scraper en échec (≥ 3 échecs consécutifs) →
//    bannière ambre : les prix peuvent être périmés.
//  · Sinon → rien (UX épurée).
// ============================================================

interface Status {
  mode: 'live' | 'simulation';
  scraper: {
    ok: boolean;
    consecutiveFailures: number;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  updatedAt: string;
}

export default function StatusBanner() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (!cancelled) setStatus(data);
      } catch { /* statut indisponible : pas de bannière plutôt qu'une fausse alerte */ }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  if (!status) return null;

  // Mode démonstration : prix 100 % fictifs — alerte bloquante, rouge.
  if (status.mode === 'simulation') {
    return (
      <div role="alert" className="bg-[#FF453A] text-white">
        <p className="max-w-5xl mx-auto px-4 sm:px-6 py-2 text-[13px] font-medium flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          ⚠️ Mode démonstration : les prix affichés sont SIMULÉS et ne correspondent pas au marché réel.
          Configurez FAST_FLIGHTS_URL pour obtenir des prix réels.
        </p>
      </div>
    );
  }

  // Scraper réel en échec répété : les derniers relevés vieillissent.
  if (status.scraper.consecutiveFailures >= 3) {
    const since = status.scraper.lastSuccessAt ? relativeAge(status.scraper.lastSuccessAt) : null;
    return (
      <div role="alert" className="bg-[#FF9F0A] text-black">
        <p className="max-w-5xl mx-auto px-4 sm:px-6 py-2 text-[13px] font-medium flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          Les prix n'ont pas pu être actualisés {since ? `depuis ${since}` : 'pour le moment'}
          — les montants affichés peuvent être périmés.
        </p>
      </div>
    );
  }

  return null;
}
