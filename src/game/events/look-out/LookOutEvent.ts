import type {
  EventContext,
  EventFrameResult,
  EventInput,
  EventResult,
  FaceOlympicsEvent,
  NormalizedFaceInput,
} from '../../core/types';
import { medalForScore } from '../../scoring/medals';
import { lookOutConfig } from './look-out.config';

type CuePhase = 'waiting' | 'cue';
type LookDirection = 'left' | 'right';

export class LookOutEvent implements FaceOlympicsEvent {
  id = 'look-out';
  title = 'Look Out';
  description = 'Watch for the cue and dodge the right way, fast, by looking left or right.';
  requiredInputs = ['lookLeft', 'lookRight', 'facePresent'] as const;

  private elapsed = 0;
  private phase: CuePhase = 'waiting';
  private waitTimer = 0;
  private reactionTimer = 0;
  private cueDirection: LookDirection = 'left';
  private nextCueIsLeft = true;
  private hits = 0;
  private misses = 0;
  private finished = false;
  private wasLookingLeft = false;
  private wasLookingRight = false;

  init(_context: EventContext): void {}

  start(): void {
    this.elapsed = 0;
    this.phase = 'waiting';
    this.waitTimer = lookOutConfig.cueIntervalMs;
    this.reactionTimer = 0;
    this.cueDirection = 'left';
    this.nextCueIsLeft = true;
    this.hits = 0;
    this.misses = 0;
    this.finished = false;
    this.wasLookingLeft = false;
    this.wasLookingRight = false;
  }

  // See BlinkOffEvent.update for why the parameter is still widened to include the
  // deprecated NormalizedFaceInput shape -- purely a type-level seam until P0.3.
  update(deltaMs: number, rawInput: NormalizedFaceInput | EventInput): EventFrameResult {
    const { triggers } = rawInput as EventInput;

    if (this.finished) {
      return this.frame('Done!');
    }

    this.elapsed += deltaMs;

    // Only count a *fresh* look (rising edge) as a dodge. Without this, holding a
    // direction from before the cue appeared would let a player "cheese" every cue
    // that happens to match, including the very first one -- see LookOutEvent.test.ts.
    const lookLeftEdge = triggers.lookLeft && !this.wasLookingLeft;
    const lookRightEdge = triggers.lookRight && !this.wasLookingRight;
    this.wasLookingLeft = triggers.lookLeft;
    this.wasLookingRight = triggers.lookRight;

    let feedback = 'Get ready...';

    if (this.phase === 'waiting') {
      this.waitTimer -= deltaMs;

      if (this.waitTimer <= 0) {
        this.cueDirection = this.nextCueIsLeft ? 'left' : 'right';
        this.nextCueIsLeft = !this.nextCueIsLeft;
        this.phase = 'cue';
        this.reactionTimer = lookOutConfig.reactionWindowMs;
      }
    } else {
      feedback = this.cueDirection === 'left' ? 'Dodge left!' : 'Dodge right!';
      this.reactionTimer -= deltaMs;

      const correctEdge = this.cueDirection === 'left' ? lookLeftEdge : lookRightEdge;
      const wrongEdge = this.cueDirection === 'left' ? lookRightEdge : lookLeftEdge;

      if (correctEdge) {
        this.hits += 1;
        feedback = 'Nice dodge!';
        this.phase = 'waiting';
        this.waitTimer = lookOutConfig.cueIntervalMs;
      } else if (wrongEdge) {
        this.misses += 1;
        feedback = 'Wrong way!';
        this.phase = 'waiting';
        this.waitTimer = lookOutConfig.cueIntervalMs;
      } else if (this.reactionTimer <= 0) {
        this.misses += 1;
        feedback = 'Too slow!';
        this.phase = 'waiting';
        this.waitTimer = lookOutConfig.cueIntervalMs;
      }
    }

    if (this.elapsed >= lookOutConfig.roundMs) {
      this.finished = true;
    }

    return this.frame(feedback);
  }

  pause(): void {}

  resume(): void {}

  finish(): EventResult {
    return {
      eventId: this.id,
      title: this.title,
      score: this.hits,
      medal: medalForScore(this.hits, lookOutConfig.medals),
      summary: `You dodged ${this.hits} of ${this.hits + this.misses} incoming looks.`,
    };
  }

  dispose(): void {}

  private frame(feedback: string): EventFrameResult {
    return {
      finished: this.finished,
      score: this.hits,
      feedback,
      state: {
        phase: this.phase,
        cueDirection: this.phase === 'cue' ? this.cueDirection : 'none',
        hits: this.hits,
        misses: this.misses,
        timeLeft: Math.max(0, Math.ceil((lookOutConfig.roundMs - this.elapsed) / 1000)),
      },
    };
  }
}
