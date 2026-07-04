import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventResult, FaceOlympicsEvent } from '../game/core/types';
import type { TuningState } from '../game/storage/tuning';

const faceServiceSpies = vi.hoisted(() => ({
  getTuningSnapshot: vi.fn<() => TuningState>(),
  seedTuning: vi.fn<(state: TuningState) => void>(),
}));

const tuningStorageSpies = vi.hoisted(() => ({
  loadTuning: vi.fn<() => TuningState | null>(),
  saveTuning: vi.fn<(state: TuningState) => void>(),
}));

// app-state.ts constructs a module-level FaceInputService, which touches `document` at import
// time. Stub the class and storage helpers so the tests can stay dependency-free while still
// covering the deterministic event and tuning wiring in this module.
vi.mock('../game/input/face/FaceInputService', () => ({
  FaceInputService: vi.fn(() => faceServiceSpies),
}));
vi.mock('../game/storage/tuning', () => tuningStorageSpies);

const {
  clearCurrentEvent,
  getCurrentEvent,
  persistTuning,
  restorePersistedTuning,
  setCurrentEvent,
} = await import('./app-state');

function createTuningState(): TuningState {
  return {
    thresholds: {
      eyeClosed: 0.4,
      mouthOpen: 0.5,
      lipPucker: 0.6,
      browRaised: 0.7,
      gaze: 0.3,
      hysteresisGap: 0.1,
    },
    adaptive: {
      browRaiseLeft: { low: 0.2, high: 0.8 },
      browRaiseRight: { low: 0.25, high: 0.75 },
      gazeX: { low: 0.15, high: 0.65 },
      gazeY: { low: 0.1, high: 0.6 },
    },
  };
}

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

beforeEach(() => {
  vi.clearAllMocks();
  tuningStorageSpies.loadTuning.mockReturnValue(null);
  faceServiceSpies.getTuningSnapshot.mockReturnValue(createTuningState());
});

afterEach(() => {
  clearCurrentEvent();
});

describe('app-state tuning persistence', () => {
  it('only seeds persisted tuning when storage returns data', () => {
    restorePersistedTuning();

    expect(tuningStorageSpies.loadTuning).toHaveBeenCalledTimes(1);
    expect(faceServiceSpies.seedTuning).not.toHaveBeenCalled();

    const persisted = createTuningState();
    tuningStorageSpies.loadTuning.mockReturnValue(persisted);

    restorePersistedTuning();

    expect(faceServiceSpies.seedTuning).toHaveBeenCalledTimes(1);
    expect(faceServiceSpies.seedTuning).toHaveBeenCalledWith(persisted);
  });

  it('forwards the current tuning snapshot into saveTuning', () => {
    const snapshot = createTuningState();
    faceServiceSpies.getTuningSnapshot.mockReturnValue(snapshot);

    persistTuning();

    expect(faceServiceSpies.getTuningSnapshot).toHaveBeenCalledTimes(1);
    expect(tuningStorageSpies.saveTuning).toHaveBeenCalledTimes(1);
    expect(tuningStorageSpies.saveTuning).toHaveBeenCalledWith(snapshot);
  });
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
