import type {
  EventContext,
  EventFrameResult,
  EventInput,
  EventResult,
  FaceOlympicsEvent,
} from '../../core/types';
import { medalForScore } from '../../scoring/medals';
import { dragonBlastConfig } from './dragon-blast.config';

export class DragonBlastEvent implements FaceOlympicsEvent {
  id = 'dragon-blast';
  title = 'Dragon Blast';
  description = 'Open your mouth to charge dragon fire, then close or purse lips to blast targets.';
  requiredInputs = ['mouthOpen', 'lipsPursed', 'facePresent'] as const;

  private elapsed = 0;
  private charge = 0;
  private hits = 0;
  private wasCharging = false;
  private finished = false;

  init(_context: EventContext): void {}

  start(): void {
    this.elapsed = 0;
    this.charge = 0;
    this.hits = 0;
    this.wasCharging = false;
    this.finished = false;
  }

  update(deltaMs: number, input: EventInput): EventFrameResult {
    const { triggers } = input;

    this.elapsed += deltaMs;

    const charging = triggers.mouthOpen;

    if (charging) {
      this.charge = Math.min(1, this.charge + deltaMs / 1400);
      this.wasCharging = true;
    }

    const release = (this.wasCharging && !charging) || triggers.lipsPursed;

    if (release) {
      if (this.charge >= dragonBlastConfig.chargeToHit) {
        this.hits += 1;
      }

      this.charge = 0;
      this.wasCharging = false;
    }

    if (this.elapsed >= dragonBlastConfig.roundMs) {
      this.finished = true;
    }

    return {
      finished: this.finished,
      score: this.hits,
      feedback: charging ? 'Charging spicy dragon breath!' : release ? 'Blast!' : 'Open wide to charge!',
      state: {
        charge: Math.round(this.charge * 100),
        hits: this.hits,
        timeLeft: Math.max(0, Math.ceil((dragonBlastConfig.roundMs - this.elapsed) / 1000)),
      },
    };
  }

  pause(): void {}

  resume(): void {}

  finish(): EventResult {
    return {
      eventId: this.id,
      title: this.title,
      score: this.hits,
      medal: medalForScore(this.hits, dragonBlastConfig.medals),
      summary: `You toasted ${this.hits} wobbly targets.`,
    };
  }

  dispose(): void {}
}
