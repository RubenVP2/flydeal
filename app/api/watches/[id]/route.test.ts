// ============================================================
// TESTS — route API /api/watches/[id]
// Couvre : fiche complète (surveillance + prix + score + tactiques
// + stats), absence de fallback simulé sans historique (prix et
// score null, jamais de prix fictif présenté comme réel), 404.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

vi.mock('@/lib/init', () => ({ ensureInitialized: () => {} }));

let tmpDir: string;
let route: typeof import('@/app/api/watches/[id]/route');
let db: typeof import('@/lib/db');

const params = (id: number | string) => ({ params: { id: String(id) } });
const req = () => new NextRequest('http://localhost/api/watches/1');

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flydeal-watchid-test-'));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  delete (globalThis as any).__flydealDb;
  route = await import('@/app/api/watches/[id]/route');
  db = await import('@/lib/db');
});

afterAll(() => {
  delete process.env.DATA_DIR;
  delete (globalThis as any).__flydealDb;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/watches/[id]', () => {
  it('200 — fiche complète avec historique et stats', async () => {
    const w = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3, {
      trip: 'round-trip', returnDate: '2026-09-24', adults: 2, children: 0, infants: 0, seat: 'economy',
    });
    db.addPrice(w.id, 'CDG', 'JFK', '2026-09-10', 400, '2026-07-01 03:00:00');
    db.addPrice(w.id, 'CDG', 'JFK', '2026-09-10', 380, '2026-07-02 03:00:00');
    const res = await route.GET(req(), params(w.id));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.watch.trip).toBe('round-trip');
    expect(body.prices).toHaveLength(2);
    expect(body.currentPrice).toBe(380);
    expect(body.stats).toEqual({ min: 380, max: 400, avg: 390 });
    expect(body.score).toHaveProperty('score');
    expect(Array.isArray(body.tactics)).toBe(true);
    expect(body.distanceKm).toBeGreaterThan(5000);
  });

  it('200 — sans historique : prix courant et score null (jamais de prix simulé), stats null', async () => {
    const w = db.createWatch(['LYS'], ['LIS'], '2026-10-01', 2);
    const res = await route.GET(req(), params(w.id));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.prices).toHaveLength(0);
    expect(body.currentPrice).toBeNull();
    expect(body.score).toBeNull();
    expect(body.stats).toBeNull();
    // Les tactiques restent non chiffrées (méthode, sans montant).
    expect(Array.isArray(body.tactics)).toBe(true);
    expect(body.tactics.every((t: { estimatedSavings: number | null }) => t.estimatedSavings == null)).toBe(true);
  });

  it('404 — surveillance introuvable', async () => {
    expect((await route.GET(req(), params(99999))).status).toBe(404);
  });
});
