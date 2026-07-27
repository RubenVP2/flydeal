// ============================================================
// TESTS — statut du scraper (lib/scraper-status.ts)
// Chaque test recharge le module à neuf (singleton globalThis
// réinitialisé) pour partir d'un compteur vierge. Couvre :
//  1. Compteur d'échecs consécutifs : incrément, remise à zéro
//     au succès, dernier message d'erreur.
//  2. Mode : 'simulation' sans FAST_FLIGHTS_URL (scraper.ok false),
//     'live' avec (ok tant qu'aucun échec).
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadStatus() {
  vi.resetModules();
  delete (globalThis as any).__flydealScraperState;
  return await import('./scraper-status');
}

afterEach(() => {
  delete process.env.FAST_FLIGHTS_URL;
  delete (globalThis as any).__flydealScraperState;
});

describe('scraper-status — compteur d\'échecs', () => {
  it('démarre à zéro échec, sans succès ni erreur', async () => {
    const m = await loadStatus();
    const s = m.getStatus().scraper;
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastSuccessAt).toBeNull();
    expect(s.lastError).toBeNull();
  });

  it('les échecs s\'accumulent, le succès remet à zéro', async () => {
    process.env.FAST_FLIGHTS_URL = 'http://localhost:8000';
    const m = await loadStatus();
    m.recordScraperFailure('timeout');
    m.recordScraperFailure('HTTP 502');
    let s = m.getStatus().scraper;
    expect(s.consecutiveFailures).toBe(2);
    expect(s.lastError).toBe('HTTP 502');
    expect(s.ok).toBe(false);

    m.recordScraperSuccess(new Date('2026-07-01T03:00:00Z'));
    s = m.getStatus().scraper;
    expect(s.consecutiveFailures).toBe(0);
    expect(s.lastSuccessAt).toBe('2026-07-01T03:00:00.000Z');
    expect(s.lastError).toBeNull();
    expect(s.ok).toBe(true);
  });
});

describe('scraper-status — mode', () => {
  it('sans FAST_FLIGHTS_URL : mode simulation, scraper.ok = false', async () => {
    const m = await loadStatus();
    const st = m.getStatus();
    expect(st.mode).toBe('simulation');
    expect(st.scraper.ok).toBe(false);
    expect(st.updatedAt).toBeTruthy();
  });

  it('avec FAST_FLIGHTS_URL : mode live, scraper.ok = true tant qu\'aucun échec', async () => {
    process.env.FAST_FLIGHTS_URL = 'http://localhost:8000';
    const m = await loadStatus();
    const st = m.getStatus();
    expect(st.mode).toBe('live');
    expect(st.scraper.ok).toBe(true);
  });
});
