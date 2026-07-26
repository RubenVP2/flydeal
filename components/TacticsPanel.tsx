'use client';
import { useState } from 'react';
import { ChevronDown, Lightbulb, AlertTriangle, LineChart, BookOpen } from 'lucide-react';

export interface Tactic {
  id: string; title: string; description: string;
  estimatedSavings: number | null; savingsPct: number | null;
  warning: string | null;
  source: 'observed' | 'method';
  detail?: { label: string; price: number | null }[];
}

// Badge de provenance : rassure sur la véracité de l'information.
// - 'observed' : chiffres calculés depuis les relevés enregistrés.
// - 'method'   : méthode générale documentée, sans chiffre projeté.
function SourceBadge({ source }: { source: Tactic['source'] }) {
  return source === 'observed' ? (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#30D158] bg-[#30D158]/10 px-2 py-0.5 rounded-full">
      <LineChart size={10} /> Données mesurées
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold opacity-60 bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded-full">
      <BookOpen size={10} /> Méthode
    </span>
  );
}

// Panneau accordéon des tactiques de contournement.
export default function TacticsPanel({ tactics }: { tactics: Tactic[] }) {
  const [open, setOpen] = useState<string | null>(tactics[0]?.id ?? null);
  if (!tactics.length) return null;
  return (
    <div className="space-y-3">
      {tactics.map(t => (
        <div key={t.id} className="card !p-0 overflow-hidden animate-fade-in">
          <button onClick={() => setOpen(open === t.id ? null : t.id)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left">
            <span className="flex items-center gap-2.5 font-medium text-sm sm:text-base flex-wrap">
              <Lightbulb size={16} className="text-accent shrink-0" />
              {t.title}
              <SourceBadge source={t.source} />
            </span>
            <span className="flex items-center gap-3 shrink-0">
              {t.estimatedSavings != null && t.estimatedSavings > 0 && (
                <span className="text-xs font-semibold text-[#30D158] bg-[#30D158]/10 px-2 py-1 rounded-full">
                  −{t.estimatedSavings} €{t.savingsPct != null && t.savingsPct > 0 ? ` (−${t.savingsPct} %)` : ''}
                </span>
              )}
              <ChevronDown size={16} className={`transition-transform ${open === t.id ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {open === t.id && (
            <div className="px-5 pb-5 pt-1 space-y-3 animate-fade-in">
              <p className="text-sm opacity-75 leading-relaxed">{t.description}</p>
              {t.detail && (
                <ul className="text-sm space-y-1">
                  {t.detail.map(d => (
                    <li key={d.label} className="flex justify-between gap-3 border-b border-black/5 dark:border-white/5 py-1.5 last:border-0">
                      <span className="opacity-70">{d.label}</span>
                      {d.price != null && <span className="font-mono font-medium">{d.price.toFixed(0)} €</span>}
                    </li>
                  ))}
                </ul>
              )}
              {t.warning && (
                <p className="text-xs flex gap-2 items-start bg-[#FF9F0A]/10 text-[#B25000] dark:text-[#FFB340] rounded-xl p-3">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {t.warning}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
