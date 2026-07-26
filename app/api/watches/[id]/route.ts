import { NextRequest, NextResponse } from 'next/server';
import { getWatch, getPrices } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { computeDealScore } from '@/lib/deal-score';
import { computeTactics } from '@/lib/tactics';
import { distanceKm } from '@/lib/airports';
import { simulatePrice } from '@/lib/price-engine';
import { getPrimarySeriesPoints } from '@/lib/series';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  ensureInitialized();
  const w = getWatch(Number(params.id));
  if (!w) return NextResponse.json({ error: 'Surveillance introuvable' }, { status: 404 });
  const prices = getPrices(w.id);
  const km = distanceKm(w.origins[0], w.destinations[0]);
  // Score et stats : série principale uniquement (route + date cible),
  // pour rester cohérent avec la page de détail.
  const primary = getPrimarySeriesPoints(w, prices);
  const currentPrice = primary.length
    ? primary[primary.length - 1].price
    : simulatePrice(w.origins[0], w.destinations[0], w.depart_date);
  const score = computeDealScore({ currentPrice, history: primary, distanceKm: km, departDate: w.depart_date });
  const tactics = computeTactics(w, prices, currentPrice);
  const stats = primary.length
    ? {
        min: Math.min(...primary.map(p => p.price)),
        max: Math.max(...primary.map(p => p.price)),
        avg: Math.round((primary.reduce((s, p) => s + p.price, 0) / primary.length) * 100) / 100,
      }
    : null;
  return NextResponse.json({ watch: w, prices, currentPrice, score, tactics, stats, distanceKm: km });
}
