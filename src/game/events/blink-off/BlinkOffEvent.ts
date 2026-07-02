import type {
  CalibrationProfile,
  EventContext,
  EventFrameResult,
  EventResult,
  FaceOlympicsEvent,
  NormalizedFaceInput,
} from '../../core/types';
import { medalForScore } from '../../scoring/medals';
import { blinkOffConfig } from './blink-off.config';

export class BlinkOffEvent implements FaceOlympicsEvent {
  id = 'blink-off';
  title = 'Blink-Off';
  description = 'Keep those peepers open! Blink and the clock gets bonked.';
  requiredInputs = ['bothEyesClosed', 'facePresent'] as const;

  private elapsed = 0;
  private penalty = 0;
  private finished = false;

  init(_context: EventContext): void {}

  start(_calibration: CalibrationProfile): void {
    this.elapsed = 0;
    this.penalty = 0;
    this.finished = false;
  }

  update(deltaMs: number, input: NormalizedFaceInput): EventFrameResult {
    if (this.finished) {
      return this.frame('Done!');
    }

    this.elapsed += deltaMs;

    if (!input.facePresent) {
      this.penalty += deltaMs * 0.5;
    }

    if (input.bothEyesClosed) {
      this.penalty += blinkOffConfig.blinkPenaltyMs;
      this.finished = true;
    }

    if (this.elapsed >= blinkOffConfig.maxMs) {
      this.finished = true;
    }

    return this.frame(input.bothEyesClosed ? 'Blink bonk!' : 'Hold those eyes open!');
  }

  pause(): void {}

  resume(): void {}

  finish(): EventResult {
    const score = Math.max(0, Math.round(this.elapsed - this.penalty));

    return {
      eventId: this.id,
      title: this.title,
      score,
      medal: medalForScore(score, blinkOffConfig.medals),
      summary: `You stared down the silliness for ${(score / 1000).toFixed(1)} seconds.`,
    };
  }

  dispose(): void {}

  private frame(feedback: string): EventFrameResult {
    const score = this.finish().score;

    return {
      finished: this.finished,
      score,
      feedback,
      state: {
        seconds: (score / 1000).toFixed(1),
        penalty: Math.round(this.penalty),
      },
    };
  }
}
