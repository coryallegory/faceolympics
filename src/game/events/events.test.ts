import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_INPUT, type EventInput } from '../core/types';
import { BlinkOffEvent } from './blink-off/BlinkOffEvent';
import { DragonBlastEvent } from './dragon-blast/DragonBlastEvent';
import { FaceWeightliftingEvent } from './face-weightlifting/FaceWeightliftingEvent';

function withTriggers(patch: Partial<EventInput['triggers']>): EventInput {
  return {
    ...DEFAULT_EVENT_INPUT,
    triggers: { ...DEFAULT_EVENT_INPUT.triggers, ...patch },
  };
}

describe('POC event logic', () => {
  it('scores Blink-Off time until a blink finishes the run', () => {
    const event = new BlinkOffEvent();

    event.start();
    event.update(3000, DEFAULT_EVENT_INPUT);

    const frame = event.update(16, withTriggers({ bothEyesClosed: true }));

    expect(frame.finished).toBe(true);
    expect(event.finish().score).toBeGreaterThan(1500);
  });

  it('scores Face Weightlifting hold time when eyebrows lift the bar', () => {
    const event = new FaceWeightliftingEvent();

    event.start();

    for (let i = 0; i < 80; i++) {
      event.update(100, withTriggers({ browsRaised: true }));
    }

    expect(event.finish().score).toBeGreaterThan(0);
  });

  it('scores Dragon Blast hits after charge and release', () => {
    const event = new DragonBlastEvent();

    event.start();
    event.update(1500, withTriggers({ mouthOpen: true }));
    event.update(100, withTriggers({ mouthOpen: false }));

    expect(event.finish().score).toBe(1);
  });
});
