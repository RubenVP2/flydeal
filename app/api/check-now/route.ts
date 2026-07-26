import { NextRequest, NextResponse } from 'next/server';
import { getWatch } from '@/lib/db';
import { checkWatch } from '@/lib/scheduler';
import { ensureInitialized } from '@/lib/init';

export const dynamic = 'force-dynamic';

// Force une vérification immédiate d'une surveillance.
export async function POST(req: NextRequest) {
  ensureInitialized();
  const id = Number(new URL(req.url).searchParams.get('id'));
  const w = getWatch(id);
  if (!w) return NextResponse.json({ error: 'Surveillance introuvable' }, { status: 404 });
  await checkWatch(w);
  return NextResponse.json({ ok: true });
}
