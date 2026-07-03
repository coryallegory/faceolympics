import { describe, expect, it } from 'vitest';
import { medalForScore, type MedalThresholds } from './medals';

const thresholds: MedalThresholds = {
  bronze: 10,
  silver: 20,
  gold: 30,
};

describe('medalForScore', () => {
  it('returns none for a score below bronze', () => {
    expect(medalForScore(0, thresholds)).toBe('none');
    expect(medalForScore(thresholds.bronze - 1, thresholds)).toBe('none');
  });

  it('returns bronze at the bronze threshold', () => {
    expect(medalForScore(thresholds.bronze, thresholds)).toBe('bronze');
  });

  it('returns bronze just below the silver threshold', () => {
    expect(medalForScore(thresholds.silver - 1, thresholds)).toBe('bronze');
  });

  it('returns silver at the silver threshold', () => {
    expect(medalForScore(thresholds.silver, thresholds)).toBe('silver');
  });

  it('returns silver just below the gold threshold', () => {
    expect(medalForScore(thresholds.gold - 1, thresholds)).toBe('silver');
  });

  it('returns gold at the gold threshold', () => {
    expect(medalForScore(thresholds.gold, thresholds)).toBe('gold');
  });

  it('returns gold for a score above the gold threshold', () => {
    expect(medalForScore(thresholds.gold + 100, thresholds)).toBe('gold');
  });
});
