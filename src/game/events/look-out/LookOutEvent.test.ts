import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_INPUT, type EventInput } from '../../core/types';
import { LookOutEvent } from './LookOutEvent';
import { lookOutConfig } from './look-out.config';

function withTriggers(patch: Partial<EventInput['triggers']>): EventInput {
  return {
    ...DEFAULT_EVENT_INPUT,
    triggers: { ...DEFAULT_EVENT_INPUT.triggers, ...patch },
  };
}

describe('LookOutEvent', () => {
  it('starts in the waiting phase with zero score', () => {
    const event = new LookOutEvent();

    event.start();
    const frame = event.update(0, DEFAULT_EVENT_INPUT);

    expect(frame.score).toBe(0);
    expect(frame.state.phase).toBe('waiting');
  });

  it('issues a cue after the wait interval and scores a correct dodge', () => {
    const event = new LookOutEvent();

    event.start();
    // No input during the wait -- crosses into the cue phase. The first cue is
    // deterministically 'left' (see LookOutEvent.start()).
    event.update(lookOutConfig.cueIntervalMs, DEFAULT_EVENT_INPUT);
    const frame = event.update(16, withTriggers({ lookLeft: true }));

    expect(frame.score).toBe(1);
    expect(frame.state.phase).toBe('waiting');
  });

  it('does not score a dodge in the wrong direction', () => {
    const event = new LookOutEvent();

    event.start();
    event.update(lookOutConfig.cueIntervalMs, DEFAULT_EVENT_INPUT); // cue = left
    const frame = event.update(16, withTriggers({ lookRight: true }));

    expect(frame.score).toBe(0);
    expect(frame.state.phase).toBe('waiting');
  });

  it('does not score if the reaction window times out with no dodge', () => {
    const event = new LookOutEvent();

    event.start();
    event.update(lookOutConfig.cueIntervalMs, DEFAULT_EVENT_INPUT); // cue = left
    const frame = event.update(lookOutConfig.reactionWindowMs, DEFAULT_EVENT_INPUT);

    expect(frame.score).toBe(0);
    expect(frame.state.phase).toBe('waiting');
  });

  it('ignores a trigger that was already active before the cue appeared', () => {
    const event = new LookOutEvent();

    event.start();
    // Hold "look left" from before start, through the entire wait phase, into the
    // moment the cue appears -- this should not count as a dodge (no rising edge).
    const cueFrame = event.update(lookOutConfig.cueIntervalMs, withTriggers({ lookLeft: true }));

    expect(cueFrame.state.phase).toBe('cue');

    const next = event.update(16, withTriggers({ lookLeft: true })); // still holding, no new edge

    expect(next.score).toBe(0);
  });

  it('finishes after roundMs elapses', () => {
    const event = new LookOutEvent();

    event.start();

    let frame = event.update(1000, DEFAULT_EVENT_INPUT);

    for (let elapsed = 1000; elapsed < lookOutConfig.roundMs; elapsed += 1000) {
      frame = event.update(1000, DEFAULT_EVENT_INPUT);
    }

    expect(frame.finished).toBe(true);

    const result = event.finish();

    expect(result.eventId).toBe('look-out');
    expect(result.score).toBe(0);
    expect(result.medal).toBe('none');
  });
});
