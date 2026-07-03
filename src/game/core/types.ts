export type FaceInputPrimitive =
  | 'bothEyesClosed'
  | 'blinkLeft'
  | 'blinkRight'
  | 'eyebrowsRaised'
  | 'browsRaised'
  | 'leftEyebrowRaised'
  | 'browLeftRaised'
  | 'rightEyebrowRaised'
  | 'browRightRaised'
  | 'mouthOpen'
  | 'lipsPursed'
  | 'lookLeft'
  | 'lookRight'
  | 'lookUp'
  | 'lookDown'
  | 'facePresent';

export type Medal = 'none' | 'bronze' | 'silver' | 'gold';

export interface FaceSignals {
  facePresent: boolean;
  confidence: number;
  mouthOpen: number;
  lipPucker: number;
  browRaiseLeft: number;
  browRaiseRight: number;
  eyeOpenLeft: number;
  eyeOpenRight: number;
  gazeX: number;
  gazeY: number;
}

export interface FaceTriggers {
  blinkLeft: boolean;
  blinkRight: boolean;
  bothEyesClosed: boolean;
  mouthOpen: boolean;
  lipsPursed: boolean;
  browsRaised: boolean;
  browLeftRaised: boolean;
  browRightRaised: boolean;
  lookLeft: boolean;
  lookRight: boolean;
  lookUp: boolean;
  lookDown: boolean;
}

export interface EventInput {
  signals: FaceSignals;
  triggers: FaceTriggers;
}

export interface TriggerThresholds {
  eyeClosed: number;
  mouthOpen: number;
  lipPucker: number;
  browRaised: number;
  gaze: number;
  hysteresisGap: number;
}

export const DEFAULT_THRESHOLDS: TriggerThresholds = {
  eyeClosed: 0.45,
  mouthOpen: 0.45,
  lipPucker: 0.5,
  browRaised: 0.6,
  gaze: 0.4,
  hysteresisGap: 0.15,
};

export const DEFAULT_SIGNALS: FaceSignals = {
  facePresent: true,
  confidence: 1,
  mouthOpen: 0,
  lipPucker: 0,
  browRaiseLeft: 0,
  browRaiseRight: 0,
  eyeOpenLeft: 1,
  eyeOpenRight: 1,
  gazeX: 0,
  gazeY: 0,
};

export const DEFAULT_TRIGGERS: FaceTriggers = {
  blinkLeft: false,
  blinkRight: false,
  bothEyesClosed: false,
  mouthOpen: false,
  lipsPursed: false,
  browsRaised: false,
  browLeftRaised: false,
  browRightRaised: false,
  lookLeft: false,
  lookRight: false,
  lookUp: false,
  lookDown: false,
};

export const DEFAULT_EVENT_INPUT: EventInput = {
  signals: DEFAULT_SIGNALS,
  triggers: DEFAULT_TRIGGERS,
};

/**
 * @deprecated remove in A4/B2
 */
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

/**
 * @deprecated remove in A4/B2
 */
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

export interface FaceOlympicsEventV2
  extends Omit<FaceOlympicsEvent, 'update'> {
  update(deltaMs: number, input: EventInput): EventFrameResult;
}

/**
 * @deprecated remove in A4/B2
 */
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

/**
 * @deprecated remove in A4/B2
 */
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
