// Couche de persistance SQLite (better-sqlite3), fichier dans /app/data (volume Docker).
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = process.env.DATA_DIR || '/app/data';
// En dev local hors Docker, fallback sur ./data du projet.
const dir = fs.existsSync(DATA_DIR) || process.env.NODE_ENV === 'production'
  ? (fs.mkdirSync(DATA_DIR, { recursive: true }), DATA_DIR)
  : path.join(process.cwd(), 'data');
fs.mkdirSync(dir, { recursive: true });

const dbPath = path.join(dir, 'flydeal.db');

// Singleton global pour éviter les réouvertures en hot-reload Next.js.
const g = globalThis as unknown as { __flydealDb?: Database.Database };
export const db: Database.Database = g.__flydealDb ?? (g.__flydealDb = new Database(dbPath));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  origins TEXT NOT NULL,        -- JSON array de codes IATA
  destinations TEXT NOT NULL,   -- JSON array de codes IATA
  depart_date TEXT NOT NULL,    -- YYYY-MM-DD (date cible)
  flex_days INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_checked_at TEXT,
  next_check_at TEXT
);
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watch_id INTEGER NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  depart_date TEXT NOT NULL,
  price REAL NOT NULL,
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prices_watch ON prices(watch_id, checked_at);
`);

export interface Watch {
  id: number;
  origins: string[];
  destinations: string[];
  depart_date: string;
  flex_days: number;
  created_at: string;
  last_checked_at: string | null;
  next_check_at: string | null;
}
export interface PricePoint {
  id: number;
  watch_id: number;
  origin: string;
  destination: string;
  depart_date: string;
  price: number;
  checked_at: string;
}

interface WatchRow extends Omit<Watch, 'origins' | 'destinations'> { origins: string; destinations: string; }

function mapWatch(r: WatchRow): Watch {
  return { ...r, origins: JSON.parse(r.origins), destinations: JSON.parse(r.destinations) };
}

export function listWatches(): Watch[] {
  const rows = db.prepare('SELECT * FROM watches ORDER BY id DESC').all() as WatchRow[];
  return rows.map(mapWatch);
}
export function getWatch(id: number): Watch | null {
  const r = db.prepare('SELECT * FROM watches WHERE id = ?').get(id) as WatchRow | undefined;
  return r ? mapWatch(r) : null;
}
export function createWatch(origins: string[], destinations: string[], depart_date: string, flex_days: number): Watch {
  const info = db.prepare(
    'INSERT INTO watches (origins, destinations, depart_date, flex_days) VALUES (?, ?, ?, ?)'
  ).run(JSON.stringify(origins), JSON.stringify(destinations), depart_date, flex_days);
  return getWatch(info.lastInsertRowid as number)!;
}
export function updateWatch(id: number, origins: string[], destinations: string[], depart_date: string, flex_days: number): Watch | null {
  db.prepare('UPDATE watches SET origins=?, destinations=?, depart_date=?, flex_days=? WHERE id=?')
    .run(JSON.stringify(origins), JSON.stringify(destinations), depart_date, flex_days, id);
  return getWatch(id);
}
export function deleteWatch(id: number): boolean {
  return db.prepare('DELETE FROM watches WHERE id = ?').run(id).changes > 0;
}
export function addPrice(watch_id: number, origin: string, destination: string, depart_date: string, price: number, checked_at?: string): void {
  if (checked_at) {
    db.prepare('INSERT INTO prices (watch_id, origin, destination, depart_date, price, checked_at) VALUES (?,?,?,?,?,?)')
      .run(watch_id, origin, destination, depart_date, price, checked_at);
  } else {
    db.prepare('INSERT INTO prices (watch_id, origin, destination, depart_date, price) VALUES (?,?,?,?,?)')
      .run(watch_id, origin, destination, depart_date, price);
  }
}
export function getPrices(watchId: number): PricePoint[] {
  return db.prepare('SELECT * FROM prices WHERE watch_id = ? ORDER BY checked_at ASC').all(watchId) as PricePoint[];
}
export function touchWatchCheck(id: number, nextCheckAt: string): void {
  db.prepare("UPDATE watches SET last_checked_at = datetime('now'), next_check_at = ? WHERE id = ?").run(nextCheckAt, id);
}
export function setNextCheck(id: number, nextCheckAt: string): void {
  db.prepare('UPDATE watches SET next_check_at = ? WHERE id = ?').run(nextCheckAt, id);
}
