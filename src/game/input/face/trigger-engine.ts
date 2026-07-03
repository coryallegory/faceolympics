import {
  DEFAULT_TRIGGERS,
  type FaceSignals,
  type FaceTriggers,
  type TriggerThresholds,
} from '../../core/types';

const staysActiveAboveThreshold = (
  value: number,
  threshold: number,
  hysteresisGap: number,
  isActive: boolean,
): boolean => (isActive ? value >= threshold - hysteresisGap : value >= threshold);

const staysActiveBelowThreshold = (
  value: number,
  threshold: number,
  hysteresisGap: number,
  isActive: boolean,
): boolean => (isActive ? value <= threshold + hysteresisGap : value <= threshold);

export class TriggerEngine {
  private triggers: FaceTriggers = { ...DEFAULT_TRIGGERS };

  constructor(private readonly thresholds: TriggerThresholds) {}

  update(signals: FaceSignals): FaceTriggers {
    const { eyeClosed, mouthOpen, lipPucker, browRaised, gaze, hysteresisGap } = this.thresholds;

    const blinkLeft = staysActiveBelowThreshold(
      signals.eyeOpenLeft,
      eyeClosed,
      hysteresisGap,
      this.triggers.blinkLeft,
    );
    const blinkRight = staysActiveBelowThreshold(
      signals.eyeOpenRight,
      eyeClosed,
      hysteresisGap,
      this.triggers.blinkRight,
    );

    this.triggers = {
      blinkLeft,
      blinkRight,
      bothEyesClosed: blinkLeft && blinkRight,
      mouthOpen: staysActiveAboveThreshold(
        signals.mouthOpen,
        mouthOpen,
        hysteresisGap,
        this.triggers.mouthOpen,
      ),
      lipsPursed: staysActiveAboveThreshold(
        signals.lipPucker,
        lipPucker,
        hysteresisGap,
        this.triggers.lipsPursed,
      ),
      browsRaised: staysActiveAboveThreshold(
        Math.max(signals.browRaiseLeft, signals.browRaiseRight),
        browRaised,
        hysteresisGap,
        this.triggers.browsRaised,
      ),
      browLeftRaised: staysActiveAboveThreshold(
        signals.browRaiseLeft,
        browRaised,
        hysteresisGap,
        this.triggers.browLeftRaised,
      ),
      browRightRaised: staysActiveAboveThreshold(
        signals.browRaiseRight,
        browRaised,
        hysteresisGap,
        this.triggers.browRightRaised,
      ),
      lookLeft: staysActiveAboveThreshold(
        -signals.gazeX,
        gaze,
        hysteresisGap,
        this.triggers.lookLeft,
      ),
      lookRight: staysActiveAboveThreshold(
        signals.gazeX,
        gaze,
        hysteresisGap,
        this.triggers.lookRight,
      ),
      lookUp: staysActiveAboveThreshold(
        signals.gazeY,
        gaze,
        hysteresisGap,
        this.triggers.lookUp,
      ),
      lookDown: staysActiveAboveThreshold(
        -signals.gazeY,
        gaze,
        hysteresisGap,
        this.triggers.lookDown,
      ),
    };

    return this.triggers;
  }
}
