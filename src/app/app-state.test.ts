import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventResult, FaceOlympicsEvent } from '../game/core/types';

// app-state.ts constructs a module-level FaceInputService, which touches
// `document` at import time. These tests only exercise the DOM-free
// current-event bookkeeping, so stub the class out rather than pull jsdom
// into the project for it.
vi.mock('../game/input/face/FaceInputService', () => ({
  FaceInputService: vi.fn(),
}));

const {
  clearCurrentEvent,
  getCurrentEvent,
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
