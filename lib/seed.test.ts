// ============================================================
// TESTS — seed de démonstration (lib/seed.ts)
// Vérifie : insertion de 3 surveillances de démo sur base vide
// (dont une aller-retour 2 adultes), historique de prix généré,
// et no-op sur base déjà remplie.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

let tmpDir: string;
let db: typeof import('@/lib/db');
let seed: typeof import('@/lib/seed');

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flydeal-seed-test-'));
  process.env.DATA_DIR = tmpDir;
  vi.resetModules();
  delete (globalThis as any).__flydealDb;
  db = await import('@/lib/db');
  seed = await import('@/lib/seed');
});

afterAll(() => {
  delete process.env.DATA_DIR;
  delete (globalThis as any).__flydealDb;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('seedIfEmpty', () => {
  it('insère 3 surveillances de démo dont une aller-retour 2 adultes', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    seed.seedIfEmpty();
    const watches = db.listWatches();
    expect(watches).toHaveLength(3);
    const rt = watches.find(w => w.trip === 'round-trip');
    expect(rt).toBeDefined();
    expect(rt!.adults).toBe(2);
    expect(rt!.return_date).not.toBeNull();
    expect(rt!.return_date! > rt!.depart_date).toBe(true);
    // Historique de prix généré et prochaine vérification planifiée.
    for (const w of watches) {
      expect(db.getPrices(w.id).length).toBeGreaterThan(0);
      expect(w.next_check_at).toBeTruthy();
    }
  });

  it('ne fait rien si la base contient déjà des surveillances', () => {
    seed.seedIfEmpty();
    expect(db.listWatches()).toHaveLength(3);
  });
});
