import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEFAULT_INPUT, type NormalizedFaceInput } from '../../core/types';

export interface FaceDebugFrame {
  landmarks: readonly NormalizedLandmark[];
  blendshapes: Record<string, number>;
  updatedAt: number;
}

export class FaceInputService {
  private stream?: MediaStream;
  private video = document.createElement('video');
  private input: NormalizedFaceInput = { ...DEFAULT_INPUT, facePresent: false };
  private landmarker?: FaceLandmarker;
  private debugFrame: FaceDebugFrame = { landmarks: [], blendshapes: {}, updatedAt: 0 };
  private isLoadingLandmarker = false;

  async start(): Promise<HTMLVideoElement> {
    if (this.stream) return this.video;
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    this.input = { ...DEFAULT_INPUT, facePresent: true, confidence: 0.6 };
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
    this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now() };
  }

  setDebugInput(patch: Partial<NormalizedFaceInput>): void {
    this.input = { ...this.input, ...patch };
  }

  private async loadLandmarker(): Promise<void> {
    if (this.landmarker || this.isLoadingLandmarker) return;
    this.isLoadingLandmarker = true;
    const fileset = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    this.isLoadingLandmarker = false;
    requestAnimationFrame(() => this.tick());
  }

  private tick(): void {
    if (this.landmarker && this.video.readyState >= 2) {
      const result = this.landmarker.detectForVideo(this.video, performance.now());
      const face = result.faceBlendshapes[0];
      const landmarks = result.faceLandmarks[0] ?? [];
      if (face) {
        const blendshapes = Object.fromEntries(face.categories.map((item) => [item.categoryName, item.score]));
        const score = (name: string): number => blendshapes[name] ?? 0;
        const left = score('eyeBlinkLeft');
        const right = score('eyeBlinkRight');
        this.input = {
          facePresent: true,
          confidence: Math.max(...face.categories.map((item) => item.score), 0.5),
          leftBlink: left > 0.45,
          rightBlink: right > 0.45,
          bothEyesClosed: left > 0.45 && right > 0.45,
          mouthOpen: score('jawOpen'),
          lipsPursed: score('mouthPucker') > 0.45,
          eyebrowsRaised: Math.max(score('browOuterUpLeft'), score('browOuterUpRight'), score('browInnerUp')),
          headRoll: 0,
        };
        this.debugFrame = { landmarks, blendshapes, updatedAt: Date.now() };
      } else {
        this.input = { ...DEFAULT_INPUT, facePresent: false, confidence: 0 };
        this.debugFrame = { landmarks: [], blendshapes: {}, updatedAt: Date.now() };
      }
    }
    requestAnimationFrame(() => this.tick());
  }
}
