import type { FaceOlympicsEvent } from '../core/types';
import { BlinkOffEvent } from './blink-off/BlinkOffEvent';
import { DragonBlastEvent } from './dragon-blast/DragonBlastEvent';
import { FaceWeightliftingEvent } from './face-weightlifting/FaceWeightliftingEvent';

export const eventFactories: Record<string, () => FaceOlympicsEvent> = {
  'blink-off': () => new BlinkOffEvent(),
  'face-weightlifting': () => new FaceWeightliftingEvent(),
  'dragon-blast': () => new DragonBlastEvent(),
};

export const eventList = Object.values(eventFactories).map((create) => create());
