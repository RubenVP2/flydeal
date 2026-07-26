#!/usr/bin/env node
// ============================================================
// TESTS E2E — FlyDeal ↔ flights-service (stub HTTP)
// Scénario :
//  1. Démarre un stub flights-service (node:http) qui enregistre
//     les paramètres de la dernière requête et répond un prix fixe.
//  2. Démarre `next dev` avec DATA_DIR temporaire et
//     FAST_FLIGHTS_URL pointant sur le stub.
//  3. Enchaîne les assertions sur l'API (POST/GET/PUT/DELETE,
//     check-now, propagation des options de recherche au stub).
//  4. Nettoie tout (processus next, stub, répertoire temporaire).
// Lancer : npm run test:e2e
// ============================================================
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const NEXT_PORT = 3400 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${NEXT_PORT}`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function api(pathname, options = {}) {
  const res = await fetch(BASE + pathname, {
    ...options,
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  return res;
}

// ---------- 1. Stub flights-service ----------
let lastQuery = null;
const stub = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://stub');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (url.pathname === '/api/v1/search') {
    lastQuery = Object.fromEntries(url.searchParams.entries());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      price: 123.45, currency: 'EUR', provider: 'fast-flights',
      trip: url.searchParams.get('trip'), flights_count: 3,
    }));
    return;
  }
  res.writeHead(404); res.end();
});

let nextChild = null;
let tmpDir = null;

async function cleanup() {
  if (nextChild && nextChild.pid) {
    try { process.kill(-nextChild.pid, 'SIGTERM'); } catch {}
    await sleep(1500);
    try { process.kill(-nextChild.pid, 'SIGKILL'); } catch {}
  }
  await new Promise(r => stub.close(r));
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function main() {
  // Stub sur port éphémère.
  await new Promise(r => stub.listen(0, '127.0.0.1', r));
  const stubPort = stub.address().port;
  console.log(`[e2e] stub flights-service sur http://127.0.0.1:${stubPort}`);

  // ---------- 2. next dev avec DATA_DIR temporaire ----------
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flydeal-e2e-'));
  console.log(`[e2e] DATA_DIR=${tmpDir} — démarrage de next dev sur le port ${NEXT_PORT}…`);
  nextChild = spawn(process.execPath, [NEXT_BIN, 'dev', '-p', String(NEXT_PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATA_DIR: tmpDir,
      FAST_FLIGHTS_URL: `http://127.0.0.1:${stubPort}`,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  nextChild.stdout.on('data', () => {});
  nextChild.stderr.on('data', d => process.stderr.write(`[next] ${d}`));

  // Attente de disponibilité (première compilation potentiellement longue).
  const deadline = Date.now() + 120000;
  let up = false;
  while (Date.now() < deadline) {
    try {
      const res = await api('/api/watches');
      if (res.status === 200) { up = true; break; }
    } catch {}
    if (nextChild.exitCode !== null) throw new Error(`next dev s'est arrêté (code ${nextChild.exitCode})`);
    await sleep(2000);
  }
  if (!up) throw new Error('next dev indisponible après 120 s');
  console.log('[e2e] next dev prêt.\n[e2e] scénario :');

  // ---------- 3. Assertions ----------
  // POST aller simple minimal → défauts appliqués.
  let res = await api('/api/watches', {
    method: 'POST',
    body: JSON.stringify({ origins: ['CDG'], destinations: ['JFK'], depart_date: inDays(45), flex_days: 0 }),
  });
  check('POST one-way minimal → 201', res.status === 201, `statut ${res.status}`);
  const oneWay = await res.json();
  check('one-way : défauts trip/adults/seat', oneWay.trip === 'one-way' && oneWay.adults === 1 && oneWay.seat === 'economy',
    JSON.stringify(oneWay));

  // POST aller-retour avec passagers → champs renvoyés.
  res = await api('/api/watches', {
    method: 'POST',
    body: JSON.stringify({
      origins: ['CDG'], destinations: ['JFK'], depart_date: inDays(45), flex_days: 0,
      trip: 'round-trip', return_date: inDays(52), adults: 2, children: 1, infants: 0, seat: 'business',
    }),
  });
  check('POST round-trip + passagers → 201', res.status === 201, `statut ${res.status}`);
  const rt = await res.json();
  check('round-trip : champs renvoyés',
    rt.trip === 'round-trip' && rt.return_date === inDays(52) && rt.adults === 2 && rt.children === 1 && rt.seat === 'business',
    JSON.stringify(rt));

  // POST aller-retour sans return_date → 400.
  res = await api('/api/watches', {
    method: 'POST',
    body: JSON.stringify({ origins: ['CDG'], destinations: ['JFK'], depart_date: inDays(45), flex_days: 0, trip: 'round-trip' }),
  });
  check('POST round-trip sans return_date → 400', res.status === 400, `statut ${res.status}`);

  // GET liste → les deux surveillances créées sont présentes (le seed en ajoute 3 autres).
  res = await api('/api/watches');
  const list = await res.json();
  check('GET /api/watches contient les deux surveillances créées',
    Array.isArray(list) && list.some(w => w.id === oneWay.id) && list.some(w => w.id === rt.id),
    `ids=${Array.isArray(list) ? list.map(w => w.id).join(',') : 'n/a'}`);

  // check-now sur la surveillance aller-retour → prix 123.45 enregistré.
  lastQuery = null;
  res = await api(`/api/check-now?id=${rt.id}`, { method: 'POST' });
  check('POST /api/check-now → 200', res.status === 200, `statut ${res.status}`);
  res = await api(`/api/watches/${rt.id}`);
  const detail = await res.json();
  const lastPrice = detail.prices.length ? detail.prices[detail.prices.length - 1].price : null;
  check('historique non vide, dernier prix = 123.45', detail.prices.length > 0 && lastPrice === 123.45,
    `prices=${detail.prices.length} last=${lastPrice}`);
  check('stub a reçu les options round-trip (trip, return_date, adults=2, children=1, seat=business, currency=EUR)',
    !!lastQuery && lastQuery.trip === 'round-trip' && !!lastQuery.return_date &&
    lastQuery.adults === '2' && lastQuery.children === '1' && lastQuery.seat === 'business' && lastQuery.currency === 'EUR',
    JSON.stringify(lastQuery));

  // PUT → passage en aller simple, return_date null.
  res = await api('/api/watches', {
    method: 'PUT',
    body: JSON.stringify({
      id: rt.id, origins: ['CDG'], destinations: ['JFK'], depart_date: inDays(45), flex_days: 0, trip: 'one-way',
    }),
  });
  check('PUT passage en one-way → 200', res.status === 200, `statut ${res.status}`);
  const updated = await res.json();
  check('PUT : return_date null', updated.trip === 'one-way' && updated.return_date === null, JSON.stringify(updated));

  // DELETE → { ok: true }.
  res = await api(`/api/watches?id=${rt.id}`, { method: 'DELETE' });
  check('DELETE → {ok:true}', res.status === 200 && (await res.json()).ok === true, `statut ${res.status}`);

  // Page d'accueil.
  res = await api('/');
  const html = await res.text();
  check('GET / → 200 HTML FlyDeal', res.status === 200 && /FlyDeal/.test(html), `statut ${res.status}`);
}

let exitCode = 0;
try {
  await main();
} catch (e) {
  check('exécution du scénario', false, e.message);
} finally {
  await cleanup();
}
const failed = results.filter(r => !r.ok);
console.log(`\n[e2e] ${results.length - failed.length}/${results.length} assertions réussies`);
if (failed.length) { exitCode = 1; console.log('[e2e] ÉCHEC'); } else { console.log('[e2e] PASS'); }
process.exit(exitCode);
