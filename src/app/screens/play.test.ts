import { describe, expect, it } from 'vitest';
import {
  clampFrameDelta,
  COUNTDOWN_LABELS,
  countdownLabelForStep,
  isCountdownComplete,
  resolveFaceWaitOutcome,
} from './play';

describe('clampFrameDelta', () => {
  it('passes through a normal 60fps-ish frame delta unchanged', () => {
    expect(clampFrameDelta(16)).toBe(16);
  });

  it('clamps a huge delta from a backgrounded tab down to the cap', () => {
    // A tab hidden for 10s and then refocused delivers one rawDelta of ~10000ms.
    expect(clampFrameDelta(10_000)).toBe(100);
  });

  it('passes a delta exactly at the cap through unchanged', () => {
    expect(clampFrameDelta(100)).toBe(100);
  });

  it('clamps a delta just above the cap', () => {
    expect(clampFrameDelta(101)).toBe(100);
  });
});

// resolveFaceWaitOutcome drives the Get Ready gate's "Looking for your face..." step: it's the
// pure decision of whether to keep polling, declare the gate passed, or offer "play anyway"
// after ~10s. Kept dependency-free (no requestAnimationFrame/Date.now inside) specifically so
// it's unit-testable without a live camera or a DOM environment (this project runs vitest
// without jsdom -- see FaceInputService.test.ts).
describe('resolveFaceWaitOutcome', () => {
  it('is "waiting" while status is not tracking and the timeout has not elapsed', () => {
    expect(resolveFaceWaitOutcome('loading', false, 0, 10_000)).toBe('waiting');
    expect(resolveFaceWaitOutcome('no-face', false, 5_000, 10_000)).toBe('waiting');
  });

  it('is "waiting" when tracking but no face is present yet', () => {
    expect(resolveFaceWaitOutcome('tracking', false, 500, 10_000)).toBe('waiting');
  });

  it('is "ready" once status is tracking and a face is present', () => {
    expect(resolveFaceWaitOutcome('tracking', true, 200, 10_000)).toBe('ready');
  });

  it('is "timed-out" once elapsed time reaches the timeout without a tracked face', () => {
    expect(resolveFaceWaitOutcome('no-face', false, 10_000, 10_000)).toBe('timed-out');
    expect(resolveFaceWaitOutcome('loading', false, 15_000, 10_000)).toBe('timed-out');
  });

  it('prefers "ready" over "timed-out" when both conditions are met on the same frame', () => {
    // A face landing on the exact frame the budget expires should still count as ready rather
    // than bouncing the player to the "play anyway" offer.
    expect(resolveFaceWaitOutcome('tracking', true, 10_000, 10_000)).toBe('ready');
  });

  it('defaults the timeout to 10s when not provided', () => {
    expect(resolveFaceWaitOutcome('no-face', false, 9_999)).toBe('waiting');
    expect(resolveFaceWaitOutcome('no-face', false, 10_000)).toBe('timed-out');
  });
});

describe('countdownLabelForStep', () => {
  it('returns the 3-2-1 labels in order', () => {
    expect(countdownLabelForStep(0)).toBe('3');
    expect(countdownLabelForStep(1)).toBe('2');
    expect(countdownLabelForStep(2)).toBe('1');
  });

  it('returns undefined once the countdown has stepped past the last label', () => {
    expect(countdownLabelForStep(COUNTDOWN_LABELS.length)).toBeUndefined();
  });
});

describe('isCountdownComplete', () => {
  it('is false for every valid step index', () => {
    for (let i = 0; i < COUNTDOWN_LABELS.length; i += 1) {
      expect(isCountdownComplete(i)).toBe(false);
    }
  });

  it('is true once the step index reaches the number of labels', () => {
    expect(isCountdownComplete(COUNTDOWN_LABELS.length)).toBe(true);
  });
});
