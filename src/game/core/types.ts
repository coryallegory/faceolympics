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
  start(): void;
  update(deltaMs: number, input: EventInput): EventFrameResult;
  pause(): void;
  resume(): void;
  finish(): EventResult;
  dispose(): void;
}
