// ============================================================
// TESTS — lib/current-price.ts + garde anti-régression :
// aucun écran ni endpoint ne doit retomber sur simulatePrice
// quand il n'y a pas de relevé (un prix fictif affiché comme
// réel est le bug majeur corrigé ici).
// Lancer : npm test
// ============================================================
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { latestMeasuredPrice } from './current-price';
import type { PricePoint } from './db';

function point(price: number, checkedAt: string): PricePoint {
  return {
    id: 0, watch_id: 1, origin: 'CDG', destination: 'JFK',
    depart_date: '2026-09-10', price, checked_at: checkedAt,
    details: null, provider: 'fast-flights',
  };
}

describe('latestMeasuredPrice', () => {
  it('renvoie null quand il n\'y a aucun relevé (jamais de prix simulé)', () => {
    expect(latestMeasuredPrice([])).toBeNull();
  });

  it('renvoie le dernier prix mesuré de la série', () => {
    expect(latestMeasuredPrice([point(400, '2026-07-01 03:00:00')])).toBe(400);
    expect(latestMeasuredPrice([
      point(400, '2026-07-01 03:00:00'),
      point(380, '2026-07-02 03:00:00'),
    ])).toBe(380);
  });
});

describe('garde anti-régression — pas de fallback simulatePrice hors SimulationProvider', () => {
  // Écrans et endpoint qui affichaient un prix simulé comme réel.
  const FILES_SANS_FALLBACK = [
    'app/page.tsx',
    'app/surveillance/[id]/page.tsx',
    'app/contournements/page.tsx',
    'app/api/watches/[id]/route.ts',
  ];

  it.each(FILES_SANS_FALLBACK)('%s n\'utilise pas simulatePrice', (rel) => {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
    expect(src).not.toContain('simulatePrice');
    expect(src).toContain('latestMeasuredPrice');
  });

  it('simulatePrice reste réservé au moteur de prix (SimulationProvider) et à ses tests', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'lib/current-price.ts'), 'utf8');
    expect(src).not.toContain('simulatePrice(');
  });
});
