import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEFAULT_INPUT, type NormalizedFaceInput } from '../../core/types';

export type FaceTrackerStatus = 'idle' | 'loading' | 'ready' | 'tracking' | 'no-face' | 'error';

export interface FaceDebugFrame {
  landmarks: readonly NormalizedLandmark[];
  blendshapes: Record<string, number>;
  updatedAt: number;
  status: FaceTrackerStatus;
  message: string;
}

const mediapipeAssetPath = (path: string): string => new URL(path, document.baseURI).toString();

export class FaceInputService {
  private stream?: MediaStream;
  private video = document.createElement('video');
  private input: NormalizedFaceInput = { ...DEFAULT_INPUT, facePresent: false };
  private landmarker?: FaceLandmarker;
  private debugFrame: FaceDebugFrame = { landmarks: [], blendshapes: {}, updatedAt: 0, status: 'idle', message: 'Camera has not started.' };
  private isLoadingLandmarker = false;

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

  getInput(): NormalizedFaceInput {
    return this.input;
  }

  getDebugFrame(): FaceDebugFrame {
    return this.debugFrame;
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.input = { ...DEFAULT_INPUT, facePresent: false, confidence: 0 };
    this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'idle', message: 'Camera stopped.' };
  }

  setDebugInput(patch: Partial<NormalizedFaceInput>): void {
    this.input = { ...this.input, ...patch };
  }

  private async loadLandmarker(): Promise<void> {
    if (this.landmarker || this.isLoadingLandmarker) return;
    this.isLoadingLandmarker = true;
    this.debugFrame = { ...this.debugFrame, status: 'loading', message: 'Loading MediaPipe face tracker from local WASM assets…', updatedAt: Date.now() };
    try {
      this.landmarker = await this.createLandmarker(mediapipeAssetPath('mediapipe/tasks-vision/wasm/'));
      this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'ready', message: 'Face tracker ready from local WASM assets. Looking for a face…' };
      requestAnimationFrame(() => this.tick());
    } catch (localError) {
      this.debugFrame = { ...this.debugFrame, updatedAt: Date.now(), status: 'loading', message: `Local MediaPipe assets failed (${this.errorMessage(localError)}). Trying CDN fallback…` };
      try {
        this.landmarker = await this.createLandmarker('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'ready', message: 'Face tracker ready from CDN fallback. Looking for a face…' };
        requestAnimationFrame(() => this.tick());
      } catch (cdnError) {
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'error', message: `Face tracker failed. Local: ${this.errorMessage(localError)}; CDN: ${this.errorMessage(cdnError)}` };
      }
    } finally {
      this.isLoadingLandmarker = false;
    }
  }


  private async createLandmarker(wasmRoot: string): Promise<FaceLandmarker> {
    const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
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
        const score = (name: string): number => blendshapes[name] ?? 0;
        const left = score('eyeBlinkLeft');
        const right = score('eyeBlinkRight');
        const leftBrow = Math.max(score('browOuterUpLeft'), score('browInnerUp'));
        const rightBrow = Math.max(score('browOuterUpRight'), score('browInnerUp'));
        this.input = {
          facePresent: true,
          confidence: face ? Math.max(...face.categories.map((item) => item.score), 0.5) : 0.75,
          leftBlink: left > 0.45,
          rightBlink: right > 0.45,
          bothEyesClosed: left > 0.45 && right > 0.45,
          mouthOpen: score('jawOpen'),
          lipsPursed: score('mouthPucker') > 0.45,
          eyebrowsRaised: Math.max(leftBrow, rightBrow),
          leftEyebrowRaised: leftBrow,
          rightEyebrowRaised: rightBrow,
          headRoll: 0,
        };
        this.debugFrame = { landmarks, blendshapes, updatedAt: Date.now(), status: 'tracking', message: face ? 'Tracking face landmarks and blendshapes.' : 'Tracking face landmarks. Blendshapes are not available yet.' };
      } else {
        this.input = { ...DEFAULT_INPUT, facePresent: false, confidence: 0 };
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now(), status: 'no-face', message: 'Face tracker is running but does not see a face.' };
      }
    }
    requestAnimationFrame(() => this.tick());
  }
}
