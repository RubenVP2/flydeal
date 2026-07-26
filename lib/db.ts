// Couche de persistance SQLite (better-sqlite3), fichier dans /app/data (volume Docker).
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SearchOptions, DEFAULT_SEARCH_OPTIONS } from './price-engine';

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

// Migration idempotente : ajoute les colonnes d'options de recherche
// (aller-retour, passagers, cabine) aux bases existantes.
const WATCH_OPTION_COLUMNS: [string, string][] = [
  ['trip', "TEXT NOT NULL DEFAULT 'one-way'"],
  ['return_date', 'TEXT'],
  ['adults', 'INTEGER NOT NULL DEFAULT 1'],
  ['children', 'INTEGER NOT NULL DEFAULT 0'],
  ['infants', 'INTEGER NOT NULL DEFAULT 0'],
  ['seat', "TEXT NOT NULL DEFAULT 'economy'"],
];
const existing = new Set(
  (db.prepare('PRAGMA table_info(watches)').all() as { name: string }[]).map(c => c.name)
);
for (const [col, def] of WATCH_OPTION_COLUMNS) {
  if (!existing.has(col)) db.exec(`ALTER TABLE watches ADD COLUMN ${col} ${def}`);
}

// Migration idempotente : purge les relevés de prix datés AVANT la création
// de leur surveillance. Ces lignes sont nécessairement fabriquées (ancien
// seed qui simulait 30 jours d'historique) : un relevé réel est toujours
// postérieur à la création de la surveillance. L'historique démarre au
// jour J, le backend ne fournissant pas de données passées.
db.exec(`
DELETE FROM prices WHERE checked_at < (
  SELECT created_at FROM watches WHERE watches.id = prices.watch_id
);
`);

export interface Watch {
  id: number;
  origins: string[];
  destinations: string[];
  depart_date: string;
  flex_days: number;
  trip: 'one-way' | 'round-trip';
  return_date: string | null;
  adults: number;
  children: number;
  infants: number;
  seat: 'economy' | 'premium-economy' | 'business' | 'first';
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
export function createWatch(
  origins: string[],
  destinations: string[],
  depart_date: string,
  flex_days: number,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): Watch {
  const info = db.prepare(
    'INSERT INTO watches (origins, destinations, depart_date, flex_days, trip, return_date, adults, children, infants, seat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    JSON.stringify(origins), JSON.stringify(destinations), depart_date, flex_days,
    options.trip, options.returnDate, options.adults, options.children, options.infants, options.seat,
  );
  return getWatch(info.lastInsertRowid as number)!;
}
export function updateWatch(
  id: number,
  origins: string[],
  destinations: string[],
  depart_date: string,
  flex_days: number,
  options: SearchOptions = DEFAULT_SEARCH_OPTIONS,
): Watch | null {
  db.prepare('UPDATE watches SET origins=?, destinations=?, depart_date=?, flex_days=?, trip=?, return_date=?, adults=?, children=?, infants=?, seat=? WHERE id=?')
    .run(
      JSON.stringify(origins), JSON.stringify(destinations), depart_date, flex_days,
      options.trip, options.returnDate, options.adults, options.children, options.infants, options.seat, id,
    );
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

/** Reconstruit les options de recherche d'une surveillance. */
export function watchOptions(w: Watch): SearchOptions {
  return {
    trip: w.trip,
    returnDate: w.return_date,
    adults: w.adults,
    children: w.children,
    infants: w.infants,
    seat: w.seat,
  };
}
