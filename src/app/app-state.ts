import type { FaceOlympicsEvent } from '../game/core/types';
import { FaceInputService } from '../game/input/face/FaceInputService';

const face = new FaceInputService();

let current: FaceOlympicsEvent | undefined;

export function getFaceService(): FaceInputService {
  return face;
}

export function getCurrentEvent(): FaceOlympicsEvent | undefined {
  return current;
}

export function setCurrentEvent(next: FaceOlympicsEvent | undefined): void {
  if (current && current !== next) {
    current.dispose();
  }

  current = next;
}

export function clearCurrentEvent(): void {
  setCurrentEvent(undefined);
}
