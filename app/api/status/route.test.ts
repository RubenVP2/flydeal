// ============================================================
// TESTS — route API /api/status
// Vérifie le contrat JSON exposé à la bannière globale :
// mode live/simulation et santé du scraper.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from '@/app/api/status/route';

afterEach(() => {
  delete process.env.FAST_FLIGHTS_URL;
  vi.resetModules();
  delete (globalThis as any).__flydealScraperState;
});

describe('GET /api/status', () => {
  it('mode simulation sans FAST_FLIGHTS_URL : scraper.ok = false', async () => {
    delete process.env.FAST_FLIGHTS_URL;
    vi.resetModules();
    delete (globalThis as any).__flydealScraperState;
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe('simulation');
    expect(data.scraper.ok).toBe(false);
    expect(data.scraper.consecutiveFailures).toBe(0);
    expect(data.scraper.lastSuccessAt).toBeNull();
    expect(data.updatedAt).toBeTruthy();
  });

  it('mode live avec FAST_FLIGHTS_URL : scraper.ok = true sans échec', async () => {
    process.env.FAST_FLIGHTS_URL = 'http://localhost:8000';
    vi.resetModules();
    delete (globalThis as any).__flydealScraperState;
    const res = await GET();
    const data = await res.json();
    expect(data.mode).toBe('live');
    expect(data.scraper.ok).toBe(true);
  });
});
