// ============================================================
// TESTS — couche de persistance SQLite (lib/db.ts)
// Chaque test charge le module avec un DATA_DIR temporaire neuf
// (vi.resetModules + import dynamique) pour isoler la base.
// Couvre : CRUD des surveillances, options de recherche (défauts
// et valeurs complètes), relevés de prix, planification, et la
// migration des colonnes d'options sur une base à l'ancien schéma.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import type { SearchOptions } from './price-engine';

const FULL_OPTIONS: SearchOptions = {
  trip: 'round-trip', returnDate: '2026-09-24', adults: 2, children: 1, infants: 0, seat: 'business',
};

let tmpDirs: string[] = [];

function freshDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flydeal-db-test-'));
  tmpDirs.push(dir);
  return dir;
}

// Importe lib/db à neuf sur un DATA_DIR temporaire (singleton global réinitialisé).
async function loadDb(dir = freshDir()) {
  process.env.DATA_DIR = dir;
  vi.resetModules();
  delete (globalThis as any).__flydealDb;
  return await import('./db');
}

afterEach(() => {
  delete process.env.DATA_DIR;
  delete (globalThis as any).__flydealDb;
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  tmpDirs = [];
});

describe('db — surveillances', () => {
  it('crée une surveillance avec les options par défaut', async () => {
    const db = await loadDb();
    const w = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3);
    expect(w.id).toBeGreaterThan(0);
    expect(w.origins).toEqual(['CDG']);
    expect(w.destinations).toEqual(['JFK']);
    expect(w.depart_date).toBe('2026-09-10');
    expect(w.flex_days).toBe(3);
    expect(w.trip).toBe('one-way');
    expect(w.return_date).toBeNull();
    expect(w.adults).toBe(1);
    expect(w.children).toBe(0);
    expect(w.infants).toBe(0);
    expect(w.seat).toBe('economy');
  });

  it('crée une surveillance avec des options complètes', async () => {
    const db = await loadDb();
    const w = db.createWatch(['CDG', 'ORY'], ['JFK'], '2026-09-10', 2, FULL_OPTIONS);
    expect(w.trip).toBe('round-trip');
    expect(w.return_date).toBe('2026-09-24');
    expect(w.adults).toBe(2);
    expect(w.children).toBe(1);
    expect(w.infants).toBe(0);
    expect(w.seat).toBe('business');
    expect(db.watchOptions(w)).toEqual(FULL_OPTIONS);
  });

  it('getWatch / listWatches / deleteWatch', async () => {
    const db = await loadDb();
    expect(db.getWatch(999)).toBeNull();
    const a = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3);
    const b = db.createWatch(['LYS'], ['LIS'], '2026-10-01', 1);
    expect(db.getWatch(a.id)?.depart_date).toBe('2026-09-10');
    // Tri : plus récente d'abord.
    expect(db.listWatches().map(w => w.id)).toEqual([b.id, a.id]);
    expect(db.deleteWatch(a.id)).toBe(true);
    expect(db.deleteWatch(a.id)).toBe(false);
    expect(db.listWatches()).toHaveLength(1);
  });

  it('updateWatch met à jour route, dates et options', async () => {
    const db = await loadDb();
    const w = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3);
    const updated = db.updateWatch(w.id, ['ORY'], ['NCE'], '2026-11-05', 0, FULL_OPTIONS);
    expect(updated?.origins).toEqual(['ORY']);
    expect(updated?.destinations).toEqual(['NCE']);
    expect(updated?.depart_date).toBe('2026-11-05');
    expect(updated?.flex_days).toBe(0);
    expect(updated?.trip).toBe('round-trip');
    expect(updated?.seat).toBe('business');
    expect(db.getWatch(w.id)?.return_date).toBe('2026-09-24');
  });
});

describe('db — prix et planification', () => {
  it('addPrice / getPrices avec et sans checked_at explicite', async () => {
    const db = await loadDb();
    const w = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3);
    db.addPrice(w.id, 'CDG', 'JFK', '2026-09-10', 350.5, '2026-07-01 03:00:00');
    db.addPrice(w.id, 'CDG', 'JFK', '2026-09-10', 342.1);
    const prices = db.getPrices(w.id);
    expect(prices).toHaveLength(2);
    expect(prices[0].price).toBe(350.5);
    expect(prices[0].checked_at).toBe('2026-07-01 03:00:00');
    expect(prices[1].price).toBe(342.1);
    expect(prices[1].checked_at).toBeTruthy();
  });

  it('touchWatchCheck / setNextCheck mettent à jour les échéances', async () => {
    const db = await loadDb();
    const w = db.createWatch(['CDG'], ['JFK'], '2026-09-10', 3);
    expect(w.last_checked_at).toBeNull();
    db.touchWatchCheck(w.id, '2026-08-01T02:00:00.000Z');
    let after = db.getWatch(w.id)!;
    expect(after.last_checked_at).toBeTruthy();
    expect(after.next_check_at).toBe('2026-08-01T02:00:00.000Z');
    db.setNextCheck(w.id, '2026-08-02T05:00:00.000Z');
    after = db.getWatch(w.id)!;
    expect(after.next_check_at).toBe('2026-08-02T05:00:00.000Z');
  });
});

describe('db — migration du schéma', () => {
  it('ajoute les colonnes d\'options à une base à l\'ancien schéma', async () => {
    // Construit une base "ancienne version" sans les colonnes d'options.
    const dir = freshDir();
    fs.mkdirSync(dir, { recursive: true });
    const old = new Database(path.join(dir, 'flydeal.db'));
    old.exec(`
      CREATE TABLE watches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        origins TEXT NOT NULL,
        destinations TEXT NOT NULL,
        depart_date TEXT NOT NULL,
        flex_days INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        last_checked_at TEXT,
        next_check_at TEXT
      );
      INSERT INTO watches (origins, destinations, depart_date, flex_days)
        VALUES ('["CDG"]', '["JFK"]', '2026-09-10', 3);
    `);
    old.close();

    const db = await loadDb(dir);
    const cols = (db.db.prepare('PRAGMA table_info(watches)').all() as { name: string }[]).map(c => c.name);
    for (const col of ['trip', 'return_date', 'adults', 'children', 'infants', 'seat']) {
      expect(cols).toContain(col);
    }
    // La ligne existante conserve ses données et hérite des valeurs par défaut.
    const w = db.getWatch(1)!;
    expect(w.depart_date).toBe('2026-09-10');
    expect(w.trip).toBe('one-way');
    expect(w.adults).toBe(1);
    expect(w.seat).toBe('economy');
  });
});
