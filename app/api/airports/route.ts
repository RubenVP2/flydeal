import { NextRequest, NextResponse } from 'next/server';
import { searchAirports } from '@/lib/airports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || '';
  return NextResponse.json(searchAirports(q));
}
