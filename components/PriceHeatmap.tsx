'use client';
import { useState } from 'react';
import { PlaneTakeoff, PlaneLanding, Trophy } from 'lucide-react';
import type { FlightDetails } from '@/lib/price-engine';
import PriceCellModal, { PriceCellSelection } from './PriceCellModal';

// ============================================================
// HEATMAP PRIX — routes × dates de départ (type « dates
// flexibles » des comparateurs de vols). Lignes = routes
// (aéroport départ → arrivée), colonnes = dates de départ,
// cellule = dernier prix RÉELLEMENT mesuré sur les 30 derniers
// jours pour ce couple route × date. Échelle de couleur :
// vert = bon plan (min de la fenêtre), rouge = cher (max).
// La grille défile horizontalement, la colonne des routes reste
// collée à gauche. CLIC sur une cellule → popup détaillée :
// vol mesuré (compagnies, horaires, escales, appareil, CO₂),
// historique de la cellule et lien Google Flights. Aucune
// donnée fabriquée : les cellules sans relevé restent vides.
// ============================================================

export interface HeatmapPoint {
  origin: string;
  destination: string;
  departDate: string; // YYYY-MM-DD
  price: number;
  checkedAt: string;  // relevé UTC ("YYYY-MM-DD HH:MM:SS" ou ISO)
  details?: FlightDetails | null; // détail backend du vol mesuré
}

interface Cell { price: number; checkedAt: string }

const WEEKDAY_FMT = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const DAY_FMT = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const LONG_FMT = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

function fmtChecked(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

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
    cells.set(`${rowKey}::${p.departDate}`, { price: p.price, checkedAt: p.checkedAt });
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
        .map(p => ({ price: p.price, checkedAt: p.checkedAt, details: p.details ?? null }));
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
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelected({ rowKey: r.key, date: d })}
                      title={`${r.origin} → ${r.destination} · départ ${LONG_FMT.format(new Date(d + 'T12:00:00Z'))} : ${c.price.toFixed(0)} € (relevé le ${fmtChecked(c.checkedAt)}) — cliquer pour le détail`}
                      className={`w-[76px] h-12 shrink-0 flex items-center justify-center text-[13px] font-semibold text-white cursor-pointer transition-transform duration-100 hover:scale-[1.08] hover:rounded-md hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                        isBest ? 'ring-2 ring-inset ring-white/90' : ''
                      }`}
                      style={{ background: heatColor(t), textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
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
        {points.length} relevé{points.length > 1 ? 's' : ''} mesuré{points.length > 1 ? 's' : ''} sur les 30 derniers jours
        — chaque cellule affiche le dernier prix mesuré pour un couple route × date de départ.
        Touchez une cellule pour le détail du vol. Les cellules « – » n'ont pas encore de relevé.
      </p>

      {/* Popup détaillée de la cellule sélectionnée. */}
      {selection && <PriceCellModal cell={selection} onClose={() => setSelected(null)} />}
    </div>
  );
}
