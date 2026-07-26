import { NextRequest, NextResponse } from 'next/server';
import { listWatches, createWatch, getWatch, updateWatch, deleteWatch, setNextCheck } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { nextCheckTime } from '@/lib/scheduler';

export const dynamic = 'force-dynamic';

function validate(body: any): string | null {
  const { origins, destinations, depart_date, flex_days } = body ?? {};
  if (!Array.isArray(origins) || !origins.length || !origins.every((o: any) => typeof o === 'string' && /^[A-Z]{3}$/.test(o)))
    return 'origins : tableau de codes IATA (3 lettres majuscules) requis';
  if (!Array.isArray(destinations) || !destinations.length || !destinations.every((o: any) => typeof o === 'string' && /^[A-Z]{3}$/.test(o)))
    return 'destinations : tableau de codes IATA requis';
  if (typeof depart_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(depart_date))
    return 'depart_date : format YYYY-MM-DD requis';
  if (typeof flex_days !== 'number' || flex_days < 0 || flex_days > 7)
    return 'flex_days : nombre entre 0 et 7 requis';
  return null;
}

export async function GET() {
  ensureInitialized();
  return NextResponse.json(listWatches());
}

export async function POST(req: NextRequest) {
  ensureInitialized();
  const body = await req.json().catch(() => null);
  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const w = createWatch(body.origins, body.destinations, body.depart_date, body.flex_days);
  setNextCheck(w.id, nextCheckTime(w).toISOString());
  return NextResponse.json(getWatch(w.id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  ensureInitialized();
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });
  const w = updateWatch(body.id, body.origins, body.destinations, body.depart_date, body.flex_days);
  if (!w) return NextResponse.json({ error: 'Surveillance introuvable' }, { status: 404 });
  setNextCheck(w.id, nextCheckTime(w).toISOString());
  return NextResponse.json(getWatch(w.id));
}

export async function DELETE(req: NextRequest) {
  ensureInitialized();
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  if (!deleteWatch(id)) return NextResponse.json({ error: 'Surveillance introuvable' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
