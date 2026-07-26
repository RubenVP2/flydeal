// ============================================================
// TESTS — route API /api/watches (handlers appelés directement)
// DATA_DIR temporaire + lib/init mocké avant import du module.
// Couvre : GET liste, POST 201 (aller simple par défaut, aller-retour
// avec passagers), POST 400 (IATA invalide, retour manquant, retour
// avant départ, bébés > adultes, cabine invalide), PUT 200/404/400,
// DELETE 200/400/404.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

vi.mock('@/lib/init', () => ({ ensureInitialized: () => {} }));

let tmpDir: string;
let route: typeof import('@/app/api/watches/route');

function req(body?: unknown, method = 'POST', url = 'http://localhost/api/watches') {
  return new NextRequest(url, {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  });
}

const ONE_WAY = { origins: ['CDG'], destinations: ['JFK'], depart_date: '2026-09-10', flex_days: 3 };
const ROUND_TRIP = {
  ...ONE_WAY,
  trip: 'round-trip', return_date: '2026-09-24', adults: 2, children: 1, infants: 0, seat: 'business',
};

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flydeal-api-test-'));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  delete (globalThis as any).__flydealDb;
  route = await import('@/app/api/watches/route');
});

afterAll(() => {
  delete process.env.DATA_DIR;
  delete (globalThis as any).__flydealDb;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/watches', () => {
  it('201 — aller simple avec options par défaut', async () => {
    const res = await route.POST(req(ONE_WAY));
    expect(res.status).toBe(201);
    const w = await res.json();
    expect(w.trip).toBe('one-way');
    expect(w.return_date).toBeNull();
    expect(w.adults).toBe(1);
    expect(w.children).toBe(0);
    expect(w.infants).toBe(0);
    expect(w.seat).toBe('economy');
  });

  it('201 — aller-retour avec passagers et cabine', async () => {
    const res = await route.POST(req(ROUND_TRIP));
    expect(res.status).toBe(201);
    const w = await res.json();
    expect(w.trip).toBe('round-trip');
    expect(w.return_date).toBe('2026-09-24');
    expect(w.adults).toBe(2);
    expect(w.children).toBe(1);
    expect(w.seat).toBe('business');
  });

  it('400 — code IATA invalide', async () => {
    const res = await route.POST(req({ ...ONE_WAY, origins: ['cdg'] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/origins/);
  });

  it('400 — aller-retour sans return_date', async () => {
    const res = await route.POST(req({ ...ONE_WAY, trip: 'round-trip' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/return_date/);
  });

  it('400 — return_date antérieure à depart_date', async () => {
    const res = await route.POST(req({ ...ONE_WAY, trip: 'round-trip', return_date: '2026-09-01' }));
    expect(res.status).toBe(400);
  });

  it('400 — plus de bébés que d\'adultes', async () => {
    const res = await route.POST(req({ ...ONE_WAY, adults: 1, infants: 2 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/infants/);
  });

  it('400 — cabine invalide', async () => {
    const res = await route.POST(req({ ...ONE_WAY, seat: 'luxe' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/seat/);
  });

  it('400 — trip invalide / corps vide / flex hors limites', async () => {
    expect((await route.POST(req({ ...ONE_WAY, trip: 'allez-retour' }))).status).toBe(400);
    expect((await route.POST(req(null))).status).toBe(400);
    expect((await route.POST(req({ ...ONE_WAY, flex_days: 9 }))).status).toBe(400);
    expect((await route.POST(req({ ...ONE_WAY, adults: 0 }))).status).toBe(400);
    expect((await route.POST(req({ ...ONE_WAY, children: 9 }))).status).toBe(400);
  });
});

describe('GET /api/watches', () => {
  it('renvoie la liste des surveillances', async () => {
    const res = await route.GET();
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.some((w: any) => w.trip === 'round-trip')).toBe(true);
  });
});

describe('PUT /api/watches', () => {
  it('200 — met à jour la surveillance (passage en aller simple)', async () => {
    const created = await (await route.POST(req(ROUND_TRIP))).json();
    const res = await route.PUT(req({ ...ONE_WAY, id: created.id, return_date: '2026-09-24' }, 'PUT'));
    expect(res.status).toBe(200);
    const w = await res.json();
    expect(w.trip).toBe('one-way');
    expect(w.return_date).toBeNull(); // ignoré en aller simple
  });

  it('404 — surveillance introuvable', async () => {
    const res = await route.PUT(req({ ...ONE_WAY, id: 99999 }, 'PUT'));
    expect(res.status).toBe(404);
  });

  it('400 — id manquant ou payload invalide', async () => {
    expect((await route.PUT(req(ONE_WAY, 'PUT'))).status).toBe(400);
    expect((await route.PUT(req({ id: 1 }, 'PUT'))).status).toBe(400);
  });
});

describe('DELETE /api/watches', () => {
  it('200 — supprime une surveillance existante', async () => {
    const created = await (await route.POST(req(ONE_WAY))).json();
    const res = await route.DELETE(req(undefined, 'DELETE', `http://localhost/api/watches?id=${created.id}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('400 — id manquant', async () => {
    expect((await route.DELETE(req(undefined, 'DELETE'))).status).toBe(400);
  });

  it('404 — surveillance introuvable', async () => {
    expect((await route.DELETE(req(undefined, 'DELETE', 'http://localhost/api/watches?id=99999'))).status).toBe(404);
  });
});
