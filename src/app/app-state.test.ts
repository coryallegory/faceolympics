import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CALIBRATION,
  type CalibrationProfile,
  type EventResult,
  type FaceOlympicsEvent,
} from '../game/core/types';

// app-state.ts constructs a module-level FaceInputService, which touches
// `document` at import time. These tests only exercise the DOM-free
// current-event/calibration bookkeeping, so stub the class out rather than
// pull jsdom into the project for it.
vi.mock('../game/input/face/FaceInputService', () => ({
  FaceInputService: vi.fn(),
}));

const {
  clearCurrentEvent,
  getCalibration,
  getCurrentEvent,
  resetCalibration,
  setCalibration,
  setCurrentEvent,
} = await import('./app-state');

function createMockEvent(id: string): FaceOlympicsEvent {
  return {
    id,
    title: id,
    description: '',
    requiredInputs: [],
    init: vi.fn(),
    start: vi.fn(),
    update: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn<() => EventResult>(),
    dispose: vi.fn(),
  };
}

afterEach(() => {
  clearCurrentEvent();
  resetCalibration();
});

describe('app-state current event', () => {
  it('disposes the outgoing event when replaced with a different one', () => {
    const first = createMockEvent('first');
    const second = createMockEvent('second');

    setCurrentEvent(first);
    setCurrentEvent(second);

    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(second.dispose).not.toHaveBeenCalled();
    expect(getCurrentEvent()).toBe(second);
  });

  it('does not dispose when set to the same instance again', () => {
    const event = createMockEvent('same');

    setCurrentEvent(event);
    setCurrentEvent(event);

    expect(event.dispose).not.toHaveBeenCalled();
  });

  it('clearCurrentEvent disposes the current event and clears it', () => {
    const event = createMockEvent('cleared');

    setCurrentEvent(event);
    clearCurrentEvent();

    expect(event.dispose).toHaveBeenCalledTimes(1);
    expect(getCurrentEvent()).toBeUndefined();
  });

  it('clearCurrentEvent is a no-op when nothing is current', () => {
    expect(() => clearCurrentEvent()).not.toThrow();
    expect(getCurrentEvent()).toBeUndefined();
  });
});

describe('app-state calibration', () => {
  it('round-trips a saved calibration profile', () => {
    const profile: CalibrationProfile = {
      ...DEFAULT_CALIBRATION,
      confidence: 0.42,
    };

    setCalibration(profile);

    expect(getCalibration()).toBe(profile);
  });

  it('resetCalibration restores the default profile', () => {
    setCalibration({ ...DEFAULT_CALIBRATION, confidence: 0.1 });
    resetCalibration();

    expect(getCalibration()).toBe(DEFAULT_CALIBRATION);
  });
});
