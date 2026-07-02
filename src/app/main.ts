import '../styles/main.css';
import { DEFAULT_CALIBRATION, type CalibrationProfile, type FaceOlympicsEvent } from '../game/core/types';
import { eventFactories, eventList } from '../game/events/registry';
import { FaceInputService } from '../game/input/face/FaceInputService';
import { medalLabel } from '../game/scoring/medals';
import { saveResult } from '../game/storage/scores';
import { buildCalibrationHtml, mountCalibration, type CalibrationScreenOptions } from './calibration-screen';
import { drawFaceOverlay } from './face-overlay';

const app = document.querySelector<HTMLDivElement>('#app')!;
const face = new FaceInputService();
let current: FaceOlympicsEvent | undefined;
let calibration: CalibrationProfile = DEFAULT_CALIBRATION;
let last = 0;
let activeAnimationFrame = 0;
const BUILD_CODE = 'CAL-COPY-09';

function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function render(html: string): void {
  cancelAnimationFrame(activeAnimationFrame);
  app.innerHTML = `${html}<aside class="build-stamp" aria-label="Current app build code">${BUILD_CODE}</aside>`;
}

function title(): void {
  render('<main class="screen hero"><p class="eyebrow">Camera stays on your device</p><h1>Face Olympics</h1><p>Goofy mini-events controlled by your face.</p><div id="actions"></div></main>');
  document.querySelector('#actions')!.append(button('Start Playing', menu), button('Camera Calibration', () => showCalibrationScreen({ mode: 'landing-test' })));
}

function menu(): void {
  render('<main class="screen simple"><h2>Pick an Event</h2><p>Choose one short face-controlled challenge.</p><div id="events" class="cards"></div><button id="back">Back</button></main>');
  const wrap = document.querySelector('#events')!;
  for (const event of eventList) {
    const card = button(`${event.title}\n${event.description}`, () => void startEvent(event.id));
    card.className = 'card';
    wrap.append(card);
  }
  document.querySelector('#back')!.addEventListener('click', title);
}

async function startEvent(eventId: string): Promise<void> {
  current = eventFactories[eventId]();
  void face.start(); // no-op if camera already running; game uses default input until ready
  play();
}

async function showCalibrationScreen(options: CalibrationScreenOptions): Promise<void> {
  current = options.eventId ? eventFactories[options.eventId]() : undefined;
  render(buildCalibrationHtml(options, current?.title, BUILD_CODE));
  await mountCalibration(options, {
    face,
    getCalibration: () => calibration,
    setCalibration: (profile) => { calibration = profile; },
    onReset: () => { calibration = DEFAULT_CALIBRATION; },
    setRafId: (id) => { activeAnimationFrame = id; },
    onPlay: play,
    onBack: options.mode === 'event' ? menu : title,
  });
}

function play(): void {
  if (!current) return;
  current.start(calibration);
  last = performance.now();
  render(`<main class="screen play"><h2>${current.title}</h2><section class="arena" id="arena"></section><details><summary>Debug controls</summary><div id="actions"></div><pre class="debug" id="debug"></pre></details><div class="pip" id="pip"><canvas id="pip-canvas"></canvas></div></main>`);
  document.querySelector<HTMLDivElement>('#pip')!.prepend(face.getVideo());
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
  const pipCanvas = document.querySelector<HTMLCanvasElement>('#pip-canvas');
  const pip = document.querySelector<HTMLDivElement>('#pip');
  if (pipCanvas && pip) {
    const w = pip.clientWidth, h = pip.clientHeight;
    if (pipCanvas.width !== w || pipCanvas.height !== h) { pipCanvas.width = w; pipCanvas.height = h; }
    const ctx = pipCanvas.getContext('2d');
    if (ctx) { ctx.clearRect(0, 0, w, h); drawFaceOverlay(ctx, face.getDebugFrame(), input, face.getVideo(), w, h); }
  }
  if (frame.finished) results();
  else activeAnimationFrame = requestAnimationFrame(loop);
}

function results(): void {
  if (!current) return;
  const result = current.finish();
  saveResult(result);
  render(`<main class="screen"><h2>${result.title} Results</h2><div class="medal">${medalLabel(result.medal)}</div><p>${result.summary}</p><p>Score: ${result.score}</p><div id="actions"></div></main>`);
  document.querySelector('#actions')!.append(button('Retry', () => void startEvent(result.eventId)), button('Event Select', menu));
  current.dispose();
  current = undefined;
}

title();
