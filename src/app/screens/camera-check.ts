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
      startDiagnosticOverlay(
        ctx.app,
        options.face,
        video,
        ctx.setAnimationFrame,
      );
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
