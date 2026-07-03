import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNALS,
  DEFAULT_THRESHOLDS,
  type FaceSignals,
} from '../../core/types';
import { TriggerEngine } from './trigger-engine';

const createSignals = (patch: Partial<FaceSignals>): FaceSignals => ({
  ...DEFAULT_SIGNALS,
  ...patch,
});

describe('TriggerEngine', () => {
  it('keeps mouthOpen active through the hysteresis dead zone and releases below threshold minus gap', () => {
    const engine = new TriggerEngine(DEFAULT_THRESHOLDS);

    expect(engine.update(createSignals({ mouthOpen: 0.44 })).mouthOpen).toBe(false);
    expect(engine.update(createSignals({ mouthOpen: 0.45 })).mouthOpen).toBe(true);
    expect(engine.update(createSignals({ mouthOpen: 0.31 })).mouthOpen).toBe(true);
    expect(engine.update(createSignals({ mouthOpen: 0.29 })).mouthOpen).toBe(false);
  });

  it('keeps lipsPursed active through the hysteresis dead zone and releases below threshold minus gap', () => {
    const engine = new TriggerEngine(DEFAULT_THRESHOLDS);

    expect(engine.update(createSignals({ lipPucker: 0.49 })).lipsPursed).toBe(false);
    expect(engine.update(createSignals({ lipPucker: 0.5 })).lipsPursed).toBe(true);
    expect(engine.update(createSignals({ lipPucker: 0.36 })).lipsPursed).toBe(true);
    expect(engine.update(createSignals({ lipPucker: 0.34 })).lipsPursed).toBe(false);
  });

  it('keeps brow triggers active through the hysteresis dead zone using max(left, right) for browsRaised', () => {
    const engine = new TriggerEngine(DEFAULT_THRESHOLDS);

    let triggers = engine.update(createSignals({ browRaiseLeft: 0.61, browRaiseRight: 0.2 }));
    expect(triggers.browLeftRaised).toBe(true);
    expect(triggers.browRightRaised).toBe(false);
    expect(triggers.browsRaised).toBe(true);

    triggers = engine.update(createSignals({ browRaiseLeft: 0.46, browRaiseRight: 0.2 }));
    expect(triggers.browLeftRaised).toBe(true);
    expect(triggers.browsRaised).toBe(true);

    triggers = engine.update(createSignals({ browRaiseLeft: 0.2, browRaiseRight: 0.6 }));
    expect(triggers.browLeftRaised).toBe(false);
    expect(triggers.browRightRaised).toBe(true);
    expect(triggers.browsRaised).toBe(true);

    triggers = engine.update(createSignals({ browRaiseLeft: 0.2, browRaiseRight: 0.46 }));
    expect(triggers.browsRaised).toBe(true);

    triggers = engine.update(createSignals({ browRaiseLeft: 0.2, browRaiseRight: 0.44 }));
    expect(triggers.browsRaised).toBe(false);
  });

  it('keeps look direction triggers active through the hysteresis dead zone and releases below threshold minus gap', () => {
    const engine = new TriggerEngine(DEFAULT_THRESHOLDS);

    let triggers = engine.update(createSignals({ gazeX: -0.4 }));
    expect(triggers.lookLeft).toBe(true);
    expect(triggers.lookRight).toBe(false);

    triggers = engine.update(createSignals({ gazeX: -0.3 }));
    expect(triggers.lookLeft).toBe(true);

    triggers = engine.update(createSignals({ gazeX: -0.24 }));
    expect(triggers.lookLeft).toBe(false);

    triggers = engine.update(createSignals({ gazeX: 0.4 }));
    expect(triggers.lookRight).toBe(true);
    expect(triggers.lookLeft).toBe(false);

    triggers = engine.update(createSignals({ gazeX: 0.3 }));
    expect(triggers.lookRight).toBe(true);

    triggers = engine.update(createSignals({ gazeX: 0.24 }));
    expect(triggers.lookRight).toBe(false);

    triggers = engine.update(createSignals({ gazeY: 0.41 }));
    expect(triggers.lookUp).toBe(true);
    expect(triggers.lookDown).toBe(false);

    triggers = engine.update(createSignals({ gazeY: 0.3 }));
    expect(triggers.lookUp).toBe(true);

    triggers = engine.update(createSignals({ gazeY: 0.24 }));
    expect(triggers.lookUp).toBe(false);

    triggers = engine.update(createSignals({ gazeY: -0.41 }));
    expect(triggers.lookDown).toBe(true);

    triggers = engine.update(createSignals({ gazeY: -0.3 }));
    expect(triggers.lookDown).toBe(true);

    triggers = engine.update(createSignals({ gazeY: -0.24 }));
    expect(triggers.lookDown).toBe(false);
  });

  it('requires both eye triggers to be active before bothEyesClosed becomes true', () => {
    const engine = new TriggerEngine(DEFAULT_THRESHOLDS);

    let triggers = engine.update(createSignals({ eyeOpenLeft: 0.45, eyeOpenRight: 1 }));
    expect(triggers.blinkLeft).toBe(true);
    expect(triggers.blinkRight).toBe(false);
    expect(triggers.bothEyesClosed).toBe(false);

    triggers = engine.update(createSignals({ eyeOpenLeft: 0.45, eyeOpenRight: 0.45 }));
    expect(triggers.bothEyesClosed).toBe(true);
  });

  it('keeps blink triggers active through the hysteresis dead zone and clears after the eye reopen threshold', () => {
    const engine = new TriggerEngine(DEFAULT_THRESHOLDS);

    let triggers = engine.update(createSignals({ eyeOpenLeft: 0.46, eyeOpenRight: 0.46 }));
    expect(triggers.blinkLeft).toBe(false);
    expect(triggers.blinkRight).toBe(false);

    triggers = engine.update(createSignals({ eyeOpenLeft: 0.45, eyeOpenRight: 0.45 }));
    expect(triggers.blinkLeft).toBe(true);
    expect(triggers.blinkRight).toBe(true);

    triggers = engine.update(createSignals({ eyeOpenLeft: 0.59, eyeOpenRight: 0.59 }));
    expect(triggers.blinkLeft).toBe(true);
    expect(triggers.blinkRight).toBe(true);

    triggers = engine.update(createSignals({ eyeOpenLeft: 0.61, eyeOpenRight: 0.61 }));
    expect(triggers.blinkLeft).toBe(false);
    expect(triggers.blinkRight).toBe(false);
  });
});
