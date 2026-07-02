export type FaceInputPrimitive =
  | 'bothEyesClosed'
  | 'eyebrowsRaised'
  | 'leftEyebrowRaised'
  | 'rightEyebrowRaised'
  | 'mouthOpen'
  | 'lipsPursed'
  | 'facePresent';

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';

export interface NormalizedFaceInput {
  facePresent: boolean;
  confidence: number;
  bothEyesClosed: boolean;
  leftBlink: boolean;
  rightBlink: boolean;
  mouthOpen: number;
  lipsPursed: boolean;
  eyebrowsRaised: number;
  leftEyebrowRaised: number;
  rightEyebrowRaised: number;
  headRoll: number;
}

export interface CalibrationProfile {
  neutral: {
    mouthOpen: number;
    eyebrowsRaised: number;
    leftEyebrowRaised: number;
    rightEyebrowRaised: number;
  };
  thresholds: {
    blinkClosed: number;
    eyebrowsRaised: number;
    leftEyebrowRaised: number;
    rightEyebrowRaised: number;
    mouthOpen: number;
    lipsPursed: number;
  };
  confidence: number;
  createdAt: number;
}

export interface EventContext {
  now: () => number;
}

export interface EventFrameResult {
  finished: boolean;
  score: number;
  feedback: string;
  state: Record<string, number | string | boolean>;
}

export interface EventResult {
  eventId: string;
  title: string;
  score: number;
  medal: Medal;
  summary: string;
}

export interface FaceOlympicsEvent {
  id: string;
  title: string;
  description: string;
  requiredInputs: readonly FaceInputPrimitive[];
  init(context: EventContext): void | Promise<void>;
  start(calibration: CalibrationProfile): void;
  update(deltaMs: number, input: NormalizedFaceInput): EventFrameResult;
  pause(): void;
  resume(): void;
  finish(): EventResult;
  dispose(): void;
}

export const DEFAULT_INPUT: NormalizedFaceInput = {
  facePresent: true,
  confidence: 1,
  bothEyesClosed: false,
  leftBlink: false,
  rightBlink: false,
  mouthOpen: 0,
  lipsPursed: false,
  eyebrowsRaised: 0,
  leftEyebrowRaised: 0,
  rightEyebrowRaised: 0,
  headRoll: 0,
};

export const DEFAULT_CALIBRATION: CalibrationProfile = {
  neutral: {
    mouthOpen: 0.15,
    eyebrowsRaised: 0.2,
    leftEyebrowRaised: 0.2,
    rightEyebrowRaised: 0.2,
  },
  thresholds: {
    blinkClosed: 0.65,
    eyebrowsRaised: 0.55,
    leftEyebrowRaised: 0.55,
    rightEyebrowRaised: 0.55,
    mouthOpen: 0.5,
    lipsPursed: 0.65,
  },
  confidence: 0.85,
  createdAt: Date.now(),
};
