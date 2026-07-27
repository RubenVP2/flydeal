'use client';
import { useEffect } from 'react';
import { X, ExternalLink, Clock, Leaf, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import type { FlightDetails } from '@/lib/price-engine';
import { relativeAge } from '@/lib/relative-age';

// ============================================================
// POPUP CELLULE HEATMAP — fiche complète d'un couple
// route × date de départ. Contenu :
//  · prix mesuré + tendance vs relevé précédent,
//  · détail du vol tel que fourni par le backend (flights-service
//    → Google Flights via fast-flights) au moment du relevé :
//    compagnies, segments avec horaires locaux et noms
//    d'aéroports, durées, appareil, escales, CO₂,
//  · historique 30 jours de la cellule (stats + sparkline + relevés),
//  · lien de vérification vers Google Flights.
// FIABILITÉ : un relevé de provider 'simulation' affiche un encart
// explicite « Prix simulé » ; un relevé réel rappelle en bas la
// méthode de mesure et l'âge du relevé.
// Style : carte iOS centrée — coins très arrondis, fond flouté,
// typographie SF, animations discrètes (fade + zoom).
// ============================================================

export interface CellPoint {
  price: number;
  checkedAt: string;               // relevé UTC
  details?: FlightDetails | null;  // détail backend capturé à ce relevé
  provider?: string | null;        // 'fast-flights' = réel · 'simulation' = fictif · null = source inconnue
}

export interface PriceCellSelection {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  points: CellPoint[]; // ordre chronologique
}

const LONG_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
});

function fmtChecked(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
}
// "YYYY-MM-DDTHH:MM" (heure locale aéroport) → "HH:MM"
function hm(iso: string | null): string {
  return iso ? iso.slice(11, 16) : '--:--';
}

// Mini-graphe SVG de l'historique de la cellule (aucune lib externe).
function HistorySpark({ values }: { values: number[] }) {
  const w = 100, h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-16">
      <defs>
        <linearGradient id="hsg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A84FF" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#0A84FF" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#hsg)" />
      <polyline points={pts} fill="none" stroke="#0A84FF" strokeWidth="1.5"
        vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function PriceCellModal({ cell, onClose }: { cell: PriceCellSelection; onClose: () => void }) {
  const latest = cell.points[cell.points.length - 1];
  const prev = cell.points.length > 1 ? cell.points[cell.points.length - 2] : null;
  const prices = cell.points.map(p => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = Math.round(prices.reduce((s, v) => s + v, 0) / prices.length);
  const delta = prev ? latest.price - prev.price : 0;
  const details = latest.details ?? null;
  const stopsLabel = details
    ? details.stops === 0
      ? 'Direct'
      : `${details.stops} escale${details.stops > 1 ? 's' : ''}`
    : '';
  const via = details && details.stops > 0 ? details.legs.slice(1).map(l => l.fromCode) : [];
  const co2 = details?.carbon;
  const co2Pct = co2 && co2.emissionG != null && co2.typicalG
    ? Math.round(((co2.emissionG - co2.typicalG) / co2.typicalG) * 100)
    : null;

  // Fermeture : Échap + verrouillage du scroll de fond.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const gfUrl = `https://www.google.com/travel/flights?hl=fr&curr=EUR&q=${encodeURIComponent(
    `Vols ${cell.origin} ${cell.destination} le ${cell.departDate}`,
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Fond flouté : clic = fermer. */}
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto overscroll-contain rounded-[28px] bg-white dark:bg-[#1c1c1e] shadow-2xl animate-zoom-in">
        <div className="p-6">
          {/* En-tête : route + date + fermeture. */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium opacity-50">
                Départ le {LONG_FMT.format(new Date(cell.departDate + 'T12:00:00Z'))}
              </p>
              <h3 className="text-[22px] font-bold tracking-tight mt-0.5 flex items-center gap-2">
                {cell.origin} <span className="opacity-40 font-normal">→</span> {cell.destination}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="shrink-0 rounded-full p-1.5 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Prix mesuré + tendance. */}
          <div className="mt-4 flex items-end gap-3 flex-wrap">
            <p className="text-[44px] leading-none font-bold tracking-tight tabular-nums">
              {latest.price.toFixed(0)}<span className="text-[26px] font-semibold"> €</span>
            </p>
            {delta !== 0 && (
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-1 ${
                delta < 0
                  ? 'bg-[#30D158]/15 text-[#1d7a38] dark:text-[#30D158]'
                  : 'bg-[#FF453A]/15 text-[#c0352b] dark:text-[#FF453A]'
              }`}>
                {delta < 0 ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(0)} € vs relevé précédent
              </span>
            )}
          </div>
          <p className="text-xs opacity-50 mt-1.5">
            Relevé {relativeAge(latest.checkedAt)} (le {fmtChecked(latest.checkedAt)}) · {cell.points.length} relevé{cell.points.length > 1 ? 's' : ''} sur 30 jours
          </p>

          {/* Détail du vol — données backend (Google Flights via fast-flights). */}
          {details ? (
            <div className="mt-5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.06] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-50 mb-3">
                Vol le moins cher mesuré · Google Flights
              </p>

              {details.airlines.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  {details.airlines.map(a => (
                    <span key={a} className="text-xs font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent">{a}</span>
                  ))}
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10">
                    {stopsLabel}{via.length ? ` · via ${via.join(', ')}` : ''}
                  </span>
                </div>
              )}

              {/* Segments : horaires locaux, noms d'aéroports, durée, appareil. */}
              <div className="space-y-3">
                {details.legs.map((leg, i) => (
                  <div key={i}>
                    <div className="border-l-2 border-accent/50 pl-3.5 space-y-1.5 py-0.5">
                      <p className="text-sm leading-tight">
                        <span className="font-bold tabular-nums">{hm(leg.departure)}</span>
                        <span className="font-semibold"> · {leg.fromCode}</span>
                        <span className="opacity-50"> · {leg.fromName}</span>
                      </p>
                      <p className="text-[11px] opacity-50 flex items-center gap-1">
                        <Clock size={10} />
                        {fmtDuration(leg.durationMin)}{leg.planeType ? ` · ${leg.planeType}` : ''}
                      </p>
                      <p className="text-sm leading-tight">
                        <span className="font-bold tabular-nums">{hm(leg.arrival)}</span>
                        <span className="font-semibold"> · {leg.toCode}</span>
                        <span className="opacity-50"> · {leg.toName}</span>
                      </p>
                    </div>
                    {i < details.legs.length - 1 && (
                      <p className="text-[11px] italic opacity-50 my-1 ml-1">
                        — Escale à {leg.toName || leg.toCode} —
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Synthèse : durée totale + CO₂. */}
              <div className="flex flex-wrap gap-1.5 mt-3.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-black/5 dark:bg-white/10">
                  <Clock size={11} /> {fmtDuration(details.totalDurationMin)} de vol
                </span>
                {co2Pct !== null && (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full ${
                    co2Pct <= 0
                      ? 'bg-[#30D158]/15 text-[#1d7a38] dark:text-[#30D158]'
                      : 'bg-[#FF453A]/15 text-[#c0352b] dark:text-[#FF453A]'
                  }`}>
                    <Leaf size={11} />
                    CO₂ {co2Pct > 0 ? '+' : ''}{co2Pct} % vs moyenne{co2?.emissionG ? ` · ${(co2.emissionG / 1000).toFixed(0)} kg` : ''}
                  </span>
                )}
              </div>
            </div>
          ) : latest.provider === 'simulation' ? (
            // Prix fictif de démonstration : encart explicite, jamais
            // présenté comme un prix réellement constaté.
            <p className="mt-5 flex items-start gap-2 rounded-2xl bg-[#FF9F0A]/15 text-[#8a5a00] dark:text-[#FF9F0A] text-[13px] font-medium p-3.5">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              Prix simulé — ne correspond pas au marché réel. Configurez FAST_FLIGHTS_URL pour obtenir des prix réels.
            </p>
          ) : (
            <p className="text-[11px] opacity-40 italic mt-5">
              Détail du vol indisponible pour ce relevé — enregistré avant l'activation des détails
              {latest.provider == null ? ' (source inconnue : relevé antérieur au suivi de source)' : ''}.
            </p>
          )}

          {/* Historique de la cellule sur 30 jours. */}
          <div className="mt-5">
            <div className="flex items-baseline justify-between flex-wrap gap-1 mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-50">Historique · 30 jours</p>
              <p className="text-[11px] opacity-60">
                Min <span className="text-[#30D158] font-semibold">{min.toFixed(0)} €</span> ·
                Moy <span className="font-semibold"> {avg} €</span> ·
                Max <span className="text-[#FF453A] font-semibold"> {max.toFixed(0)} €</span>
              </p>
            </div>
            {prices.length > 1 && <HistorySpark values={prices} />}
            <ul className="mt-2.5 space-y-1.5">
              {[...cell.points].slice(-4).reverse().map(p => (
                <li key={p.checkedAt} className="flex items-center justify-between text-xs">
                  <span className="opacity-50">Relevé le {fmtChecked(p.checkedAt)}</span>
                  <span className="font-semibold tabular-nums">{p.price.toFixed(0)} €</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action : vérifier le prix en direct à la source. */}
          <a
            href={gfUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center justify-center gap-1.5 rounded-full bg-accent text-white text-sm font-medium py-2.5 hover:opacity-90 active:scale-[0.98] transition"
          >
            Voir sur Google Flights <ExternalLink size={14} />
          </a>
          <p className="text-[10px] opacity-40 text-center mt-2">
            Le prix en direct peut différer du dernier relevé — il évolue entre deux vérifications.
          </p>
          {/* Prix réel : rappel de la méthode de mesure (scraping du tarif
              le plus bas, toutes options confondues) pour éviter toute
              confusion avec une recherche Google Flights classique. */}
          {latest.provider != null && latest.provider !== 'simulation' && (
            <p className="text-[10px] opacity-40 text-center mt-1.5">
              Tarif le plus bas constaté toutes options confondues (escales et bagage non inclus possibles) :
              un écart avec une recherche Google Flights classique est normal. Relevé {relativeAge(latest.checkedAt)}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
