import { describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_INPUT, type EventInput } from '../core/types';
import { BlinkOffEvent } from './blink-off/BlinkOffEvent';
import { blinkOffConfig } from './blink-off/blink-off.config';
import { DragonBlastEvent } from './dragon-blast/DragonBlastEvent';
import { dragonBlastConfig } from './dragon-blast/dragon-blast.config';
import { FaceWeightliftingEvent } from './face-weightlifting/FaceWeightliftingEvent';

function withTriggers(patch: Partial<EventInput['triggers']>): EventInput {
  return {
    ...DEFAULT_EVENT_INPUT,
    triggers: { ...DEFAULT_EVENT_INPUT.triggers, ...patch },
  };
}

function withSignals(patch: Partial<EventInput['signals']>): EventInput {
  return {
    ...DEFAULT_EVENT_INPUT,
    signals: { ...DEFAULT_EVENT_INPUT.signals, ...patch },
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

  it('applies a face-absent penalty to Blink-Off that reduces score below elapsed time', () => {
    const event = new BlinkOffEvent();

    event.start();

    const frame = event.update(1000, withSignals({ facePresent: false }));

    // penalty accrues at 0.5x deltaMs while the face is absent, so 1000ms
    // elapsed with no face present yields a 500ms penalty and a 500 score.
    expect(frame.finished).toBe(false);
    expect(frame.score).toBe(500);
    expect(event.finish().score).toBe(500);
  });

  it('auto-finishes Blink-Off once maxMs elapses without a blink', () => {
    const event = new BlinkOffEvent();

    event.start();

    const frame = event.update(blinkOffConfig.maxMs, DEFAULT_EVENT_INPUT);

    expect(frame.finished).toBe(true);
    expect(frame.feedback).toBe('Hold those eyes open!');
    expect(event.finish().score).toBe(blinkOffConfig.maxMs);
  });

  it('does not score a Dragon Blast hit when the purse-release happens below chargeToHit', () => {
    const event = new DragonBlastEvent();

    event.start();
    event.update(500, withTriggers({ mouthOpen: true }));

    // charge after 500ms is 500/1400 ~= 0.357, well under chargeToHit (0.9);
    // pursing lips forces an immediate release at that charge level.
    const frame = event.update(16, withTriggers({ mouthOpen: true, lipsPursed: true }));

    expect(frame.state.hits).toBe(0);
    expect(event.finish().score).toBe(0);
  });

  it('scores a Dragon Blast hit once charge reaches exactly chargeToHit at release', () => {
    const event = new DragonBlastEvent();

    event.start();

    const chargeMs = dragonBlastConfig.chargeToHit * 1400;

    event.update(chargeMs, withTriggers({ mouthOpen: true }));
    const frame = event.update(16, withTriggers({ mouthOpen: false }));

    expect(frame.state.hits).toBe(1);
    expect(event.finish().score).toBe(1);
  });

  it('halts Face Weightlifting hold accrual and drops the bar height on a blink', () => {
    const event = new FaceWeightliftingEvent();

    event.start();

    let frame = event.update(100, withTriggers({ browsRaised: true }));
    for (let i = 0; i < 9; i++) {
      frame = event.update(100, withTriggers({ browsRaised: true }));
    }

    const heightBeforeBlink = frame.state.height as number;
    const holdBeforeBlink = frame.state.holdMs as number;

    expect(heightBeforeBlink).toBeGreaterThan(82);
    expect(holdBeforeBlink).toBeGreaterThan(0);

    const blinkFrame = event.update(100, withTriggers({ browsRaised: true, bothEyesClosed: true }));

    // a blink blocks hold accrual for that frame (even though the lift raised
    // height first) and then knocks the bar back down.
    expect(blinkFrame.state.holdMs).toBe(holdBeforeBlink);
    expect(blinkFrame.state.height as number).toBeLessThan(heightBeforeBlink);
  });
});
