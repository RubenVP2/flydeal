'use client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';

interface Point { checked_at: string; price: number }

// Graphique complet de l'historique de prix (recharts AreaChart).
export default function PriceHistoryChart({ prices }: { prices: Point[] }) {
  const data = prices.map(p => ({
    date: p.checked_at.slice(5, 10),
    time: p.checked_at.slice(5, 16).replace('T', ' '),
    price: p.price,
  }));
  const min = Math.min(...prices.map(p => p.price));
  return (
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
          <Tooltip
            formatter={(v: any) => [`${v} €`, 'Prix']}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.time ?? ''}
            contentStyle={{ borderRadius: 12, border: 'none', fontSize: 13, boxShadow: '0 4px 24px rgba(0,0,0,.15)' }}
          />
          <ReferenceLine y={min} stroke="#30D158" strokeDasharray="4 4" label={{ value: `min ${min}€`, fontSize: 11, fill: '#30D158' }} />
          <Area type="monotone" dataKey="price" stroke="#0A84FF" strokeWidth={2} fill="url(#pg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
