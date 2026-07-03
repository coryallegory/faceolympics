import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { EventResult } from '../core/types';
import { loadResults } from './scores';

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

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
      writable: true,
    });
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
