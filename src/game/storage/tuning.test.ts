import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../core/types';
import { loadTuning, saveTuning, type TuningState } from './tuning';

const STORAGE_KEY = 'face-olympics-tuning-v1';

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

const validState: TuningState = {
  thresholds: DEFAULT_THRESHOLDS,
  adaptive: {
    browRaiseLeft: { low: 0.1, high: 0.9 },
    browRaiseRight: { low: 0.12, high: 0.88 },
    gazeX: { low: -0.6, high: 0.6 },
    gazeY: { low: -0.5, high: 0.5 },
  },
};

describe('tuning storage', () => {
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

  it('returns null when the tuning key is missing', () => {
    expect(loadTuning()).toBeNull();
  });

  it('round-trips a saved tuning state', () => {
    saveTuning(validState);

    expect(loadTuning()).toEqual(validState);
  });

  it('returns null when the stored JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    expect(() => loadTuning()).not.toThrow();
    expect(loadTuning()).toBeNull();
  });

  it('returns null when the stored shape is missing required fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ thresholds: DEFAULT_THRESHOLDS }));

    expect(loadTuning()).toBeNull();
  });

  it('returns null when a threshold field is the wrong type', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...validState,
        thresholds: { ...validState.thresholds, mouthOpen: '0.45' },
      }),
    );

    expect(loadTuning()).toBeNull();
  });

  it('returns null when an adaptive channel is missing', () => {
    const partialAdaptive: Record<string, { low: number; high: number }> = { ...validState.adaptive };
    delete partialAdaptive.gazeY;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ thresholds: validState.thresholds, adaptive: partialAdaptive }),
    );

    expect(loadTuning()).toBeNull();
  });

  it('returns null when an adaptive channel has a malformed low/high pair', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...validState,
        adaptive: { ...validState.adaptive, gazeX: { low: 'left', high: 0.6 } },
      }),
    );

    expect(loadTuning()).toBeNull();
  });

  it('returns null when the stored value is not an object', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify('not-an-object'));

    expect(loadTuning()).toBeNull();
  });

  it('stores tuning under the versioned key without disturbing other keys', () => {
    localStorage.setItem('unrelated-key', 'untouched');

    saveTuning(validState);

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem('unrelated-key')).toBe('untouched');
  });

  it('ignores data stored under a different version of the tuning key', () => {
    localStorage.setItem('face-olympics-tuning-v2', JSON.stringify(validState));

    expect(loadTuning()).toBeNull();
  });
});
