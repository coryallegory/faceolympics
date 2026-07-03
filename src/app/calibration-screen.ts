import type { FaceTriggers } from '../game/core/types';
import type { FaceInputService } from '../game/input/face/FaceInputService';
import { drawFaceOverlay, overlayPaths } from './face-overlay';
import { button } from './ui';

export interface CalibrationScreenOptions {
  mode: 'landing-test' | 'event';
  eventId?: string;
}

export interface CalibrationMount {
  face: FaceInputService;
  setRafId: (id: number) => void;
  onPlay: () => void;
  onBack: () => void;
}

export interface DiagnosticHtmlOptions {
  title: string;
  helper: string;
  buildCode: string;
}

export function buildDiagnosticHtml(options: DiagnosticHtmlOptions): string {
  const legend = overlayPaths
    .map((path) => `<span><i style="background:${path.color}"></i>${path.name}</span>`)
    .join('');

  return `<main class="screen calibration">
    <h2>${options.title}</h2><p>${options.helper}</p>
    <p class="build-code" aria-label="Calibration build code">Build ${options.buildCode}</p>
    <div id="preview" class="preview camera-test">
      <canvas id="face-overlay" aria-label="Detected facial feature overlay"></canvas>
    </div>
    <section class="legend">${legend}</section>
    <section class="panel tracker"><h3>Face tracker</h3><p id="tracker-status">Starting...</p></section>
    <section class="panel"><h3>Movement triggers</h3><pre id="trigger-console" class="debug console"></pre></section>
    <section class="panel"><h3>Live values + thresholds</h3><pre id="readout" class="debug"></pre></section>
    <div id="actions"></div>
  </main>`;
}

export function buildCalibrationHtml(
  options: CalibrationScreenOptions,
  eventTitle: string | undefined,
  buildCode: string,
): string {
  const title = eventTitle ? `${eventTitle} Calibration` : 'Camera Calibration';
  const helper = eventTitle
    ? 'Check the camera overlay and movement triggers, then continue to the event.'
    : 'Confirm the camera, facial feature overlay, and live movement triggers.';

  return buildDiagnosticHtml({ title, helper, buildCode });
}

export function logDiagnosticMessage(root: ParentNode, message: string): void {
  const box = root.querySelector<HTMLPreElement>('#trigger-console');

  if (!box) {
    return;
  }

  const lines = [
    `${new Date().toLocaleTimeString()} ${message}`,
    ...box.textContent!.split('\n').filter(Boolean),
  ].slice(0, 24);
  box.textContent = lines.join('\n');
}

export function startDiagnosticOverlay(
  root: ParentNode,
  face: FaceInputService,
  video: HTMLVideoElement,
  setRafId: (id: number) => void,
): void {
  let lastStatus = '';
  let lastTriggers: FaceTriggers | null = null;

  const draw = () => {
    const preview = root.querySelector<HTMLDivElement>('#preview');
    const canvas = root.querySelector<HTMLCanvasElement>('#face-overlay');
    const readout = root.querySelector<HTMLPreElement>('#readout');
    const trackerStatus = root.querySelector<HTMLParagraphElement>('#tracker-status');

    if (!preview || !canvas || !readout || !trackerStatus) {
      return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      return;
    }

    const { signals, triggers } = face.getEventInput();
    const frame = face.getDebugFrame();

    if (frame.status !== lastStatus) {
      logDiagnosticMessage(root, `Face tracker: ${frame.status} - ${frame.message}`);
      lastStatus = frame.status;
    }

    trackerStatus.textContent = `${frame.status.toUpperCase()}: ${frame.message}`;

    const width = preview.clientWidth;
    const height = preview.clientHeight;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    drawFaceOverlay(ctx, frame, triggers, video, width, height);

    for (const key of Object.keys(triggers) as (keyof FaceTriggers)[]) {
      const active = triggers[key];
      const wasActive = lastTriggers ? lastTriggers[key] : false;

      if (active && !wasActive) {
        logDiagnosticMessage(root, `> ${key}`);
      }

      if (!active && wasActive) {
        logDiagnosticMessage(root, `- ${key} ended`);
      }
    }

    lastTriggers = triggers;
    readout.textContent = JSON.stringify({
      tracker: { status: frame.status, landmarks: frame.landmarks.length },
      signals,
      triggers,
      blendshapes: frame.blendshapes,
    }, null, 2);

    setRafId(requestAnimationFrame(draw));
  };

  setRafId(requestAnimationFrame(draw));
}

export async function mountCalibration(
  options: CalibrationScreenOptions,
  mount: CalibrationMount,
): Promise<void> {
  const { face, setRafId, onPlay, onBack } = mount;
  const isEvent = options.mode === 'event';

  document.querySelector('#actions')!.append(
    button(isEvent ? 'Play' : 'Continue', () => {
      if (isEvent) {
        onPlay();
      } else {
        logDiagnosticMessage(
          document,
          'Try blinking, brows, and mouth movements to confirm the trigger console.',
        );
      }
    }),
    button('Back', onBack),
  );

  const preview = document.querySelector<HTMLDivElement>('#preview')!;
  preview.dataset.status = 'Starting front camera...';

  const video = await face.start();

  preview.dataset.status = '';
  preview.prepend(video);

  logDiagnosticMessage(document, 'Diagnostic overlay ready. Move eyes, brows, mouth, and face.');
  startDiagnosticOverlay(document, face, video, setRafId);
}
