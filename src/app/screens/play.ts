import type {
  CalibrationProfile,
  EventFrameResult,
  FaceOlympicsEvent,
  NormalizedFaceInput,
} from '../../game/core/types';
import type { FaceInputService } from '../../game/input/face/FaceInputService';
import { drawFaceOverlay } from '../face-overlay';
import type { Screen } from '../navigation';
import { button } from '../ui';

export interface PlayScreenOptions {
  event: FaceOlympicsEvent;
  calibration: CalibrationProfile;
  face: FaceInputService;
  onExit: () => void;
  onFinish: (event: FaceOlympicsEvent) => void;
}

export function showPlayScreen(options: PlayScreenOptions): Screen {
  return (ctx) => {
    const { event, calibration, face, onExit, onFinish } = options;

    event.start(calibration);

    let last = performance.now();

    ctx.render('<main class="screen play"><h2 id="event-title"></h2><section class="arena" id="arena"></section><details><summary>Debug controls</summary><div id="actions"></div><pre class="debug" id="debug"></pre></details><div class="pip" id="pip"><canvas id="pip-canvas"></canvas></div></main>');

    const title = ctx.app.querySelector<HTMLHeadingElement>('#event-title');
    const arena = ctx.app.querySelector<HTMLElement>('#arena');
    const details = ctx.app.querySelector<HTMLDetailsElement>('details');
    const actions = ctx.app.querySelector<HTMLDivElement>('#actions');
    const debug = ctx.app.querySelector<HTMLPreElement>('#debug');
    const pipCanvas = ctx.app.querySelector<HTMLCanvasElement>('#pip-canvas');
    const pip = ctx.app.querySelector<HTMLDivElement>('#pip');

    if (
      !title ||
      !arena ||
      !details ||
      !actions ||
      !debug ||
      !pipCanvas ||
      !pip
    ) {
      return;
    }

    title.textContent = event.title;

    const mascot = document.createElement('div');
    mascot.className = 'mascot';
    const feedback = document.createElement('strong');
    const score = document.createElement('p');
    arena.append(mascot, feedback, score);

    pip.prepend(face.getVideo());
    actions.append(
      button('Blink', () => face.setDebugInput({
        bothEyesClosed: true,
        leftBlink: true,
        rightBlink: true,
      })),
      button('Brows Up', () => face.setDebugInput({
        eyebrowsRaised: 0.9,
        leftEyebrowRaised: 0.9,
        rightEyebrowRaised: 0.9,
        bothEyesClosed: false,
      })),
      button('Mouth Open', () => face.setDebugInput({ mouthOpen: 0.9, lipsPursed: false })),
      button('Release', () => face.setDebugInput({ mouthOpen: 0, lipsPursed: true })),
      button('Pause / Exit', () => {
        event.pause();
        onExit();
      }),
    );

    const mascotLabel = mascotFor(event.id);

    const loop = (now: number): void => {
      const delta = now - last;
      last = now;

      const input = face.getInput();
      const frame = event.update(delta, input);

      updateArena(mascot, feedback, score, mascotLabel, frame);
      updateDebug(details, debug, input, calibration, frame);
      updateOverlay(face, input, pip, pipCanvas);

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
  input: NormalizedFaceInput,
  calibration: CalibrationProfile,
  frame: EventFrameResult,
): void {
  if (!details.open) {
    return;
  }

  debug.textContent = JSON.stringify(
    {
      input,
      thresholds: calibration.thresholds,
      state: frame.state,
    },
    null,
    2,
  );
}

function updateOverlay(
  face: FaceInputService,
  input: NormalizedFaceInput,
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
    input,
    face.getVideo(),
    width,
    height,
  );
}
