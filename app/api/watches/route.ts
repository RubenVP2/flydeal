import { NextRequest, NextResponse } from 'next/server';
import { listWatches, createWatch, getWatch, updateWatch, deleteWatch, setNextCheck } from '@/lib/db';
import { ensureInitialized } from '@/lib/init';
import { nextCheckTime } from '@/lib/scheduler';
import { SearchOptions, TripType, SeatClass } from '@/lib/price-engine';

export const dynamic = 'force-dynamic';

const SEAT_CLASSES: SeatClass[] = ['economy', 'premium-economy', 'business', 'first'];

// Valide le corps POST/PUT et renvoie { error } ou { options } (défauts appliqués).
function validate(body: any): { error?: string; options?: SearchOptions } {
  const { origins, destinations, depart_date, flex_days } = body ?? {};
  if (!Array.isArray(origins) || !origins.length || !origins.every((o: any) => typeof o === 'string' && /^[A-Z]{3}$/.test(o)))
    return { error: 'origins : tableau de codes IATA (3 lettres majuscules) requis' };
  if (!Array.isArray(destinations) || !destinations.length || !destinations.every((o: any) => typeof o === 'string' && /^[A-Z]{3}$/.test(o)))
    return { error: 'destinations : tableau de codes IATA requis' };
  if (typeof depart_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(depart_date))
    return { error: 'depart_date : format YYYY-MM-DD requis' };
  if (typeof flex_days !== 'number' || flex_days < 0 || flex_days > 7)
    return { error: 'flex_days : nombre entre 0 et 7 requis' };

  // Options de recherche : toutes optionnelles, avec défauts.
  const trip: TripType = body.trip ?? 'one-way';
  if (trip !== 'one-way' && trip !== 'round-trip')
    return { error: "trip : 'one-way' ou 'round-trip' requis" };

  let returnDate: string | null = body.return_date ?? null;
  if (trip === 'round-trip') {
    if (typeof returnDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(returnDate))
      return { error: 'return_date : format YYYY-MM-DD requis pour un aller-retour' };
    if (returnDate < depart_date)
      return { error: 'return_date : doit être postérieure ou égale à depart_date' };
  } else {
    returnDate = null; // ignoré en aller simple
  }

  const intIn = (v: any, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  const adults = body.adults ?? 1;
  const children = body.children ?? 0;
  const infants = body.infants ?? 0;
  if (!intIn(adults, 1, 9)) return { error: 'adults : entier entre 1 et 9 requis' };
  if (!intIn(children, 0, 8)) return { error: 'children : entier entre 0 et 8 requis' };
  if (!intIn(infants, 0, 8)) return { error: 'infants : entier entre 0 et 8 requis' };
  if (infants > adults) return { error: 'infants : ne peut pas dépasser le nombre d\'adultes' };

  const seat: SeatClass = body.seat ?? 'economy';
  if (!SEAT_CLASSES.includes(seat))
    return { error: 'seat : economy, premium-economy, business ou first requis' };

  return { options: { trip, returnDate, adults, children, infants, seat } };
}

export async function GET() {
  ensureInitialized();
  return NextResponse.json(listWatches());
}

export async function POST(req: NextRequest) {
  ensureInitialized();
  const body = await req.json().catch(() => null);
  const { error, options } = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const w = createWatch(body.origins, body.destinations, body.depart_date, body.flex_days, options);
  setNextCheck(w.id, nextCheckTime(w).toISOString());
  return NextResponse.json(getWatch(w.id), { status: 201 });
}

export async function PUT(req: NextRequest) {
  ensureInitialized();
  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'id requis' }, { status: 400 });
  const { error, options } = validate(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const w = updateWatch(body.id, body.origins, body.destinations, body.depart_date, body.flex_days, options);
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
