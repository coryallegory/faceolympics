import type {
  EventContext,
  EventFrameResult,
  EventInput,
  EventResult,
  FaceOlympicsEvent,
} from '../../core/types';
import { medalForScore } from '../../scoring/medals';
import { faceWeightliftingConfig } from './face-weightlifting.config';

export class FaceWeightliftingEvent implements FaceOlympicsEvent {
  id = 'face-weightlifting';
  title = 'Face Weightlifting';
  description = 'Raise eyebrows to lift the silly barbell, relax to steady it, and do not blink under pressure.';
  requiredInputs = ['eyebrowsRaised', 'bothEyesClosed', 'facePresent'] as const;

  private elapsed = 0;
  private height = 0;
  private hold = 0;
  private finished = false;

  init(_context: EventContext): void {}

  start(): void {
    this.elapsed = 0;
    this.height = 0;
    this.hold = 0;
    this.finished = false;
  }

  // The brow-raise trigger is computed centrally (hysteresis + adaptive normalization),
  // so this event no longer tracks its own eyebrow threshold.
  update(deltaMs: number, input: EventInput): EventFrameResult {
    const { triggers } = input;

    this.elapsed += deltaMs;

    const lift = triggers.browsRaised;

    this.height = Math.min(1, Math.max(0, this.height + (lift ? 0.0012 : -0.0006) * deltaMs));

    if (this.height > 0.82 && !triggers.bothEyesClosed) {
      this.hold += deltaMs;
    }

    if (triggers.bothEyesClosed) {
      this.height = Math.max(0, this.height - 0.2);
    }

    if (
      this.elapsed >= faceWeightliftingConfig.roundMs ||
      this.hold >= faceWeightliftingConfig.holdTargetMs
    ) {
      this.finished = true;
    }

    return {
      finished: this.finished,
      score: Math.round(this.hold),
      feedback: this.height > 0.82 ? 'Hold it high!' : lift ? 'Lift with your eyebrows!' : 'Relax, then raise again!',
      state: {
        height: Math.round(this.height * 100),
        holdMs: Math.round(this.hold),
      },
    };
  }

  pause(): void {}

  resume(): void {}

  finish(): EventResult {
    const score = Math.round(this.hold);

    return {
      eventId: this.id,
      title: this.title,
      score,
      medal: medalForScore(score, faceWeightliftingConfig.medals),
      summary: `You held the goofy barbell for ${(score / 1000).toFixed(1)} seconds.`,
    };
  }

  dispose(): void {}
}
