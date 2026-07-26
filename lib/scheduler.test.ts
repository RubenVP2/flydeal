// ============================================================
// TESTS — planificateur (lib/scheduler.ts)
// Couvre :
//  1. daysToDeparture() : calcul des jours avant départ.
//  2. nextCheckTime() : fenêtres clés (J-60/J-21/J-14/J-7 → cadence
//     horaire), créneaux nocturnes, cadence de base 6 h, et jamais
//     de vérification après le départ.
//  3. checkWatch() : passage des options de recherche au provider,
//     décalage conjoint de l'aller ET du retour sur les dates flex,
//     résilience aux erreurs du provider.
//  4. runDueChecks() / startScheduler() avec db et cron mockés.
// Lancer : npm test
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Watch } from './db';

const getPrice = vi.fn();
const addPrice = vi.fn();
const touchWatchCheck = vi.fn();
const listWatches = vi.fn();
const cronSchedule = vi.fn();

vi.mock('node-cron', () => ({ default: { schedule: (...args: any[]) => cronSchedule(...args) } }));
vi.mock('./db', () => ({
  listWatches: (...args: any[]) => listWatches(...args),
  addPrice: (...args: any[]) => addPrice(...args),
  touchWatchCheck: (...args: any[]) => touchWatchCheck(...args),
  setNextCheck: vi.fn(),
  watchOptions: (w: Watch) => ({
    trip: w.trip, returnDate: w.return_date, adults: w.adults, children: w.children, infants: w.infants, seat: w.seat,
  }),
}));
vi.mock('./price-engine', () => ({
  getProvider: () => ({ name: 'test', getPrice }),
}));

import { daysToDeparture, nextCheckTime, checkWatch, runDueChecks, startScheduler } from './scheduler';

const ROUND_TRIP_WATCH: Watch = {
  id: 1,
  origins: ['CDG'],
  destinations: ['JFK'],
  depart_date: '2026-09-10',
  flex_days: 1,
  trip: 'round-trip',
  return_date: '2026-09-24',
  adults: 2,
  children: 1,
  infants: 0,
  seat: 'business',
  created_at: '2026-07-01 00:00:00',
  last_checked_at: null,
  next_check_at: null,
};

function watchFrom(from: Date, daysOut: number): Watch {
  const dep = new Date(from.getTime() + daysOut * 86400000).toISOString().slice(0, 10);
  return { ...ROUND_TRIP_WATCH, depart_date: dep, return_date: null, trip: 'one-way' };
}

beforeEach(() => {
  vi.useFakeTimers();
  getPrice.mockResolvedValue({ price: 100, currency: 'EUR', provider: 'test', options: {} });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('daysToDeparture', () => {
  it('calcule les jours entiers avant le départ', () => {
    const from = new Date('2026-07-26T10:00:00Z');
    expect(daysToDeparture({ ...ROUND_TRIP_WATCH, depart_date: '2026-07-26' }, from)).toBe(0);
    expect(daysToDeparture({ ...ROUND_TRIP_WATCH, depart_date: '2026-08-05' }, from)).toBe(10);
    expect(daysToDeparture({ ...ROUND_TRIP_WATCH, depart_date: '2026-07-20' }, from)).toBe(-6);
  });
});

describe('nextCheckTime', () => {
  it.each([60, 21, 14, 7])('cadence horaire dans la fenêtre clé J-%i', (days) => {
    const from = new Date('2026-03-01T12:00:00'); // dimanche, midi
    const w = watchFrom(from, days);
    expect(nextCheckTime(w, from).getTime()).toBe(from.getTime() + 3600000);
  });

  it('cadence de base : +6 h hors fenêtres et créneaux', () => {
    const from = new Date('2026-03-05T12:00:00'); // jeudi, midi — départ dans 45 j
    const w = watchFrom(from, 45);
    expect(nextCheckTime(w, from).getTime()).toBe(from.getTime() + 6 * 3600000);
  });

  it('créneau nocturne : à 1h du matin, prochain passage à 2h', () => {
    const from = new Date('2026-03-05T01:00:00');
    const w = watchFrom(from, 45);
    const next = nextCheckTime(w, from);
    expect(next.getHours()).toBe(2);
    expect(next.getMinutes()).toBe(0);
    expect(next.getTime()).toBeGreaterThan(from.getTime());
  });

  it('mardi : créneau 10h si l\'heure n\'est pas passée', () => {
    const from = new Date('2026-03-03T08:00:00'); // mardi 8h
    expect(from.getDay()).toBe(2);
    const w = watchFrom(from, 45);
    const next = nextCheckTime(w, from);
    expect(next.getHours()).toBe(10);
  });

  it('jamais après le départ : retourne le dernier créneau de la veille', () => {
    const from = new Date('2026-09-11T12:00:00'); // après le départ
    const w = { ...ROUND_TRIP_WATCH, depart_date: '2026-09-10' };
    expect(nextCheckTime(w, from)).toEqual(new Date('2026-09-10T03:00:00'));
  });
});

describe('checkWatch', () => {
  it('passe les options au provider et décale aller ET retour sur les dates flex', async () => {
    await checkWatch(ROUND_TRIP_WATCH);
    // flex_days = 1 → 3 dates : J-1, J, J+1.
    expect(getPrice).toHaveBeenCalledTimes(3);
    const calls = getPrice.mock.calls;
    expect(calls.map(c => c[2])).toEqual(['2026-09-09', '2026-09-10', '2026-09-11']);
    expect(calls.map(c => (c[3] as any).returnDate)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25']);
    // Options de la surveillance propagées.
    expect(calls[0][3]).toMatchObject({ trip: 'round-trip', adults: 2, children: 1, seat: 'business' });
    expect(calls[0][4]).toBeInstanceOf(Date);
    // Prix enregistrés pour chaque date.
    expect(addPrice).toHaveBeenCalledTimes(3);
    expect(addPrice).toHaveBeenCalledWith(1, 'CDG', 'JFK', '2026-09-10', 100);
    expect(touchWatchCheck).toHaveBeenCalledTimes(1);
  });

  it('aller simple : returnDate reste null quelles que soient les dates flex', async () => {
    const w = { ...ROUND_TRIP_WATCH, trip: 'one-way' as const, return_date: null, flex_days: 2 };
    await checkWatch(w);
    expect(getPrice).toHaveBeenCalledTimes(5);
    for (const c of getPrice.mock.calls) expect((c[3] as any).returnDate).toBeNull();
  });

  it('encaisse une erreur du provider sans interrompre les autres routes', async () => {
    getPrice.mockRejectedValue(new Error('aucune offre'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(checkWatch(ROUND_TRIP_WATCH)).resolves.toBeUndefined();
    expect(addPrice).not.toHaveBeenCalled();
    expect(touchWatchCheck).toHaveBeenCalledTimes(1);
    errorSpy.mockRestore();
  });
});

describe('runDueChecks / startScheduler', () => {
  it('vérifie uniquement les surveillances échues', async () => {
    listWatches.mockReturnValue([
      { ...ROUND_TRIP_WATCH, id: 1, next_check_at: '2000-01-01T00:00:00.000Z' }, // échue
      { ...ROUND_TRIP_WATCH, id: 2, next_check_at: '2999-01-01T00:00:00.000Z' }, // future
    ]);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runDueChecks();
    expect(getPrice).toHaveBeenCalled();
    expect(touchWatchCheck).toHaveBeenCalledTimes(1);
    expect(touchWatchCheck.mock.calls[0][0]).toBe(1);
    errorSpy.mockRestore();
  });

  it('une surveillance jamais vérifiée (next_check_at null) est due immédiatement', async () => {
    listWatches.mockReturnValue([{ ...ROUND_TRIP_WATCH, next_check_at: null }]);
    await runDueChecks();
    expect(touchWatchCheck).toHaveBeenCalledTimes(1);
  });

  it('startScheduler planifie le tick cron une seule fois', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    startScheduler();
    expect(cronSchedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function));
  });
});
