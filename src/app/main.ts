import '../styles/main.css';
import { DEFAULT_CALIBRATION, type CalibrationProfile, type FaceOlympicsEvent, type NormalizedFaceInput } from '../game/core/types';
import { eventFactories, eventList } from '../game/events/registry';
import { FaceInputService } from '../game/input/face/FaceInputService';
import { buildCalibration } from '../game/input/calibration/calibration';
import { medalLabel } from '../game/scoring/medals';
import { saveResult } from '../game/storage/scores';

const app = document.querySelector<HTMLDivElement>('#app')!;
const face = new FaceInputService();
let current: FaceOlympicsEvent | undefined;
let calibration: CalibrationProfile = DEFAULT_CALIBRATION;
let last = 0;
let activeAnimationFrame = 0;
let lastTriggerState: Record<string, boolean> = {};

const overlayPaths = [
  { name: 'Face outline', color: '#2dd4ff', points: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10], fallback: [[0.5, 0.13], [0.72, 0.2], [0.84, 0.42], [0.78, 0.7], [0.63, 0.86], [0.5, 0.91], [0.37, 0.86], [0.22, 0.7], [0.16, 0.42], [0.28, 0.2], [0.5, 0.13]] },
  { name: 'Left eye', color: '#7c3aed', points: [33, 160, 158, 133, 153, 144, 33], fallback: [[0.28, 0.42], [0.34, 0.38], [0.43, 0.39], [0.48, 0.43], [0.42, 0.47], [0.33, 0.47], [0.28, 0.42]] },
  { name: 'Right eye', color: '#8b5cf6', points: [263, 387, 385, 362, 380, 373, 263], fallback: [[0.72, 0.42], [0.66, 0.38], [0.57, 0.39], [0.52, 0.43], [0.58, 0.47], [0.67, 0.47], [0.72, 0.42]] },
  { name: 'Left pupil / iris', color: '#facc15', points: [468, 469, 470, 471, 472, 468], fallback: [[0.38, 0.43], [0.39, 0.42], [0.4, 0.43], [0.39, 0.44], [0.38, 0.43]] },
  { name: 'Right pupil / iris', color: '#fde047', points: [473, 474, 475, 476, 477, 473], fallback: [[0.62, 0.43], [0.61, 0.42], [0.6, 0.43], [0.61, 0.44], [0.62, 0.43]] },
  { name: 'Left eyebrow', color: '#22c55e', points: [70, 63, 105, 66, 107], fallback: [[0.28, 0.34], [0.35, 0.31], [0.44, 0.32], [0.49, 0.36]] },
  { name: 'Right eyebrow', color: '#16a34a', points: [336, 296, 334, 293, 300], fallback: [[0.72, 0.34], [0.65, 0.31], [0.56, 0.32], [0.51, 0.36]] },
  { name: 'Mouth', color: '#fb7185', points: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61], fallback: [[0.35, 0.68], [0.43, 0.64], [0.5, 0.66], [0.57, 0.64], [0.65, 0.68], [0.58, 0.74], [0.5, 0.76], [0.42, 0.74], [0.35, 0.68]] },
] as const;

type OverlayPoint = readonly [number, number];

function drawOverlayPath(context: CanvasRenderingContext2D, path: (typeof overlayPaths)[number], frame: ReturnType<FaceInputService['getDebugFrame']>, width: number, height: number): 'live' | 'guide' {
  const livePoints = path.points.every((index) => frame.landmarks[index])
    ? path.points.map((index): OverlayPoint => [1 - frame.landmarks[index].x, frame.landmarks[index].y])
    : undefined;
  const points = livePoints ?? path.fallback;
  context.beginPath();
  for (const [pointIndex, [xRatio, yRatio]] of points.entries()) {
    const x = xRatio * width;
    const y = yRatio * height;
    if (pointIndex === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = path.color;
  context.stroke();
  context.shadowBlur = 0;
  context.fillStyle = path.color;
  for (const [xRatio, yRatio] of points) {
    context.beginPath();
    context.arc(xRatio * width, yRatio * height, livePoints ? 3.5 : 4.5, 0, Math.PI * 2);
    context.fill();
  }
  context.shadowBlur = 5;
  return livePoints ? 'live' : 'guide';
}

interface CalibrationScreenOptions {
  mode: 'landing-test' | 'event';
  eventId?: string;
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function render(html: string): void {
  cancelAnimationFrame(activeAnimationFrame);
  app.innerHTML = html;
}

function title(): void {
  render('<main class="screen hero"><p class="eyebrow">Camera stays on your device</p><h1>Face Olympics</h1><p>Goofy mini-events controlled by your face.</p><div id="actions"></div></main>');
  document.querySelector('#actions')!.append(button('Start Playing', menu), button('Camera Calibration', () => showCalibrationScreen({ mode: 'landing-test' })));
}

function menu(): void {
  render('<main class="screen simple"><h2>Pick an Event</h2><p>Choose one short face-controlled challenge.</p><div id="events" class="cards"></div><button id="back">Back</button></main>');
  const wrap = document.querySelector('#events')!;
  for (const event of eventList) {
    const card = button(`${event.title}\n${event.description}`, () => showCalibrationScreen({ mode: 'event', eventId: event.id }));
    card.className = 'card';
    wrap.append(card);
  }
  document.querySelector('#back')!.addEventListener('click', title);
}

async function ensureCamera(): Promise<void> {
  const preview = document.querySelector<HTMLDivElement>('#preview');
  if (!preview) return;
  preview.dataset.status = 'Starting front camera…';
  const video = await face.start();
  preview.dataset.status = '';
  preview.prepend(video);
}

function renderCalibrationShell(options: CalibrationScreenOptions): void {
  const event = options.eventId ? eventList.find((item) => item.id === options.eventId) : undefined;
  const titleText = event ? `${event.title} Calibration` : 'Camera Calibration';
  const helper = event
    ? 'Check the shared camera overlay, then save a neutral face sample before the event starts.'
    : 'Use this landing-page screen to confirm the camera, facial feature map, movement triggers, and calibrated thresholds.';
  render(`<main class="screen calibration"><h2>${titleText}</h2><p>${helper}</p><div id="preview" class="preview camera-test"><canvas id="face-overlay" aria-label="Detected facial feature overlay"></canvas></div><section class="legend">${overlayPaths.map((path) => `<span><i style="background:${path.color}"></i>${path.name}</span>`).join('')}</section><section class="panel"><h3>Movement triggers</h3><pre id="trigger-console" class="debug console"></pre></section><section class="panel"><h3>Live values + thresholds</h3><pre id="readout" class="debug"></pre></section><div id="actions"></div></main>`);
}

async function showCalibrationScreen(options: CalibrationScreenOptions): Promise<void> {
  if (options.eventId) current = eventFactories[options.eventId]();
  else current = undefined;

  renderCalibrationShell(options);
  document.querySelector('#actions')!.append(
    button(options.mode === 'event' ? 'Save Calibration + Play' : 'Save Calibration', async () => {
      const built = await captureCalibration();
      if (!built) return;
      calibration = built;
      if (options.mode === 'event') play();
      else writeCalibrationMessage('Calibration saved. Try blinking, brows, and mouth movements to confirm the trigger console.');
    }),
    button(options.mode === 'event' ? 'Practice Without Camera' : 'Reset to Defaults', () => {
      calibration = DEFAULT_CALIBRATION;
      if (options.mode === 'event') play();
      else writeCalibrationMessage('Default calibration restored.');
    }),
    button('Back', options.mode === 'event' ? menu : title),
  );
  await ensureCamera();
  installSharedCalibrationOverlay();
}

async function captureCalibration(): Promise<CalibrationProfile | null> {
  const samples: NormalizedFaceInput[] = [];
  for (let i = 0; i < 12; i++) {
    samples.push(face.getInput());
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  const built = buildCalibration(samples);
  if (!built) writeCalibrationMessage('Could not see a face yet. Try again in bright light and keep your face in the oval.');
  return built;
}

function writeCalibrationMessage(message: string): void {
  const consoleBox = document.querySelector<HTMLPreElement>('#trigger-console');
  if (!consoleBox) return;
  const lines = [`${new Date().toLocaleTimeString()} ${message}`, ...consoleBox.textContent.split('\n').filter(Boolean)].slice(0, 24);
  consoleBox.textContent = lines.join('\n');
}

function installSharedCalibrationOverlay(): void {
  const preview = document.querySelector<HTMLDivElement>('#preview');
  const canvas = document.querySelector<HTMLCanvasElement>('#face-overlay');
  const readout = document.querySelector<HTMLPreElement>('#readout');
  if (!preview || !canvas || !readout) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  lastTriggerState = {};
  writeCalibrationMessage('Shared calibration overlay ready. Move eyes, brows, mouth, and face.');
  const draw = () => {
    const input = face.getInput();
    const frame = face.getDebugFrame();
    const width = preview.clientWidth;
    const height = preview.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    context.lineWidth = 5;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.shadowColor = '#001828';
    context.shadowBlur = 5;
    const overlayModes = overlayPaths.map((path) => ({ name: path.name, color: path.color, mode: drawOverlayPath(context, path, frame, width, height) }));
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
      if (active && !lastTriggerState[name]) writeCalibrationMessage(`▶ ${name}`);
      if (!active && lastTriggerState[name]) writeCalibrationMessage(`■ ${name} ended`);
    }
    lastTriggerState = triggers;
    readout.textContent = JSON.stringify({ input, thresholds: calibration.thresholds, overlays: overlayModes, blendshapes: frame.blendshapes }, null, 2);
    activeAnimationFrame = requestAnimationFrame(draw);
  };
  activeAnimationFrame = requestAnimationFrame(draw);
}

function play(): void {
  if (!current) return;
  current.start(calibration);
  last = performance.now();
  render(`<main class="screen play"><h2>${current.title}</h2><section class="arena" id="arena"></section><details><summary>Debug controls</summary><div id="actions"></div><pre class="debug" id="debug"></pre></details></main>`);
  document.querySelector('#actions')!.append(
    button('Blink', () => face.setDebugInput({ bothEyesClosed: true, leftBlink: true, rightBlink: true })),
    button('Brows Up', () => face.setDebugInput({ eyebrowsRaised: 0.9, leftEyebrowRaised: 0.9, rightEyebrowRaised: 0.9, bothEyesClosed: false })),
    button('Mouth Open', () => face.setDebugInput({ mouthOpen: 0.9, lipsPursed: false })),
    button('Release', () => face.setDebugInput({ mouthOpen: 0, lipsPursed: true })),
    button('Pause / Exit', menu),
  );
  activeAnimationFrame = requestAnimationFrame(loop);
}

function loop(now: number): void {
  if (!current) return;
  const delta = now - last;
  last = now;
  const input = face.getInput();
  const frame = current.update(delta, input);
  const mascot = current.id === 'dragon-blast' ? '🐉' : current.id === 'face-weightlifting' ? '🏋️' : '👀';
  document.querySelector('#arena')!.innerHTML = `<div class="mascot">${mascot}</div><strong>${frame.feedback}</strong><p>Score: ${frame.score}</p>`;
  document.querySelector('#debug')!.textContent = JSON.stringify({ input, thresholds: calibration.thresholds, state: frame.state }, null, 2);
  if (frame.finished) results();
  else activeAnimationFrame = requestAnimationFrame(loop);
}

function results(): void {
  if (!current) return;
  const result = current.finish();
  saveResult(result);
  render(`<main class="screen"><h2>${result.title} Results</h2><div class="medal">${medalLabel(result.medal)}</div><p>${result.summary}</p><p>Score: ${result.score}</p><div id="actions"></div></main>`);
  document.querySelector('#actions')!.append(button('Retry', () => showCalibrationScreen({ mode: 'event', eventId: result.eventId })), button('Event Select', menu));
  current.dispose();
  current = undefined;
}

title();
