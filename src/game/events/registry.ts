import type {
  CalibrationProfile,
  EventFrameResult,
  EventResult,
  FaceInputPrimitive,
  FaceOlympicsEvent,
  NormalizedFaceInput,
} from '../core/types';
import { BlinkOffEvent } from './blink-off/BlinkOffEvent';
import { DragonBlastEvent } from './dragon-blast/DragonBlastEvent';
import { FaceWeightliftingEvent } from './face-weightlifting/FaceWeightliftingEvent';
import { LookOutEvent } from './look-out/LookOutEvent';

export const eventFactories: Record<string, () => FaceOlympicsEvent> = {
  'blink-off': () => new BlinkOffEvent(),
  'face-weightlifting': () => new FaceWeightliftingEvent(),
  'dragon-blast': () => new DragonBlastEvent(),
  'look-out': () => new LookOutEvent(),
};

// eventList exists so menu/browse screens can read id/title/description
// (and requiredInputs) without paying for a live, stateful event instance.
// Each entry below has the same public shape as FaceOlympicsEvent, but its
// behavioral methods are stubs that throw if ever invoked — actual gameplay
// must go through eventFactories, which still builds real instances.
function notPlayable(id: string): never {
  throw new Error(
    `'${id}' is a metadata-only entry from eventList; use eventFactories['${id}']() to play it.`,
  );
}

function metadataEntry(
  id: string,
  title: string,
  description: string,
  requiredInputs: readonly FaceInputPrimitive[],
): FaceOlympicsEvent {
  return {
    id,
    title,
    description,
    requiredInputs,
    init: (): void => notPlayable(id),
    start: (_calibration: CalibrationProfile): void => notPlayable(id),
    update: (_deltaMs: number, _input: NormalizedFaceInput): EventFrameResult => notPlayable(id),
    pause: (): void => notPlayable(id),
    resume: (): void => notPlayable(id),
    finish: (): EventResult => notPlayable(id),
    dispose: (): void => notPlayable(id),
  };
}

export const eventList: readonly FaceOlympicsEvent[] = [
  metadataEntry(
    'blink-off',
    'Blink-Off',
    'Keep those peepers open! Blink and the clock gets bonked.',
    ['bothEyesClosed', 'facePresent'],
  ),
  metadataEntry(
    'face-weightlifting',
    'Face Weightlifting',
    'Raise eyebrows to lift the silly barbell, relax to steady it, and do not blink under pressure.',
    ['eyebrowsRaised', 'bothEyesClosed', 'facePresent'],
  ),
  metadataEntry(
    'dragon-blast',
    'Dragon Blast',
    'Open your mouth to charge dragon fire, then close or purse lips to blast targets.',
    ['mouthOpen', 'lipsPursed', 'facePresent'],
  ),
  metadataEntry(
    'look-out',
    'Look Out',
    'Watch for the cue and dodge the right way, fast, by looking left or right.',
    ['lookLeft', 'lookRight', 'facePresent'],
  ),
];
