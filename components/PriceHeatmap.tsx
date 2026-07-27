'use client';
import { useState } from 'react';
import { PlaneTakeoff, PlaneLanding, Trophy } from 'lucide-react';
import type { FlightDetails } from '@/lib/price-engine';
import { relativeAge, ageMs } from '@/lib/relative-age';
import PriceCellModal, { PriceCellSelection } from './PriceCellModal';

// ============================================================
// HEATMAP PRIX — routes × dates de départ (type « dates
// flexibles » des comparateurs de vols). Lignes = routes
// (aéroport départ → arrivée), colonnes = dates de départ,
// cellule = dernier prix enregistré sur les 30 derniers jours
// pour ce couple route × date. Échelle de couleur :
// vert = bon plan (min de la fenêtre), rouge = cher (max).
// La grille défile horizontalement, la colonne des routes reste
// collée à gauche. CLIC sur une cellule → popup détaillée :
// vol mesuré (compagnies, horaires, escales, appareil, CO₂),
// historique de la cellule et lien Google Flights. Aucune
// donnée fabriquée : les cellules sans relevé restent vides.
// FIABILITÉ : la source de chaque relevé est visible —
//  · provider 'simulation' → contour pointillé + « Simulé » dans
//    le tooltip (prix fictif, jamais présenté comme réel) ;
//  · provider null (relevé antérieur au suivi de source) →
//    cellule estompée, source « inconnue » dans le tooltip ;
//  · relevé de plus de 12 h → cellule estompée (prix possiblement
//    périmé) ; le tooltip affiche l'âge relatif du relevé.
// ============================================================

export interface HeatmapPoint {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  price: number;
  checkedAt: string;  // relevé UTC ("YYYY-MM-DD HH:MM:SS" ou ISO)
  details?: FlightDetails | null; // détail backend du vol mesuré
  provider: string | null;        // 'fast-flights' = réel · 'simulation' = fictif · null = source inconnue
}

interface Cell { price: number; checkedAt: string; provider: string | null }

// Au-delà de 12 h, un relevé est considéré comme possiblement périmé.
const STALE_MS = 12 * 3600000;

const WEEKDAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const LONG_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// t = 0 → vert (bon plan), t = 1 → rouge (cher). Même échelle
// visuelle que les comparateurs : vert → jaune → orange → rouge.
function heatColor(t: number): string {
  const hue = 140 - 140 * t;
  return `hsl(${hue} 72% 42%)`;
}

export default function PriceHeatmap({ points }: { points: HeatmapPoint[] }) {
  // Cellule ouverte en popup (route + date), null = fermée.
  const [selected, setSelected] = useState<{ rowKey: string; date: string } | null>(null);

  // points arrivent triés par série (principale d'abord) puis
  // chronologiquement : la ligne garde l'ordre d'arrivée, et la
  // cellule conserve le DERNIER relevé (le plus récent écrase).
  const rows: { key: string; origin: string; destination: string }[] = [];
  const seenRows = new Set<string>();
  const dates = new Set<string>();
  const cells = new Map<string, Cell>(); // `${rowKey}::${date}`

  for (const p of points) {
    const rowKey = `${p.origin}|${p.destination}`;
    if (!seenRows.has(rowKey)) {
      seenRows.add(rowKey);
      rows.push({ key: rowKey, origin: p.origin, destination: p.destination });
    }
    dates.add(p.departDate);
    cells.set(`${rowKey}::${p.departDate}`, { price: p.price, checkedAt: p.checkedAt, provider: p.provider });
  }
  const cols = [...dates].sort();
  if (!rows.length || !cols.length) return null;

  const prices = [...cells.values()].map(c => c.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;

  // Meilleure cellule de la fenêtre (prix le plus bas).
  let best: { rowKey: string; date: string; price: number } | null = null;
  for (const [k, c] of cells) {
    if (c.price === min && !best) {
      const sep = k.lastIndexOf('::');
      best = { rowKey: k.slice(0, sep), date: k.slice(sep + 2), price: c.price };
    }
  }

  // Sélection courante → objet complet pour la popup (historique
  // chronologique du couple route × date + détail du dernier relevé).
  let selection: PriceCellSelection | null = null;
  if (selected) {
    const row = rows.find(r => r.key === selected.rowKey);
    if (row) {
      const cellPoints = points
        .filter(p => `${p.origin}|${p.destination}` === selected.rowKey && p.departDate === selected.date)
        .map(p => ({ price: p.price, checkedAt: p.checkedAt, details: p.details ?? null, provider: p.provider }));
      if (cellPoints.length) {
        selection = {
          origin: row.origin,
          destination: row.destination,
          departDate: selected.date,
          points: cellPoints,
        };
      }
    }
  }

  return (
    <div>
      {/* En-tête : meilleur prix détecté + légende de l'échelle. */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        {best && (
          <p className="text-sm flex items-center gap-1.5 flex-wrap">
            <Trophy size={14} className="text-[#30D158] shrink-0" />
            Meilleur prix : <span className="font-bold text-[#30D158]">{best.price.toFixed(0)}&nbsp;€</span>
            <span className="opacity-60">
              · {best.rowKey.replace('|', ' → ')} · départ {LONG_FMT.format(new Date(best.date + 'T12:00:00Z'))}
            </span>
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] opacity-70 ml-auto">
          <span>Bon plan</span>
          <div
            className="h-2 w-24 rounded-full"
            style={{ background: 'linear-gradient(to right, hsl(140 72% 42%), hsl(70 72% 45%), hsl(0 72% 50%))' }}
          />
          <span>Cher</span>
        </div>
      </div>

      {/* Grille scrollable : horizontalement pour les dates, la colonne routes reste fixe. */}
      <div className="relative">
        <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-black/5 dark:border-white/10">
          <div className="min-w-max">
            {/* Ligne d'en-tête : dates de départ. */}
            <div className="flex border-b border-black/5 dark:border-white/10">
              <div className="sticky left-0 z-20 w-32 sm:w-40 shrink-0 px-3 py-2 text-[11px] font-medium opacity-60 bg-white dark:bg-[#1c1c1e]">
                Route ↓ · Départ →
              </div>
              {cols.map(d => {
                const dt = new Date(d + 'T12:00:00Z');
                return (
                  <div key={d} className="w-[76px] shrink-0 px-1 py-1.5 text-center">
                    <p className="text-[10px] uppercase opacity-50">{WEEKDAY_FMT.format(dt)}</p>
                    <p className="text-[11px] font-semibold">{DAY_FMT.format(dt)}</p>
                  </div>
                );
              })}
            </div>

            {/* Une ligne par route. */}
            {rows.map(r => (
              <div key={r.key} className="flex border-b last:border-b-0 border-black/5 dark:border-white/10">
                <div className="sticky left-0 z-10 w-32 sm:w-40 shrink-0 px-3 py-2 flex items-center gap-1 text-[12px] font-medium bg-white dark:bg-[#1c1c1e]">
                  <PlaneTakeoff size={11} className="opacity-40 shrink-0" /> {r.origin}
                  <span className="opacity-40">→</span> {r.destination}
                  <PlaneLanding size={11} className="opacity-40 shrink-0" />
                </div>
                {cols.map(d => {
                  const c = cells.get(`${r.key}::${d}`);
                  if (!c) {
                    return (
                      <div key={d} className="w-[76px] h-12 shrink-0 flex items-center justify-center text-black/15 dark:text-white/15 text-xs">
                        –
                      </div>
                    );
                  }
                  const t = (c.price - min) / span;
                  const isBest = best !== null && r.key === best.rowKey && d === best.date;
                  // Fiabilité du relevé : prix simulé (fictif), source
                  // inconnue (avant le suivi de provider) ou relevé de
                  // plus de 12 h → la cellule ne doit pas paraître aussi
                  // fiable qu'un prix réel et frais.
                  const simulated = c.provider === 'simulation';
                  const unknownSource = c.provider == null;
                  const stale = ageMs(c.checkedAt) > STALE_MS;
                  const faded = simulated || unknownSource || stale;
                  const sourceLabel = simulated
                    ? ' · prix SIMULÉ (démonstration, ne correspond pas au marché réel)'
                    : unknownSource ? ' · source inconnue' : '';
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelected({ rowKey: r.key, date: d })}
                      title={`${r.origin} → ${r.destination} · départ ${LONG_FMT.format(new Date(d + 'T12:00:00Z'))} : ${c.price.toFixed(0)} € (relevé ${relativeAge(c.checkedAt)})${sourceLabel} — cliquer pour le détail`}
                      className={`w-[76px] h-12 shrink-0 flex items-center justify-center text-[13px] font-semibold text-white cursor-pointer transition-transform duration-100 hover:scale-[1.08] hover:rounded-md hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                        isBest ? 'ring-2 ring-inset ring-white/90' : ''
                      }`}
                      style={{
                        background: heatColor(t),
                        textShadow: '0 1px 2px rgba(0,0,0,.35)',
                        opacity: faded ? 0.45 : 1,
                        ...(simulated
                          ? { outline: '2px dashed rgba(255,255,255,.9)', outlineOffset: '-3px' }
                          : {}),
                      }}
                    >
                      {c.price.toFixed(0)}&nbsp;€
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Fondu à droite : indique que la grille défile. */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-xl bg-gradient-to-l from-white dark:from-[#1c1c1e] to-transparent" />
      </div>

      <p className="text-[11px] opacity-40 mt-2">
        {points.length} relevé{points.length > 1 ? 's' : ''} sur les 30 derniers jours
        — chaque cellule affiche le dernier prix enregistré pour un couple route × date de départ.
        Touchez une cellule pour le détail du vol. Les cellules « – » n'ont pas encore de relevé.
        Cellules en pointillé = prix simulés (démonstration) ; cellules estompées = relevé de plus de 12 h ou source inconnue.
      </p>

      {/* Popup détaillée de la cellule sélectionnée. */}
      {selection && <PriceCellModal cell={selection} onClose={() => setSelected(null)} />}
    </div>
  );
}
