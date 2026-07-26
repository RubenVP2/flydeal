import ScoreGauge, { scoreColor } from './ScoreGauge';

interface Component { key: string; label: string; value: number; weight: number; detail: string }
interface Score {
  score: number; verdict: 'good' | 'ok' | 'bad'; verdictLabel: string;
  confidence: 'low' | 'medium' | 'high'; dropProbability: number; components: Component[];
}

const VERDICT_EMOJI = { good: '🟢', ok: '🟡', bad: '🔴' } as const;
const CONF_LABEL = { low: 'Faible', medium: 'Moyenne', high: 'Élevée' } as const;

// Panneau du verdict Deal Score avec décomposition pondérée.
export default function VerdictPanel({ score }: { score: Score }) {
  return (
    <div className="card animate-fade-in">
      <div className="flex items-center gap-5 flex-wrap">
        <ScoreGauge score={score.score} />
        <div className="flex-1 min-w-[200px]">
          <p className="text-lg font-semibold">{VERDICT_EMOJI[score.verdict]} {score.verdictLabel}</p>
          <p className="text-sm opacity-60 mt-1">
            Confiance : {CONF_LABEL[score.confidence]} · Probabilité estimée de baisse : {Math.round(score.dropProbability * 100)} %
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Décomposition du score</p>
        {score.components.map(c => (
          <div key={c.key} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 opacity-70">{c.label} <span className="opacity-50 text-xs">({Math.round(c.weight * 100)} %)</span></span>
            <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${c.value}%`, background: scoreColor(c.value) }} />
            </div>
            <span className="w-8 text-right font-mono text-xs">{Math.round(c.value)}</span>
          </div>
        ))}
        {score.components.map(c => (
          <p key={c.key + '-d'} className="text-xs opacity-50">· {c.detail}</p>
        ))}
      </div>
    </div>
  );
}
