import type { FaceOlympicsEvent } from '../game/core/types';
import { FaceInputService } from '../game/input/face/FaceInputService';
import { loadTuning, saveTuning } from '../game/storage/tuning';

const face = new FaceInputService();

let current: FaceOlympicsEvent | undefined;

export function getFaceService(): FaceInputService {
  return face;
}

export function restorePersistedTuning(): void {
  const tuning = loadTuning();

  if (!tuning) {
    return;
  }

  face.seedTuning(tuning);
}

export function persistTuning(): void {
  saveTuning(face.getTuningSnapshot());
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
