'use client';
import { useState } from 'react';
import { ChevronDown, Lightbulb, AlertTriangle } from 'lucide-react';

export interface Tactic {
  id: string; title: string; description: string;
  estimatedSavings: number | null; savingsPct: number | null;
  warning: string | null;
  detail?: { label: string; price: number }[];
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
            <span className="flex items-center gap-2.5 font-medium text-sm sm:text-base">
              <Lightbulb size={16} className="text-accent shrink-0" />
              {t.title}
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
                    <li key={d.label} className="flex justify-between border-b border-black/5 dark:border-white/5 py-1.5 last:border-0">
                      <span className="opacity-70">{d.label}</span>
                      <span className="font-mono font-medium">{d.price} €</span>
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
