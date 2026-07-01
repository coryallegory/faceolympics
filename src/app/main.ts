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
  preview.replaceChildren(video);
}

async function calibrate(id: string): Promise<void> {
  current = eventFactories[id]();
  render(`<main class="screen"><h2>Calibration: ${current.title}</h2><p>Look at the camera with a comfy neutral face. Then try the face move for this event.</p><div id="preview" class="preview"></div><div id="readout"></div><div id="actions"></div></main>`);
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
