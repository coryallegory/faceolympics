import {
  DEFAULT_THRESHOLDS,
  type EventFrameResult,
  type EventInput,
  type FaceOlympicsEvent,
} from '../../game/core/types';
import type { FaceInputService } from '../../game/input/face/FaceInputService';
import { drawFaceOverlay } from '../face-overlay';
import type { Screen } from '../navigation';
import { button } from '../ui';

export interface PlayScreenOptions {
  event: FaceOlympicsEvent;
  face: FaceInputService;
  onExit: () => void;
  onFinish: (event: FaceOlympicsEvent) => void;
}

// A hidden/backgrounded tab starves requestAnimationFrame, so the first frame after
// regaining focus can report a rawDelta of several seconds. Clamping keeps timed events
// (e.g. Blink-Off) from being force-finished by a single giant tick.
const MAX_FRAME_DELTA_MS = 100;

export function clampFrameDelta(rawDelta: number): number {
  return Math.min(rawDelta, MAX_FRAME_DELTA_MS);
}

// D1 migrated the three event classes (src/game/events/**) to a zero-arg start() and an
// EventInput-driven update() -- no more CalibrationProfile, no more value-shape bridge
// function (the legacy input-conversion helper that used to sit here is gone entirely;
// getEventInput()'s result is passed straight through below, untransformed). FaceOlympicsEvent
// in src/game/core/types.ts (a contract file this task can't touch) still declares the
// pre-migration signature -- start(calibration), update(deltaMs, NormalizedFaceInput) --
// because it can't drop that shape until P0.3 removes it from types.ts once every consumer
// (this task included) has migrated. PlayableEvent is a type-only seam bridging that gap: no
// data is transformed, only the static type of the call is asserted to match what the
// migrated classes actually implement.
interface PlayableEvent {
  start(): void;
  update(deltaMs: number, input: EventInput): EventFrameResult;
}

function asPlayable(event: FaceOlympicsEvent): PlayableEvent {
  return event as unknown as PlayableEvent;
}

export function showPlayScreen(options: PlayScreenOptions): Screen {
  return (ctx) => {
    const { event, face, onExit, onFinish } = options;
    const playable = asPlayable(event);

    playable.start();

    let last = performance.now();

    ctx.render('<main class="screen play"><h2 id="event-title"></h2><section class="arena" id="arena"></section><details><summary>Debug controls</summary><div id="actions"></div><pre class="debug" id="debug"></pre></details><div class="pip" id="pip"><canvas id="pip-canvas"></canvas></div></main>');

    const title = ctx.app.querySelector<HTMLHeadingElement>('#event-title')!;
    const arena = ctx.app.querySelector<HTMLElement>('#arena')!;
    const details = ctx.app.querySelector<HTMLDetailsElement>('details')!;
    const actions = ctx.app.querySelector<HTMLDivElement>('#actions')!;
    const debug = ctx.app.querySelector<HTMLPreElement>('#debug')!;
    const pipCanvas = ctx.app.querySelector<HTMLCanvasElement>('#pip-canvas')!;
    const pip = ctx.app.querySelector<HTMLDivElement>('#pip')!;

    title.textContent = event.title;

    const mascot = document.createElement('div');
    mascot.className = 'mascot';
    const feedback = document.createElement('strong');
    const score = document.createElement('p');
    arena.append(mascot, feedback, score);

    pip.prepend(face.getVideo());
    actions.append(
      button('Blink', () => face.setDebugInput({ eyeOpenLeft: 0, eyeOpenRight: 0 })),
      button('Brows Up', () => face.setDebugInput({
        browRaiseLeft: 1,
        browRaiseRight: 1,
        eyeOpenLeft: 1,
        eyeOpenRight: 1,
      })),
      button('Mouth Open', () => face.setDebugInput({ mouthOpen: 0.9, lipPucker: 0 })),
      button('Release', () => face.setDebugInput({ mouthOpen: 0, lipPucker: 1 })),
      button('Pause / Exit', () => {
        event.pause();
        onExit();
      }),
    );

    const mascotLabel = mascotFor(event.id);

    const loop = (now: number): void => {
      const rawDelta = now - last;
      last = now;
      const delta = clampFrameDelta(rawDelta);

      const eventInput = face.getEventInput();
      const frame = playable.update(delta, eventInput);

      updateArena(mascot, feedback, score, mascotLabel, frame);
      updateDebug(details, debug, eventInput, frame);
      updateOverlay(face, eventInput, pip, pipCanvas);

      if (frame.finished) {
        onFinish(event);
        return;
      }

      ctx.setAnimationFrame(requestAnimationFrame(loop));
    };

    ctx.setAnimationFrame(requestAnimationFrame(loop));
  };
}

function mascotFor(eventId: string): string {
  if (eventId === 'dragon-blast') {
    return '\u{1F409}';
  }

  if (eventId === 'face-weightlifting') {
    return '\u{1F3CB}\u{FE0F}';
  }

  return '\u{1F440}';
}

function updateArena(
  mascot: HTMLDivElement,
  feedback: HTMLElement,
  score: HTMLParagraphElement,
  mascotLabel: string,
  frame: EventFrameResult,
): void {
  mascot.textContent = mascotLabel;
  feedback.textContent = frame.feedback;
  score.textContent = `Score: ${frame.score}`;
}

function updateDebug(
  details: HTMLDetailsElement,
  debug: HTMLPreElement,
  eventInput: EventInput,
  frame: EventFrameResult,
): void {
  if (!details.open) {
    return;
  }

  debug.textContent = JSON.stringify(
    {
      signals: eventInput.signals,
      triggers: eventInput.triggers,
      thresholds: DEFAULT_THRESHOLDS,
      state: frame.state,
    },
    null,
    2,
  );
}

function updateOverlay(
  face: FaceInputService,
  eventInput: EventInput,
  pip: HTMLDivElement,
  pipCanvas: HTMLCanvasElement,
): void {
  const width = pip.clientWidth;
  const height = pip.clientHeight;

  if (pipCanvas.width !== width || pipCanvas.height !== height) {
    pipCanvas.width = width;
    pipCanvas.height = height;
  }

  const overlay = pipCanvas.getContext('2d');

  if (!overlay) {
    return;
  }

  overlay.clearRect(0, 0, width, height);
  drawFaceOverlay(
    overlay,
    face.getDebugFrame(),
    eventInput.triggers,
    face.getVideo(),
    width,
    height,
  );
}
