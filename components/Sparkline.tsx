'use client';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export default function Sparkline({ data }: { data: number[] }) {
  const pts = data.map((v, i) => ({ i, v }));
  const trendUp = data.length > 1 && data[data.length - 1] > data[0];
  return (
    <div className="w-24 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts}>
          <Line type="monotone" dataKey="v" dot={false} strokeWidth={1.5}
            stroke={trendUp ? '#FF453A' : '#30D158'} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
