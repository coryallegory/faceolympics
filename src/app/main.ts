import '../styles/main.css';
import { DEFAULT_CALIBRATION, type CalibrationProfile, type FaceOlympicsEvent, type NormalizedFaceInput } from '../game/core/types';
import { eventFactories, eventList } from '../game/events/registry';
import { FaceInputService } from '../game/input/face/FaceInputService';
import { buildCalibration } from '../game/input/calibration/calibration';
import { medalLabel } from '../game/scoring/medals';
import { loadResults, saveResult } from '../game/storage/scores';

const app = document.querySelector<HTMLDivElement>('#app')!;
const face = new FaceInputService();
let current: FaceOlympicsEvent | undefined;
let calibration: CalibrationProfile = DEFAULT_CALIBRATION;
let last = 0;
let calibrationTestFrame = 0;
let lastTriggerState: Record<string, boolean> = {};

const overlayPaths = [
  { name: 'Face outline', color: '#2dd4ff', points: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10] },
  { name: 'Left eye', color: '#7c3aed', points: [33, 160, 158, 133, 153, 144, 33] },
  { name: 'Right eye', color: '#8b5cf6', points: [263, 387, 385, 362, 380, 373, 263] },
  { name: 'Left pupil / iris', color: '#facc15', points: [468, 469, 470, 471, 472, 468] },
  { name: 'Right pupil / iris', color: '#fde047', points: [473, 474, 475, 476, 477, 473] },
  { name: 'Eyebrows', color: '#22c55e', points: [70, 63, 105, 66, 107, 336, 296, 334, 293, 300] },
  { name: 'Mouth', color: '#fb7185', points: [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146, 61] },
] as const;

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function render(html: string): void {
  app.innerHTML = html;
}

function title(): void {
  render('<main class="screen hero"><p class="eyebrow">Camera stays on your device</p><h1>Face Olympics</h1><p>Goofy mini-events controlled by your face.</p><div id="actions"></div></main>');
  document.querySelector('#actions')!.append(button('Start Playing', menu), button('Debug / Camera Test', debug));
}

function menu(): void {
  render('<main class="screen"><h2>Main Menu</h2><p>Pick one silly event. Cup mode and unlocks are intentionally not in this POC.</p><div id="events" class="cards"></div><button id="back">Back</button></main>');
  const wrap = document.querySelector('#events')!;
  for (const event of eventList) {
    const card = button(`${event.title} — ${event.description}`, () => calibrate(event.id));
    card.className = 'card';
    wrap.append(card);
  }
  document.querySelector('#back')!.addEventListener('click', title);
}

async function ensureCamera(): Promise<void> {
  const preview = document.querySelector<HTMLDivElement>('#preview');
  if (!preview) return;
  preview.textContent = 'Starting front camera…';
  const video = await face.start();
  preview.textContent = '';
  preview.prepend(video);
}

function installCalibrationTestPage(): void {
  const preview = document.querySelector<HTMLDivElement>('#preview');
  const canvas = document.querySelector<HTMLCanvasElement>('#face-overlay');
  const readout = document.querySelector<HTMLPreElement>('#readout');
  const consoleBox = document.querySelector<HTMLPreElement>('#trigger-console');
  if (!preview || !canvas || !readout || !consoleBox) return;
  const context = canvas.getContext('2d');
  if (!context) return;
  const log = (message: string) => {
    const stamped = `${new Date().toLocaleTimeString()} ${message}`;
    const lines = [stamped, ...consoleBox.textContent.split('\n').filter(Boolean)].slice(0, 24);
    consoleBox.textContent = lines.join('\n');
  };
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
    context.lineWidth = 3;
    context.lineJoin = 'round';
    for (const path of overlayPaths) {
      const available = path.points.every((index) => frame.landmarks[index]);
      if (!available) continue;
      context.beginPath();
      for (const [pointIndex, landmarkIndex] of path.points.entries()) {
        const landmark = frame.landmarks[landmarkIndex];
        const x = landmark.x * width;
        const y = landmark.y * height;
        if (pointIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = path.color;
      context.stroke();
    }
    const triggers: Record<string, boolean> = {
      'face detected': input.facePresent,
      'left blink': input.leftBlink,
      'right blink': input.rightBlink,
      'both eyes closed': input.bothEyesClosed,
      'eyebrows raised': input.eyebrowsRaised >= calibration.thresholds.eyebrowsRaised,
      'mouth open': input.mouthOpen >= calibration.thresholds.mouthOpen,
      'lips pursed': input.lipsPursed,
    };
    for (const [name, active] of Object.entries(triggers)) {
      if (active && !lastTriggerState[name]) log(`▶ ${name}`);
      if (!active && lastTriggerState[name]) log(`■ ${name} ended`);
    }
    lastTriggerState = triggers;
    readout.textContent = JSON.stringify({ input, thresholds: calibration.thresholds, overlays: overlayPaths.map(({ name, color }) => ({ name, color })), blendshapes: frame.blendshapes }, null, 2);
    calibrationTestFrame = requestAnimationFrame(draw);
  };
  cancelAnimationFrame(calibrationTestFrame);
  lastTriggerState = {};
  log('Calibration test overlay ready. Move your eyes, brows, mouth, and face.');
  calibrationTestFrame = requestAnimationFrame(draw);
}

async function calibrate(id: string): Promise<void> {
  current = eventFactories[id]();
  render(`<main class="screen"><h2>Calibration + Face Test: ${current.title}</h2><p>Look at the camera with a comfy neutral face. Colored wire overlays show detected face parts in real time, and movement triggers appear below.</p><div id="preview" class="preview camera-test"><canvas id="face-overlay" aria-label="Detected facial feature overlay"></canvas></div><section class="legend">${overlayPaths.map((path) => `<span><i style="background:${path.color}"></i>${path.name}</span>`).join('')}</section><h3>Movement trigger console</h3><pre id="trigger-console" class="debug console"></pre><h3>Detection values</h3><pre id="readout" class="debug"></pre><div id="actions"></div></main>`);
  document.querySelector('#actions')!.append(
    button('Use Camera Calibration', async () => {
      const samples: NormalizedFaceInput[] = [];
      for (let i = 0; i < 12; i++) {
        samples.push(face.getInput());
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      const built = buildCalibration(samples);
      if (!built) {
        document.querySelector('#readout')!.textContent = 'Could not see a face yet. Try again in bright light.';
        return;
      }
      calibration = built;
      play();
    }),
    button('Practice Without Camera', () => {
      calibration = DEFAULT_CALIBRATION;
      play();
    }),
    button('Back', menu),
  );
  await ensureCamera();
  installCalibrationTestPage();
}

function play(): void {
  if (!current) return;
  current.start(calibration);
  last = performance.now();
  render(`<main class="screen play"><h2>${current.title}</h2><section class="arena" id="arena"></section><pre class="debug" id="debug"></pre><div id="actions"></div></main>`);
  document.querySelector('#actions')!.append(
    button('Blink', () => face.setDebugInput({ bothEyesClosed: true, leftBlink: true, rightBlink: true })),
    button('Brows Up', () => face.setDebugInput({ eyebrowsRaised: 0.9, bothEyesClosed: false })),
    button('Mouth Open', () => face.setDebugInput({ mouthOpen: 0.9, lipsPursed: false })),
    button('Release', () => face.setDebugInput({ mouthOpen: 0, lipsPursed: true })),
    button('Pause / Exit', menu),
  );
  requestAnimationFrame(loop);
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
  else requestAnimationFrame(loop);
}

function results(): void {
  if (!current) return;
  const result = current.finish();
  saveResult(result);
  render(`<main class="screen"><h2>${result.title} Results</h2><div class="medal">${medalLabel(result.medal)}</div><p>${result.summary}</p><p>Score: ${result.score}</p><div id="actions"></div></main>`);
  document.querySelector('#actions')!.append(button('Retry', () => calibrate(result.eventId)), button('Event Select', menu));
  current.dispose();
  current = undefined;
}

function debug(): void {
  render('<main class="screen"><h2>Settings / Debug</h2><div id="preview" class="preview"></div><pre id="readout" class="debug"></pre><div id="actions"></div></main>');
  document.querySelector('#actions')!.append(button('Back', title));
  ensureCamera();
  setInterval(() => {
    const readout = document.querySelector('#readout');
    if (readout) readout.textContent = JSON.stringify({ input: face.getInput(), calibration, scores: loadResults() }, null, 2);
  }, 250);
}

title();
