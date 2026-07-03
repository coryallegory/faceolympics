import { describe, expect, it } from 'vitest';
import {
  AdaptiveRange,
  DEFAULT_MIN_SPAN,
} from './adaptive-range';

describe('AdaptiveRange', () => {
  it('returns raw values while the observed span stays below the minimum guardrail', () => {
    const range = new AdaptiveRange();
    const outputs = Array.from({ length: 6 }, () => range.normalize(0.72, 1_000));

    expect(outputs).toEqual([0.72, 0.72, 0.72, 0.72, 0.72, 0.72]);
    expect(range.snapshot()).toEqual({ low: 0.72, high: 0.72 });
  });

  it('normalizes around a learned span once the stream establishes enough range', () => {
    const range = new AdaptiveRange();

    range.normalize(0.2, 1_000);
    range.normalize(0.8, 1_000);

    const midpoint = range.normalize(0.5, 0);
    const { low, high } = range.snapshot();

    expect(high - low).toBeGreaterThanOrEqual(DEFAULT_MIN_SPAN);
    expect(range.normalize(0.2, 0)).toBe(0);
    expect(midpoint).toBeCloseTo(0.5, 3);
    expect(range.normalize(0.8, 0)).toBe(1);
  });

  it('re-converges after the underlying range shifts when time advances', () => {
    const frozen = new AdaptiveRange({ retuneTimeMs: 5_000 });
    const retuning = new AdaptiveRange({ retuneTimeMs: 5_000 });

    frozen.seed(0.2, 0.8);
    retuning.seed(0.2, 0.8);

    for (let index = 0; index < 12; index += 1) {
      const nextValue = index % 2 === 0 ? 0.55 : 0.95;
      frozen.normalize(nextValue, 0);
      retuning.normalize(nextValue, 1_000);
    }

    expect(frozen.snapshot().low).toBeCloseTo(0.2, 5);
    expect(retuning.snapshot().low).toBeGreaterThan(0.45);
    expect(retuning.snapshot().high).toBeGreaterThanOrEqual(0.95);
    expect(retuning.normalize(0.55, 0)).toBeLessThan(0.2);
    expect(retuning.normalize(0.95, 0)).toBe(1);
  });

  it('respects seeded bounds before live samples arrive', () => {
    const range = new AdaptiveRange();

    range.seed(0.3, 0.7);

    expect(range.snapshot()).toEqual({ low: 0.3, high: 0.7 });
    expect(range.normalize(0.3, 0)).toBe(0);
    expect(range.normalize(0.5, 0)).toBeCloseTo(0.5, 5);
    expect(range.normalize(0.7, 0)).toBe(1);
  });
});
