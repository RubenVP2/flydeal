// Jauge de score 0-100 colorée (vert ≥65, orange 40-64, rouge <40).
export function scoreColor(score: number) {
  return score >= 65 ? '#30D158' : score >= 40 ? '#FF9F0A' : '#FF453A';
}

export default function ScoreGauge({ score, size = 96 }: { score: number; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
        style={{ transition: 'stroke-dashoffset .6s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="rotate-90"
        transform={`rotate(90 ${size / 2} ${size / 2})`} fill={color} fontSize={size * 0.26} fontWeight={700}>
        {score}
      </text>
    </svg>
  );
}
