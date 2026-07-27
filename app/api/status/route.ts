import { NextResponse } from 'next/server';
import { getStatus } from '@/lib/scraper-status';

export const dynamic = 'force-dynamic';

// Statut de fiabilité des prix : mode réel/simulation et santé du
// scraper (échecs consécutifs, dernier succès, dernière erreur).
// Consommé par la bannière globale StatusBanner.
export async function GET() {
  return NextResponse.json(getStatus());
}
