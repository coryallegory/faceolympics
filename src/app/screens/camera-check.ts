import type { FaceTriggers } from '../../game/core/types';
import { drawFaceOverlay } from '../face-overlay';
import type { FaceInputService } from '../../game/input/face/FaceInputService';
import type { TuningState } from '../../game/storage/tuning';
import {
  buildDiagnosticHtml,
  logDiagnosticMessage,
  startDiagnosticOverlay,
} from '../calibration-screen';
import type { Screen } from '../navigation';
import { button } from '../ui';

export interface CameraCheckScreenOptions {
  face: FaceInputService;
  onBack: () => void;
}

// -- Brow quick-tune -------------------------------------------------------
//
// Pure sampling/threshold math, kept separate from the DOM wiring below so it can be
// unit-tested without a live camera. See B3 in docs/agent-task-backlog.md.

export const BROW_QUICK_TUNE_MIN_SPAN = 0.15;
export const BROW_TUNE_RESTING_DURATION_MS = 1000;
export const BROW_TUNE_RAISE_DURATION_MS = 2000;
export const BROW_TUNE_SAMPLE_INTERVAL_MS = 100;

export interface BrowQuickTuneSamples {
  restingLeft: readonly number[];
  restingRight: readonly number[];
  raisedLeft: readonly number[];
  raisedRight: readonly number[];
}

export interface BrowQuickTuneChannel {
  low: number;
  high: number;
}

export type BrowQuickTuneResult =
  | { ok: true; left: BrowQuickTuneChannel; right: BrowQuickTuneChannel }
  | { ok: false; reason: string };

// Linear-interpolation percentile (same convention as numpy's default). Sorts a copy so the
// caller's sample array is never mutated. Empty input returns 0 rather than NaN so downstream
// span math (`high - low`) stays a finite number and fails the guardrail cleanly.
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) {
    return 0;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

// `low` = p50 of the pre-prompt resting sample (a relaxed/neutral face), `high` = p90 of the
// sample taken while the subject holds a full brow raise. Each brow channel is validated
// independently: an asymmetric raise where only one side clears the guardrail should not seed
// a false "high" for the side that never moved.
export function evaluateBrowQuickTune(
  samples: BrowQuickTuneSamples,
  minSpan: number = BROW_QUICK_TUNE_MIN_SPAN,
): BrowQuickTuneResult {
  const left: BrowQuickTuneChannel = {
    low: percentile(samples.restingLeft, 50),
    high: percentile(samples.raisedLeft, 90),
  };
  const right: BrowQuickTuneChannel = {
    low: percentile(samples.restingRight, 50),
    high: percentile(samples.raisedRight, 90),
  };

  if (left.high - left.low < minSpan || right.high - right.low < minSpan) {
    return { ok: false, reason: "couldn't detect a clear raise — try again" };
  }

  return { ok: true, left, right };
}

// Merges a fresh brow-channel seed into the existing tuning snapshot, leaving thresholds and
// the gaze channels untouched.
export function mergeBrowQuickTuneResult(
  tuning: TuningState,
  result: { left: BrowQuickTuneChannel; right: BrowQuickTuneChannel },
): TuningState {
  return {
    thresholds: tuning.thresholds,
    adaptive: {
      ...tuning.adaptive,
      browRaiseLeft: result.left,
      browRaiseRight: result.right,
    },
  };
}

// Calls `onSample` roughly every `intervalMs` for `durationMs`, then resolves. Stops early
// (without calling onSample again) if `isActive` goes false, so navigating away mid-tune
// doesn't keep sampling a torn-down screen. Time-driven via `setTimeout`/`Date.now()` rather
// than requestAnimationFrame so it is deterministic under vitest's fake timers.
function sampleOverWindow(
  durationMs: number,
  intervalMs: number,
  isActive: () => boolean,
  onSample: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now();

    const tick = (): void => {
      if (!isActive()) {
        resolve();
        return;
      }

      onSample();

      if (Date.now() - start >= durationMs) {
        resolve();
        return;
      }

      setTimeout(tick, intervalMs);
    };

    tick();
  });
}

const TRIGGER_KEYS: readonly (keyof FaceTriggers)[] = [
  'blinkLeft',
  'blinkRight',
  'bothEyesClosed',
  'mouthOpen',
  'lipsPursed',
  'browsRaised',
  'browLeftRaised',
  'browRightRaised',
  'lookLeft',
  'lookRight',
  'lookUp',
  'lookDown',
];

function ensureBlendshapeDetails(root: ParentNode): {
  details: HTMLDetailsElement;
  readout: HTMLPreElement;
} | null {
  const existingDetails = root.querySelector<HTMLDetailsElement>('#blendshape-details');
  const existingReadout = root.querySelector<HTMLPreElement>('#blendshape-readout');

  if (existingDetails && existingReadout) {
    return { details: existingDetails, readout: existingReadout };
  }

  const readout = root.querySelector<HTMLPreElement>('#readout');
  const panel = readout?.parentElement;

  if (!readout || !panel) {
    return null;
  }

  const details = document.createElement('details');
  details.id = 'blendshape-details';

  const summary = document.createElement('summary');
  summary.textContent = 'Blendshapes';

  const blendshapeReadout = document.createElement('pre');
  blendshapeReadout.id = 'blendshape-readout';
  blendshapeReadout.className = 'debug';
  blendshapeReadout.textContent = '{}';

  details.append(summary, blendshapeReadout);
  panel.append(details);

  return {
    details,
    readout: blendshapeReadout,
  };
}

function supportsNewCameraCheckModel(face: FaceInputService): boolean {
  const candidate = face as Partial<FaceInputService>;
  return (
    typeof candidate.getEventInput === 'function'
    && typeof candidate.getTuningSnapshot === 'function'
  );
}

function startCameraCheckOverlay(
  root: ParentNode,
  face: FaceInputService,
  video: HTMLVideoElement,
  setAnimationFrame: (id: number) => void,
): void {
  const blendshapeDetails = ensureBlendshapeDetails(root);

  if (!blendshapeDetails) {
    return;
  }

  const draw = () => {
    const preview = root.querySelector<HTMLDivElement>('#preview');
    const canvas = root.querySelector<HTMLCanvasElement>('#face-overlay');
    const readout = root.querySelector<HTMLPreElement>('#readout');
    const trackerStatus = root.querySelector<HTMLParagraphElement>('#tracker-status');
    const triggerConsole = root.querySelector<HTMLPreElement>('#trigger-console');

    if (!preview || !canvas || !readout || !trackerStatus || !triggerConsole) {
      return;
    }

    const overlay = canvas.getContext('2d');

    if (!overlay) {
      return;
    }

    const eventInput = face.getEventInput();
    const tuning = face.getTuningSnapshot();
    const frame = face.getDebugFrame();

    trackerStatus.textContent = `${frame.status.toUpperCase()}: ${frame.message}`;

    const width = preview.clientWidth;
    const height = preview.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    overlay.clearRect(0, 0, width, height);
    drawFaceOverlay(
      overlay,
      frame,
      eventInput.triggers,
      video,
      width,
      height,
    );

    triggerConsole.textContent = JSON.stringify(
      Object.fromEntries(
        TRIGGER_KEYS.map((key) => [key, eventInput.triggers[key]]),
      ),
      null,
      2,
    );

    readout.textContent = JSON.stringify(
      {
        signals: eventInput.signals,
        thresholds: tuning.thresholds,
        adaptive: tuning.adaptive,
      },
      null,
      2,
    );

    if (blendshapeDetails.details.open) {
      blendshapeDetails.readout.textContent = JSON.stringify(frame.blendshapes, null, 2);
    }

    setAnimationFrame(requestAnimationFrame(draw));
  };

  setAnimationFrame(requestAnimationFrame(draw));
}

export function showCameraCheckScreen(options: CameraCheckScreenOptions): Screen {
  return async (ctx) => {
    ctx.render(buildDiagnosticHtml({
      title: 'Camera Check',
      helper: 'Confirm the mirrored preview, face overlay, tracker status, and live movement triggers.',
      buildCode: ctx.buildCode,
    }));

    const actions = ctx.app.querySelector<HTMLDivElement>('#actions');
    const preview = ctx.app.querySelector<HTMLDivElement>('#preview');
    const trackerStatus = ctx.app.querySelector<HTMLParagraphElement>('#tracker-status');
    const readout = ctx.app.querySelector<HTMLPreElement>('#readout');

    if (!actions || !preview || !trackerStatus || !readout) {
      return;
    }

    const retry = (): void => {
      ctx.goTo(showCameraCheckScreen(options));
    };

    const isActive = (): boolean => ctx.app.contains(preview);

    let isTuning = false;
    let showTuneButton = false;

    const renderActions = (showRetry: boolean): void => {
      const tuneButton = showTuneButton
        ? [button(
          isTuning ? 'Tuning eyebrows…' : 'Tune eyebrows (2 s)',
          () => {
            void runBrowQuickTune();
          },
        )]
        : [];

      actions.replaceChildren(
        ...(showRetry ? [button('Retry', retry)] : []),
        ...tuneButton,
        button('Back', options.onBack),
      );
    };

    const runBrowQuickTune = async (): Promise<void> => {
      if (isTuning || !isActive()) {
        return;
      }

      isTuning = true;
      renderActions(false);

      const restingLeft: number[] = [];
      const restingRight: number[] = [];
      const raisedLeft: number[] = [];
      const raisedRight: number[] = [];

      const sampleInto = (left: number[], right: number[]): void => {
        const { signals } = options.face.getEventInput();
        left.push(signals.browRaiseLeft);
        right.push(signals.browRaiseRight);
      };

      logDiagnosticMessage(ctx.app, 'Brow quick-tune: hold a relaxed, resting expression…');
      await sampleOverWindow(
        BROW_TUNE_RESTING_DURATION_MS,
        BROW_TUNE_SAMPLE_INTERVAL_MS,
        isActive,
        () => sampleInto(restingLeft, restingRight),
      );

      if (!isActive()) {
        return;
      }

      logDiagnosticMessage(ctx.app, 'Brow quick-tune: raise your eyebrows as high as you can!');
      await sampleOverWindow(
        BROW_TUNE_RAISE_DURATION_MS,
        BROW_TUNE_SAMPLE_INTERVAL_MS,
        isActive,
        () => sampleInto(raisedLeft, raisedRight),
      );

      if (!isActive()) {
        return;
      }

      const result = evaluateBrowQuickTune({ restingLeft, restingRight, raisedLeft, raisedRight });

      if (!result.ok) {
        logDiagnosticMessage(ctx.app, `Brow quick-tune: ${result.reason}`);
        isTuning = false;
        renderActions(false);
        return;
      }

      options.face.seedTuning(mergeBrowQuickTuneResult(options.face.getTuningSnapshot(), result));

      logDiagnosticMessage(
        ctx.app,
        'Brow quick-tune complete: seeded left '
          + `[low=${result.left.low.toFixed(2)}, high=${result.left.high.toFixed(2)}], right `
          + `[low=${result.right.low.toFixed(2)}, high=${result.right.high.toFixed(2)}]`,
      );

      isTuning = false;
      renderActions(false);
    };

    renderActions(false);
    preview.dataset.status = 'Starting front camera...';
    trackerStatus.textContent = 'STARTING: Requesting front camera access...';
    readout.textContent = JSON.stringify({
      tracker: { status: 'starting' },
    }, null, 2);

    try {
      const video = await options.face.start();

      if (!isActive()) {
        return;
      }

      preview.dataset.status = '';
      preview.prepend(video);
      logDiagnosticMessage(ctx.app, 'Camera Check ready. Move eyes, brows, mouth, and face.');
      if (supportsNewCameraCheckModel(options.face)) {
        startCameraCheckOverlay(ctx.app, options.face, video, ctx.setAnimationFrame);
        showTuneButton = true;
        renderActions(false);
      } else {
        startDiagnosticOverlay(
          ctx.app,
          options.face,
          video,
          ctx.setAnimationFrame,
        );
      }
    } catch (error) {
      if (!isActive()) {
        return;
      }

      // FaceInputService.start() sets debugFrame.status = 'error' with a friendly message
      // before rejecting, so read the shared message from the service instead of maintaining
      // a second, locally hardcoded copy here.
      const message = options.face.getDebugFrame().message;
      const details = error instanceof Error ? error.message : String(error);

      preview.dataset.status = 'Camera unavailable';
      trackerStatus.textContent = `ERROR: ${message}`;
      readout.textContent = JSON.stringify({
        error: message,
        details,
      }, null, 2);
      logDiagnosticMessage(ctx.app, `${message}${details ? ` (${details})` : ''}`);
      renderActions(true);
    }
  };
}
