import type { FaceTriggers } from '../../game/core/types';
import { drawFaceOverlay } from '../face-overlay';
import type { FaceInputService } from '../../game/input/face/FaceInputService';
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

    const renderActions = (showRetry: boolean): void => {
      actions.replaceChildren(
        ...(showRetry ? [button('Retry', retry)] : []),
        button('Back', options.onBack),
      );
    };

    renderActions(false);
    preview.dataset.status = 'Starting front camera...';
    trackerStatus.textContent = 'STARTING: Requesting front camera access...';
    readout.textContent = JSON.stringify({
      tracker: { status: 'starting' },
    }, null, 2);

    const isActive = (): boolean => ctx.app.contains(preview);

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
