// ============================================================
// TESTS — route API /api/check-now
// Vérifie qu'une vérification immédiate est déclenchée pour une
// surveillance existante (checkWatch mocké) et les cas d'erreur.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const checkWatch = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/init', () => ({ ensureInitialized: () => {} }));
vi.mock('@/lib/scheduler', () => ({ checkWatch: (...args: any[]) => checkWatch(...args) }));

let tmpDir: string;
let route: typeof import('@/app/api/check-now/route');
let db: typeof import('@/lib/db');

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flydeal-checknow-test-'));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  delete (globalThis as any).__flydealDb;
  route = await import('@/app/api/check-now/route');
  db = await import('@/lib/db');
});

afterAll(() => {
  delete process.env.DATA_DIR;
  delete (globalThis as any).__flydealDb;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('POST /api/check-now', () => {
  it('200 — déclenche checkWatch sur la surveillance demandée', async () => {
    const w = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3);
    const res = await route.POST(new NextRequest(`http://localhost/api/check-now?id=${w.id}`, { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(checkWatch).toHaveBeenCalledTimes(1);
    expect(checkWatch.mock.calls[0][0].id).toBe(w.id);
  });

  it('404 — surveillance introuvable ou id absent', async () => {
    expect((await route.POST(new NextRequest('http://localhost/api/check-now?id=99999', { method: 'POST' }))).status).toBe(404);
    expect((await route.POST(new NextRequest('http://localhost/api/check-now', { method: 'POST' }))).status).toBe(404);
  });
});
