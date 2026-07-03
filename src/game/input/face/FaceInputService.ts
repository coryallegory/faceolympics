import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEFAULT_INPUT, type NormalizedFaceInput } from '../../core/types';
import { mapToSignals } from './signal-mapper';

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

export class FaceInputService {
  private stream?: MediaStream;
  private video = document.createElement('video');
  private input: NormalizedFaceInput = { ...DEFAULT_INPUT, facePresent: false };
  private landmarker?: FaceLandmarker;
  private debugFrame: FaceDebugFrame = { landmarks: [], blendshapes: {}, updatedAt: 0, status: 'idle', message: 'Camera has not started.' };
  private isLoadingLandmarker = false;
  private blinkState = { left: false, right: false };

  async start(): Promise<HTMLVideoElement> {
    if (this.stream) return this.video;
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    this.input = { ...DEFAULT_INPUT, facePresent: true, confidence: 0.6 };
    this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'loading', message: 'Camera started. Loading MediaPipe face tracker…' };
    void this.loadLandmarker();
    return this.video;
  }

  getVideo(): HTMLVideoElement { return this.video; }
  getInput(): NormalizedFaceInput { return this.input; }
  getDebugFrame(): FaceDebugFrame { return this.debugFrame; }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.input = { ...DEFAULT_INPUT, facePresent: false, confidence: 0 };
    this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'idle', message: 'Camera stopped.' };
  }

  setDebugInput(patch: Partial<NormalizedFaceInput>): void {
    this.input = { ...this.input, ...patch };
  }

  // Schedules the next detection tick in sync with new video frames where supported,
  // falling back to RAF on browsers without requestVideoFrameCallback.
  private scheduleTick(): void {
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
      this.debugFrame = { ...this.debugFrame, updatedAt: Date.now(), status: 'loading', message: `Local MediaPipe assets failed (${this.errorMessage(localError)}). Trying CDN fallback…` };
      try {
        this.landmarker = await this.createLandmarker('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm', PINNED_MODEL_URL);
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'ready', message: 'Face tracker ready from CDN fallback. Looking for a face…' };
        this.scheduleTick();
      } catch (cdnError) {
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'error', message: `Face tracker failed. Local: ${this.errorMessage(localError)}; CDN: ${this.errorMessage(cdnError)}` };
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private tick(): void {
    if (this.landmarker && this.video.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      const face = result.faceBlendshapes[0];
      const landmarks = result.faceLandmarks[0] ?? [];
      if (landmarks.length > 0) {
        const blendshapes = face ? Object.fromEntries(face.categories.map((item) => [item.categoryName, item.score])) : {};
        const signals = mapToSignals(blendshapes, landmarks);
        // Hysteresis: close at 0.5, re-open only once score drops below 0.25.
        if (signals.eyeOpenLeft < 0.5) this.blinkState.left = true;
        else if (signals.eyeOpenLeft > 0.75) this.blinkState.left = false;
        if (signals.eyeOpenRight < 0.5) this.blinkState.right = true;
        else if (signals.eyeOpenRight > 0.75) this.blinkState.right = false;
        this.input = {
          facePresent: signals.facePresent,
          confidence: signals.confidence,
          leftBlink: this.blinkState.left,
          rightBlink: this.blinkState.right,
          bothEyesClosed: this.blinkState.left && this.blinkState.right,
          mouthOpen: signals.mouthOpen,
          lipsPursed: signals.lipPucker > 0.45,
          eyebrowsRaised: Math.max(signals.browRaiseLeft, signals.browRaiseRight),
          leftEyebrowRaised: signals.browRaiseLeft,
          rightEyebrowRaised: signals.browRaiseRight,
          headRoll: 0,
        };
        this.debugFrame = { landmarks, blendshapes, updatedAt: Date.now(), status: 'tracking', message: face ? 'Tracking face landmarks and blendshapes.' : 'Tracking landmarks (blendshapes not yet available).' };
      } else {
        this.input = { ...DEFAULT_INPUT, facePresent: false, confidence: 0 };
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'no-face', message: 'Face tracker running — no face detected.' };
      }
    }
    this.scheduleTick();
  }
}
