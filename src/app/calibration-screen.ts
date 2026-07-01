import type { CalibrationProfile, NormalizedFaceInput } from '../game/core/types';
import { buildCalibration } from '../game/input/calibration/calibration';
import type { FaceInputService } from '../game/input/face/FaceInputService';
import { drawFaceOverlay, overlayPaths } from './face-overlay';

export interface CalibrationScreenOptions {
  mode: 'landing-test' | 'event';
  eventId?: string;
}

export interface CalibrationMount {
  face: FaceInputService;
  getCalibration: () => CalibrationProfile;
  setCalibration: (profile: CalibrationProfile) => void;
  onReset: () => void;
  setRafId: (id: number) => void;
  onPlay: () => void;
  onBack: () => void;
}

export function buildCalibrationHtml(options: CalibrationScreenOptions, eventTitle: string | undefined, buildCode: string): string {
  const title = eventTitle ? `${eventTitle} Calibration` : 'Camera Calibration';
  const helper = eventTitle
    ? 'Check the camera overlay, then save a neutral face sample before the event starts.'
    : 'Confirm the camera, facial feature overlay, movement triggers, and calibrated thresholds.';
  const legend = overlayPaths.map((p) => `<span><i style="background:${p.color}"></i>${p.name}</span>`).join('');
  return `<main class="screen calibration">
    <h2>${title}</h2><p>${helper}</p>
    <p class="build-code" aria-label="Calibration build code">Build ${buildCode}</p>
    <div id="preview" class="preview camera-test">
      <canvas id="face-overlay" aria-label="Detected facial feature overlay"></canvas>
    </div>
    <section class="legend">${legend}</section>
    <section class="panel tracker"><h3>Face tracker</h3><p id="tracker-status">Starting…</p></section>
    <section class="panel"><h3>Movement triggers</h3><pre id="trigger-console" class="debug console"></pre></section>
    <section class="panel"><h3>Live values + thresholds</h3><pre id="readout" class="debug"></pre></section>
    <div id="actions"></div>
  </main>`;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function logMessage(message: string): void {
  const box = document.querySelector<HTMLPreElement>('#trigger-console');
  if (!box) return;
  const lines = [`${new Date().toLocaleTimeString()} ${message}`, ...box.textContent!.split('\n').filter(Boolean)].slice(0, 24);
  box.textContent = lines.join('\n');
}

async function captureCalibration(face: FaceInputService): Promise<CalibrationProfile | null> {
  const samples: NormalizedFaceInput[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push(face.getInput());
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
  }
  const profile = buildCalibration(samples);
  if (!profile) logMessage('Could not see a face. Try again in bright light with your face centered.');
  return profile;
}

function startOverlay(face: FaceInputService, video: HTMLVideoElement, getCalibration: () => CalibrationProfile, setRafId: (id: number) => void): void {
  const preview = document.querySelector<HTMLDivElement>('#preview')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#face-overlay')!;
  const readout = document.querySelector<HTMLPreElement>('#readout')!;
  const trackerStatus = document.querySelector<HTMLParagraphElement>('#tracker-status')!;
  const ctx = canvas.getContext('2d')!;
  let lastStatus = '';
  let lastTriggers: Record<string, boolean> = {};

  const draw = () => {
    const calibration = getCalibration();
    const input = face.getInput();
    const frame = face.getDebugFrame();

    if (frame.status !== lastStatus) {
      logMessage(`Face tracker: ${frame.status} — ${frame.message}`);
      lastStatus = frame.status;
    }
    trackerStatus.textContent = `${frame.status.toUpperCase()}: ${frame.message}`;

    const w = preview.clientWidth;
    const h = preview.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.clearRect(0, 0, w, h);
    drawFaceOverlay(ctx, frame, input, video, w, h);

    const triggers: Record<string, boolean> = {
      'face detected': input.facePresent,
      'left blink': input.leftBlink,
      'right blink': input.rightBlink,
      'both eyes closed': input.bothEyesClosed,
      'eyebrows raised': input.eyebrowsRaised >= calibration.thresholds.eyebrowsRaised,
      'left eyebrow raised': input.leftEyebrowRaised >= calibration.thresholds.leftEyebrowRaised,
      'right eyebrow raised': input.rightEyebrowRaised >= calibration.thresholds.rightEyebrowRaised,
      'mouth open': input.mouthOpen >= calibration.thresholds.mouthOpen,
      'lips pursed': input.lipsPursed,
    };
    for (const [name, active] of Object.entries(triggers)) {
      if (active && !lastTriggers[name]) logMessage(`▶ ${name}`);
      if (!active && lastTriggers[name]) logMessage(`■ ${name} ended`);
    }
    lastTriggers = triggers;

    readout.textContent = JSON.stringify({
      tracker: { status: frame.status, landmarks: frame.landmarks.length },
      input,
      thresholds: calibration.thresholds,
      blendshapes: frame.blendshapes,
    }, null, 2);

    setRafId(requestAnimationFrame(draw));
  };

  setRafId(requestAnimationFrame(draw));
}

export async function mountCalibration(options: CalibrationScreenOptions, mount: CalibrationMount): Promise<void> {
  const { face, getCalibration, setCalibration, onReset, setRafId, onPlay, onBack } = mount;
  const isEvent = options.mode === 'event';

  document.querySelector('#actions')!.append(
    button(isEvent ? 'Save Calibration + Play' : 'Save Calibration', async () => {
      const profile = await captureCalibration(face);
      if (!profile) return;
      setCalibration(profile);
      if (isEvent) onPlay();
      else logMessage('Calibration saved. Try blinking, brows, and mouth movements to confirm the trigger console.');
    }),
    button(isEvent ? 'Practice Without Camera' : 'Reset to Defaults', () => {
      onReset();
      if (isEvent) onPlay();
      else logMessage('Default calibration restored.');
    }),
    button('Back', onBack),
  );

  const preview = document.querySelector<HTMLDivElement>('#preview')!;
  preview.dataset.status = 'Starting front camera…';
  const video = await face.start();
  preview.dataset.status = '';
  preview.prepend(video);

  logMessage('Calibration overlay ready. Move eyes, brows, mouth, and face.');
  startOverlay(face, video, getCalibration, setRafId);
}
