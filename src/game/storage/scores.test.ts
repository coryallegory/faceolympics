import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { EventResult } from '../core/types';
import { loadResults, saveResult } from './scores';

const STORAGE_KEY = 'face-olympics-results-v1';

function createStorage() {
  const values = new Map<string, string>();

  return {
    clear(): void {
      values.clear();
    },
    getItem(key: string): string | null {
      return values.has(key) ? values.get(key) ?? null : null;
    },
    key(index: number): string | null {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
    get length(): number {
      return values.size;
    },
  };
}

const originalLocalStorage = globalThis.localStorage;
const localStorageStub = createStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageStub,
  configurable: true,
  writable: true,
});

const validResult: EventResult = {
  eventId: 'blink-off',
  title: 'Blink-Off',
  score: 1234,
  medal: 'silver',
  summary: 'Held steady.',
};

describe('loadResults', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty array when the results key is missing', () => {
    expect(loadResults()).toEqual([]);
  });

  it('returns an empty array when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    expect(() => loadResults()).not.toThrow();
    expect(loadResults()).toEqual([]);
  });

  it('filters out malformed stored entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      `[${
        [
          JSON.stringify(validResult),
          'null',
          JSON.stringify({ score: 10 }),
          JSON.stringify({ eventId: 'dragon-blast', score: '1000' }),
          JSON.stringify({ eventId: 42, score: 500 }),
          JSON.stringify({ eventId: 'face-weightlifting', score: 800 }),
          '{"eventId":"too-big","score":1e309}',
        ].join(',')
      }]`,
    );

    expect(loadResults()).toEqual([
      validResult,
      { eventId: 'face-weightlifting', score: 800 },
    ]);
  });

  it('preserves valid stored entries', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([validResult]));

    expect(loadResults()).toEqual([validResult]);
  });
});

describe('saveResult', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
  });

  it('stores a first-ever result for an event', () => {
    const first: EventResult = { ...validResult, score: 100 };

    saveResult(first);

    expect(loadResults()).toEqual([first]);
  });

  it('keeps the existing higher score when a later save scores lower (100 then 50 -> 100)', () => {
    const gold: EventResult = { ...validResult, score: 100 };
    const retry: EventResult = { ...validResult, score: 50, medal: 'bronze', summary: 'Slipped.' };

    saveResult(gold);
    saveResult(retry);

    const stored = loadResults();

    expect(stored).toHaveLength(1);
    expect(stored[0].score).toBe(100);
    expect(stored[0]).toEqual(gold);
  });

  it('replaces the stored score when a later save scores higher (100 then 150 -> 150)', () => {
    const first: EventResult = { ...validResult, score: 100 };
    const better: EventResult = { ...validResult, score: 150, medal: 'gold', summary: 'New best!' };

    saveResult(first);
    saveResult(better);

    const stored = loadResults();

    expect(stored).toHaveLength(1);
    expect(stored[0].score).toBe(150);
    expect(stored[0]).toEqual(better);
  });

  it('keeps personal bests independently per event', () => {
    const blinkOff: EventResult = { ...validResult, eventId: 'blink-off', score: 100 };
    const dragonBlast: EventResult = { ...validResult, eventId: 'dragon-blast', score: 200 };

    saveResult(blinkOff);
    saveResult(dragonBlast);
    saveResult({ ...validResult, eventId: 'blink-off', score: 50 });

    const stored = loadResults();

    expect(stored).toHaveLength(2);
    expect(stored.find((item) => item.eventId === 'blink-off')?.score).toBe(100);
    expect(stored.find((item) => item.eventId === 'dragon-blast')?.score).toBe(200);
  });
});
