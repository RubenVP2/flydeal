'use client';
import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { PlaneTakeoff, PlaneLanding } from 'lucide-react';

// ============================================================
// GRAPHIQUE D'HISTORIQUE DE PRIX — une courbe = UNE route
// (aéroport de départ → aéroport d'arrivée) pour UNE date de
// départ. Chaque relevé affiché est un prix réellement mesuré :
// le graphique démarre au premier relevé disponible, sans
// aucune donnée passée fabriquée. Quand la surveillance couvre
// plusieurs routes ou dates flexibles, un sélecteur permet de
// choisir la série affichée.
// ============================================================

export interface ChartPoint { checked_at: string; price: number }
export interface ChartSeries {
  key: string;
  origin: string;
  destination: string;
  departDate: string;
  points: ChartPoint[];   // fenêtre affichée (30 derniers jours)
  allTimeMin: number;     // minimum toutes périodes, pour la ligne de référence
  totalPoints: number;    // nb total de relevés de la série (hors fenêtre incluse)
}

function fmtDateTime(iso: string): string {
  // checked_at est stocké en UTC ("YYYY-MM-DD HH:MM:SS" ou ISO).
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function fmtDay(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}
function fmtDepart(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Infobulle détaillée : aéroports de départ/arrivée, date de départ,
// date/heure exacte du relevé, prix mesuré.
function ChartTooltip({ active, payload, series }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl px-3.5 py-2.5 text-[13px] shadow-xl bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur border border-black/5 dark:border-white/10">
      <p className="font-semibold flex items-center gap-1.5">
        <PlaneTakeoff size={13} className="opacity-60" /> {series.origin}
        <span className="opacity-40">→</span>
        <PlaneLanding size={13} className="opacity-60" /> {series.destination}
      </p>
      <p className="opacity-60 mt-1">Départ le {fmtDepart(series.departDate)}</p>
      <p className="opacity-60">Relevé le {fmtDateTime(p.raw)}</p>
      <p className="font-bold text-base mt-1 text-accent">{p.price.toFixed(0)} €</p>
    </div>
  );
}

export default function PriceHistoryChart({ series }: { series: ChartSeries[] }) {
  const [selected, setSelected] = useState<string>(series[0]?.key ?? '');
  const current = series.find(s => s.key === selected) ?? series[0];
  if (!current) return null;

  const data = current.points.map(p => ({
    date: fmtDay(p.checked_at),
    price: p.price,
    raw: p.checked_at,
  }));
  const prices = current.points.map(p => p.price);
  const stats = prices.length ? {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: Math.round(prices.reduce((s, v) => s + v, 0) / prices.length),
    current: prices[prices.length - 1],
  } : null;
  const refMin = Math.min(current.allTimeMin, stats?.min ?? current.allTimeMin);

  return (
    <div>
      {/* Sélecteur de série : visible uniquement s'il y a plusieurs routes/dates suivies. */}
      {series.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 -mx-1 px-1">
          {series.map(s => (
            <button
              key={s.key}
              onClick={() => setSelected(s.key)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                s.key === current.key
                  ? 'bg-accent text-white'
                  : 'bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15'
              }`}
            >
              {s.origin} → {s.destination} · {new Date(s.departDate + 'T12:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </button>
          ))}
        </div>
      )}

      {/* En-tête : route + statistiques réelles de la série affichée. */}
      <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <PlaneTakeoff size={14} className="opacity-50" /> {current.origin}
          <span className="opacity-40">→</span>
          <PlaneLanding size={14} className="opacity-50" /> {current.destination}
          <span className="opacity-50 font-normal">· départ {fmtDepart(current.departDate)}</span>
        </p>
        {stats && (
          <p className="text-xs opacity-60">
            Min <span className="text-[#30D158] font-semibold">{stats.min.toFixed(0)} €</span> ·
            Moy <span className="font-semibold"> {stats.avg} €</span> ·
            Max <span className="text-[#FF453A] font-semibold"> {stats.max.toFixed(0)} €</span> ·
            Actuel <span className="font-semibold"> {stats.current.toFixed(0)} €</span>
          </p>
        )}
      </div>

      {data.length > 1 ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0A84FF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#0A84FF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.08} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} strokeOpacity={0.4} minTickGap={40} />
              <YAxis tick={{ fontSize: 11 }} strokeOpacity={0.4} domain={['auto', 'auto']} tickFormatter={v => `${v}€`} width={56} />
              <Tooltip content={<ChartTooltip series={current} />} />
              <ReferenceLine y={refMin} stroke="#30D158" strokeDasharray="4 4" label={{ value: `min ${refMin.toFixed(0)}€`, fontSize: 11, fill: '#30D158' }} />
              <Area type="monotone" dataKey="price" stroke="#0A84FF" strokeWidth={2} fill="url(#pg)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-sm opacity-50 py-10 text-center">
          {data.length === 1
            ? 'Un seul relevé pour l\'instant — la courbe apparaîtra dès le prochain relevé.'
            : 'Pas encore de relevé sur cette période — l\'historique se construit depuis le lancement de la surveillance.'}
        </p>
      )}
      <p className="text-[11px] opacity-40 mt-2">
        {current.totalPoints} relevé{current.totalPoints > 1 ? 's' : ''} enregistré{current.totalPoints > 1 ? 's' : ''} pour cette route — aucun historique n\'est fabriqué : seuls les prix mesurés depuis la création de la surveillance sont affichés.
      </p>
    </div>
  );
}
