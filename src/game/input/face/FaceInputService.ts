import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import {
  DEFAULT_EVENT_INPUT,
  DEFAULT_SIGNALS,
  DEFAULT_THRESHOLDS,
  DEFAULT_TRIGGERS,
  type EventInput,
  type FaceSignals,
  type TriggerThresholds,
} from '../../core/types';
import type { TuningState } from '../../storage/tuning';
import { AdaptiveRange } from './adaptive-range';
import { mapToSignals } from './signal-mapper';
import { TriggerEngine } from './trigger-engine';

export type FaceTrackerStatus = 'idle' | 'loading' | 'ready' | 'tracking' | 'no-face' | 'error';

export interface FaceDebugFrame {
  landmarks: readonly NormalizedLandmark[];
  blendshapes: Record<string, number>;
  updatedAt: number;
  status: FaceTrackerStatus;
  message: string;
}

const mediapipeAssetPath = (path: string): string => new URL(path, document.baseURI).toString();

// Pinned to a specific model version (not "latest") so behavior can't change out from under us,
// and so the fallback URL below stays valid indefinitely. Verified 200 OK as of writing.
const PINNED_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// requestVideoFrameCallback is not yet in lib.dom.d.ts
type VideoWithRVFC = HTMLVideoElement & {
  requestVideoFrameCallback: (cb: VideoFrameRequestCallback) => number;
};

// Adaptive normalization for a *signed* channel (gaze): track the adaptive range on the
// unsigned magnitude so a neutral reading always stays at 0 (cold start returns the raw
// magnitude unchanged per AdaptiveRange's guardrail, so sign*rawMagnitude === raw), while a
// warmed-up range rescales the extremes toward +/-1 without losing which direction is which.
function normalizeSigned(range: AdaptiveRange, raw: number, deltaMs: number): number {
  const sign = Math.sign(raw);
  const magnitude = Math.abs(raw);
  return sign * range.normalize(magnitude, deltaMs);
}

function rawErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Maps a start() failure (getUserMedia()/video.play() rejection) to a stable, friendly,
// user-facing message. Exported and pure (no `this`) so it's independently unit-testable
// without touching the DOM, and so every caller of start() gets identical copy instead of
// re-deriving its own — FaceInputService.debugFrame.message is the single source of truth,
// screens should read it rather than hardcoding their own error string.
export function cameraStartErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : undefined;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access was denied. Allow camera access for this site in your browser settings, then retry.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another application. Close other apps or tabs using it, then retry.';
    case 'OverconstrainedError':
      return 'No camera on this device meets the required settings.';
    case 'SecurityError':
      return "Camera access is blocked by this page's security settings.";
    default:
      return `Could not start the front camera (${rawErrorMessage(error)}).`;
  }
}

export class FaceInputService {
  private stream?: MediaStream;
  private video = document.createElement('video');
  private eventInput: EventInput = DEFAULT_EVENT_INPUT;
  private landmarker?: FaceLandmarker;
  private debugFrame: FaceDebugFrame = { landmarks: [], blendshapes: {}, updatedAt: 0, status: 'idle', message: 'Camera has not started.' };
  private isLoadingLandmarker = false;
  private lastTickAt = 0;
  private running = false;

  private thresholds: TriggerThresholds = { ...DEFAULT_THRESHOLDS };
  private triggerEngine = new TriggerEngine(this.thresholds);
  private readonly adaptiveBrowLeft = new AdaptiveRange();
  private readonly adaptiveBrowRight = new AdaptiveRange();
  private readonly adaptiveGazeX = new AdaptiveRange();
  private readonly adaptiveGazeY = new AdaptiveRange();

  async start(): Promise<HTMLVideoElement> {
    if (this.running) return this.video;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.video.srcObject = this.stream;
      this.video.muted = true;
      this.video.playsInline = true;
      await this.video.play();
    } catch (error) {
      this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'error', message: cameraStartErrorMessage(error) };
      throw error;
    }
    this.running = true;
    this.lastTickAt = performance.now();
    const signals: FaceSignals = { ...DEFAULT_SIGNALS, facePresent: true, confidence: 0.6 };
    this.eventInput = { signals, triggers: DEFAULT_TRIGGERS };
    if (this.landmarker) {
      // Landmarker already loaded from a previous start() — resume ticking directly instead
      // of re-running FilesetResolver/createFromOptions, so a title -> event -> title -> event
      // round trip doesn't re-pay MediaPipe's load cost.
      this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'ready', message: 'Face tracker ready. Looking for a face…' };
      this.scheduleTick();
    } else {
      this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'loading', message: 'Camera started. Loading MediaPipe face tracker…' };
      void this.loadLandmarker();
    }
    return this.video;
  }

  getVideo(): HTMLVideoElement { return this.video; }
  getEventInput(): EventInput { return this.eventInput; }
  getSignals(): FaceSignals { return this.eventInput.signals; }
  getDebugFrame(): FaceDebugFrame { return this.debugFrame; }
  getTuningSnapshot(): TuningState {
    return {
      thresholds: { ...this.thresholds },
      adaptive: {
        browRaiseLeft: this.adaptiveBrowLeft.snapshot(),
        browRaiseRight: this.adaptiveBrowRight.snapshot(),
        gazeX: this.adaptiveGazeX.snapshot(),
        gazeY: this.adaptiveGazeY.snapshot(),
      },
    };
  }

  seedTuning(state: TuningState): void {
    this.adaptiveBrowLeft.seed(state.adaptive.browRaiseLeft.low, state.adaptive.browRaiseLeft.high);
    this.adaptiveBrowRight.seed(state.adaptive.browRaiseRight.low, state.adaptive.browRaiseRight.high);
    this.adaptiveGazeX.seed(state.adaptive.gazeX.low, state.adaptive.gazeX.high);
    this.adaptiveGazeY.seed(state.adaptive.gazeY.low, state.adaptive.gazeY.high);
    this.applyThresholds(state.thresholds);
  }

  // Releases the camera (tracks + preview) and halts the tick loop, but deliberately keeps
  // the loaded FaceLandmarker around so a later start() can resume tracking immediately
  // instead of re-downloading/re-initializing MediaPipe.
  stop(): void {
    this.running = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.video.pause();
    this.video.srcObject = null;
    const signals: FaceSignals = { ...DEFAULT_SIGNALS, facePresent: false, confidence: 0 };
    this.eventInput = { signals, triggers: DEFAULT_TRIGGERS };
    this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'idle', message: 'Camera stopped.' };
  }

  // Manual overrides for QA without a live camera. Patches the current (already
  // adaptive-normalized) signals and re-runs the trigger engine so dependent triggers
  // (e.g. forcing eyeOpenLeft/Right down fires blinkLeft/Right + bothEyesClosed) react
  // immediately. A subsequent real tick() fully overwrites this on its next frame.
  setDebugInput(patch: Partial<FaceSignals>): void {
    const signals: FaceSignals = { ...this.eventInput.signals, ...patch };
    const triggers = this.triggerEngine.update(signals);
    this.eventInput = { signals, triggers };
  }

  private applyThresholds(thresholds: TriggerThresholds): void {
    this.thresholds = { ...thresholds };
    this.triggerEngine = new TriggerEngine(this.thresholds);
    this.eventInput = {
      signals: this.eventInput.signals,
      triggers: this.triggerEngine.update(this.eventInput.signals),
    };
  }

  // Schedules the next detection tick in sync with new video frames where supported,
  // falling back to RAF on browsers without requestVideoFrameCallback. No-ops once stop()
  // has cleared `running`, which is what actually halts the loop (a tick scheduled just
  // before stop() still checks `running` again when it fires — see tick()).
  private scheduleTick(): void {
    if (!this.running) return;
    if ('requestVideoFrameCallback' in this.video) {
      (this.video as VideoWithRVFC).requestVideoFrameCallback(() => this.tick());
    } else {
      requestAnimationFrame(() => this.tick());
    }
  }

  private async loadLandmarker(): Promise<void> {
    if (this.landmarker || this.isLoadingLandmarker) return;
    this.isLoadingLandmarker = true;
    this.debugFrame = { ...this.debugFrame, status: 'loading', message: 'Loading MediaPipe face tracker from local WASM assets…', updatedAt: Date.now() };
    try {
      this.landmarker = await this.createLandmarker(mediapipeAssetPath('mediapipe/tasks-vision/wasm/'), mediapipeAssetPath('mediapipe/models/face_landmarker.task'));
      this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'ready', message: 'Face tracker ready. Looking for a face…' };
      this.scheduleTick();
    } catch (localError) {
      this.debugFrame = { ...this.debugFrame, updatedAt: Date.now(), status: 'loading', message: `Local MediaPipe assets failed (${rawErrorMessage(localError)}). Trying CDN fallback…` };
      try {
        this.landmarker = await this.createLandmarker('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm', PINNED_MODEL_URL);
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'ready', message: 'Face tracker ready from CDN fallback. Looking for a face…' };
        this.scheduleTick();
      } catch (cdnError) {
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'error', message: `Face tracker failed. Local: ${rawErrorMessage(localError)}; CDN: ${rawErrorMessage(cdnError)}` };
      }
    } finally {
      this.isLoadingLandmarker = false;
    }
  }

  // wasmRoot: local self-hosted assets on the first attempt, jsdelivr CDN on fallback.
  // modelAssetPath: local cached copy (see scripts/copy-mediapipe-assets.mjs) on the first
  // attempt, the pinned CDN URL on fallback. Either half failing (e.g. the model wasn't
  // cached locally) throws and triggers the full CDN fallback below.
  private async createLandmarker(wasmRoot: string, modelAssetPath: string): Promise<FaceLandmarker> {
    const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
  }

  private tick(): void {
    if (!this.running) return;
    const now = performance.now();
    const deltaMs = this.lastTickAt ? now - this.lastTickAt : 0;
    this.lastTickAt = now;

    if (this.landmarker && this.video.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.video, now);
      const face = result.faceBlendshapes[0];
      const landmarks = result.faceLandmarks[0] ?? [];
      if (landmarks.length > 0) {
        const blendshapes = face ? Object.fromEntries(face.categories.map((item) => [item.categoryName, item.score])) : {};
        const rawSignals = mapToSignals(blendshapes, landmarks);
        // Brow: adaptive range over the raw 0-1 raise amount (neutral -> low, full raise -> high).
        // Gaze: adaptive range over magnitude only, sign preserved, so a neutral gaze stays at 0.
        const signals: FaceSignals = {
          ...rawSignals,
          browRaiseLeft: this.adaptiveBrowLeft.normalize(rawSignals.browRaiseLeft, deltaMs),
          browRaiseRight: this.adaptiveBrowRight.normalize(rawSignals.browRaiseRight, deltaMs),
          gazeX: normalizeSigned(this.adaptiveGazeX, rawSignals.gazeX, deltaMs),
          gazeY: normalizeSigned(this.adaptiveGazeY, rawSignals.gazeY, deltaMs),
        };
        const triggers = this.triggerEngine.update(signals);
        this.eventInput = { signals, triggers };
        this.debugFrame = { landmarks, blendshapes, updatedAt: Date.now(), status: 'tracking', message: face ? 'Tracking face landmarks and blendshapes.' : 'Tracking landmarks (blendshapes not yet available).' };
      } else {
        const signals: FaceSignals = { ...DEFAULT_SIGNALS, facePresent: false, confidence: 0 };
        const triggers = this.triggerEngine.update(signals);
        this.eventInput = { signals, triggers };
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'no-face', message: 'Face tracker running — no face detected.' };
      }
    }
    this.scheduleTick();
  }
}
