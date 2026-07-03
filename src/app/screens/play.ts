import {
  DEFAULT_THRESHOLDS,
  type EventFrameResult,
  type EventInput,
  type FaceOlympicsEvent,
} from '../../game/core/types';
import type { FaceInputService, FaceTrackerStatus } from '../../game/input/face/FaceInputService';
import { drawFaceOverlay } from '../face-overlay';
import type { Screen } from '../navigation';
import { button } from '../ui';

export interface PlayScreenOptions {
  event: FaceOlympicsEvent;
  face: FaceInputService;
  onExit: () => void;
  onFinish: (event: FaceOlympicsEvent) => void;
  // Camera Check (src/app/screens/camera-check.ts) isn't reachable from menu navigation yet --
  // that wiring is B2, still blocked on A9 as of this task. Keeping this optional means D4
  // doesn't have to touch main.ts (out of this task's file scope) to compile; the error state
  // below only renders the link when a caller supplies it. See PR description for the
  // ground-rules note this follows (docs/agent-task-backlog.md, "screen isn't reachable yet").
  onOpenCameraCheck?: () => void;
}

// A hidden/backgrounded tab starves requestAnimationFrame, so the first frame after
// regaining focus can report a rawDelta of several seconds. Clamping keeps timed events
// (e.g. Blink-Off) from being force-finished by a single giant tick.
const MAX_FRAME_DELTA_MS = 100;

export function clampFrameDelta(rawDelta: number): number {
  return Math.min(rawDelta, MAX_FRAME_DELTA_MS);
}

// --- Get Ready gate: pure state/timeout logic -----------------------------------------------
//
// Everything below is deliberately free of `document`/`requestAnimationFrame` so it's testable
// without a browser DOM (this project runs vitest without jsdom -- see the comment in
// FaceInputService.test.ts). The screen function further down drives these functions from an
// rAF polling loop and renders their results.

const FACE_WAIT_TIMEOUT_MS = 10_000;
const COUNTDOWN_STEP_MS = 1000;

export const COUNTDOWN_LABELS = ['3', '2', '1'] as const;

export type FaceWaitOutcome = 'ready' | 'waiting' | 'timed-out';

// Pure decision for the "Looking for your face..." gate step. `ready` takes priority over
// `timed-out` even at/after the timeout instant, so a face that shows up on the exact frame the
// budget expires still counts as ready rather than getting bounced to the "play anyway" offer.
export function resolveFaceWaitOutcome(
  status: FaceTrackerStatus,
  facePresent: boolean,
  elapsedMs: number,
  timeoutMs: number = FACE_WAIT_TIMEOUT_MS,
): FaceWaitOutcome {
  if (status === 'tracking' && facePresent) {
    return 'ready';
  }

  return elapsedMs >= timeoutMs ? 'timed-out' : 'waiting';
}

export function countdownLabelForStep(stepIndex: number): string | undefined {
  return COUNTDOWN_LABELS[stepIndex];
}

export function isCountdownComplete(stepIndex: number): boolean {
  return stepIndex >= COUNTDOWN_LABELS.length;
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
    const { event, face, onExit, onFinish, onOpenCameraCheck } = options;
    const playable = asPlayable(event);

    ctx.render(
      '<main class="screen play"><h2 id="event-title"></h2>'
      + '<section class="arena" id="arena">'
      + '<div id="gate" class="gate"><p id="gate-message"></p><div id="gate-actions"></div></div>'
      + '</section>'
      + '<details><summary>Debug controls</summary><div id="actions"></div><pre class="debug" id="debug"></pre></details>'
      + '<div class="pip" id="pip"><canvas id="pip-canvas"></canvas></div></main>',
    );

    const title = ctx.app.querySelector<HTMLHeadingElement>('#event-title')!;
    const arena = ctx.app.querySelector<HTMLElement>('#arena')!;
    const gate = ctx.app.querySelector<HTMLDivElement>('#gate')!;
    const gateMessage = ctx.app.querySelector<HTMLParagraphElement>('#gate-message')!;
    const gateActions = ctx.app.querySelector<HTMLDivElement>('#gate-actions')!;
    const details = ctx.app.querySelector<HTMLDetailsElement>('details')!;
    const actions = ctx.app.querySelector<HTMLDivElement>('#actions')!;
    const debug = ctx.app.querySelector<HTMLPreElement>('#debug')!;
    const pipCanvas = ctx.app.querySelector<HTMLCanvasElement>('#pip-canvas')!;
    const pip = ctx.app.querySelector<HTMLDivElement>('#pip')!;

    title.textContent = event.title;

    // navigation.ts's goTo() cancels the most recently registered rAF id on every screen
    // transition, and every timer this gate schedules (face-wait polling, countdown ticks) is
    // registered through ctx.setAnimationFrame -- so navigating away mid-gate stops those loops
    // for free. isActive() is a defensive backstop for the one suspension point that isn't an
    // rAF frame (`await face.start()`), so a transition landing exactly between that await
    // settling and the next line running still can't touch a torn-down screen. Same pattern as
    // camera-check.ts's isActive() check.
    const isActive = (): boolean => ctx.app.contains(gate);

    let started = false;

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
        // Guard: this button is reachable during the Get Ready gate too (it lives in the
        // always-rendered debug panel), but event.pause() is only meaningful once start() has
        // actually run -- pausing before start isn't part of the documented lifecycle.
        if (started) {
          event.pause();
        }
        onExit();
      }),
    );

    const mascotLabel = mascotFor(event.id);

    function renderGateActions(extra: readonly HTMLButtonElement[]): void {
      gateActions.replaceChildren(...extra, button('Cancel', onExit));
    }

    function showGateError(): void {
      const message = face.getDebugFrame().message;
      gateMessage.textContent = message;
      const retryButton = button('Retry', () => ctx.goTo(showPlayScreen(options)));
      const extra = onOpenCameraCheck
        ? [retryButton, button('Open Camera Check', onOpenCameraCheck)]
        : [retryButton];
      renderGateActions(extra);
    }

    function waitForFace(): Promise<boolean> {
      return new Promise((resolve) => {
        const startedAt = performance.now();

        const poll = (now: number): void => {
          if (!isActive()) {
            return;
          }

          const status = face.getDebugFrame().status;
          const facePresent = face.getEventInput().signals.facePresent;
          const outcome = resolveFaceWaitOutcome(status, facePresent, now - startedAt);

          if (outcome === 'ready') {
            resolve(true);
            return;
          }

          if (outcome === 'timed-out') {
            resolve(false);
            return;
          }

          ctx.setAnimationFrame(requestAnimationFrame(poll));
        };

        ctx.setAnimationFrame(requestAnimationFrame(poll));
      });
    }

    function offerPlayAnyway(): Promise<void> {
      return new Promise((resolve) => {
        gateMessage.textContent = 'Still looking for your face. You can keep waiting, or play anyway using the debug controls below.';
        renderGateActions([button('Play Anyway', () => resolve())]);
        // If the player navigates away instead of clicking, this promise is simply abandoned --
        // every call site awaiting it already re-checks isActive() before doing anything next.
      });
    }

    function runCountdown(): Promise<void> {
      return new Promise((resolve) => {
        let stepIndex = 0;
        let stepStartedAt = performance.now();
        gateMessage.textContent = countdownLabelForStep(stepIndex) ?? '';
        renderGateActions([]);

        const tick = (now: number): void => {
          if (!isActive()) {
            return;
          }

          if (now - stepStartedAt >= COUNTDOWN_STEP_MS) {
            stepIndex += 1;
            stepStartedAt = now;

            if (isCountdownComplete(stepIndex)) {
              resolve();
              return;
            }

            gateMessage.textContent = countdownLabelForStep(stepIndex) ?? '';
          }

          ctx.setAnimationFrame(requestAnimationFrame(tick));
        };

        ctx.setAnimationFrame(requestAnimationFrame(tick));
      });
    }

    function beginPlaying(): void {
      gate.remove();

      const mascot = document.createElement('div');
      mascot.className = 'mascot';
      const feedback = document.createElement('strong');
      const score = document.createElement('p');
      arena.append(mascot, feedback, score);

      started = true;
      playable.start();

      let last = performance.now();

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
    }

    async function runGate(): Promise<void> {
      gateMessage.textContent = 'Starting camera…';
      renderGateActions([]);

      try {
        await face.start();
      } catch {
        if (!isActive()) {
          return;
        }

        showGateError();
        return;
      }

      if (!isActive()) {
        return;
      }

      pip.prepend(face.getVideo());
      gateMessage.textContent = 'Looking for your face…';
      renderGateActions([]);

      const ready = await waitForFace();

      if (!isActive()) {
        return;
      }

      if (!ready) {
        await offerPlayAnyway();

        if (!isActive()) {
          return;
        }
      }

      await runCountdown();

      if (!isActive()) {
        return;
      }

      beginPlaying();
    }

    void runGate();
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
