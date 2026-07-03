import { describe, expect, it } from 'vitest';
import { clampFrameDelta } from './play';

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
