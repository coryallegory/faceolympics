import { describe, expect, it } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { amplifyBrowBlendshape, combineBrowSignals, estimateBrowLiftFromLandmarks } from './brow-metrics';

const landmarksWithBrowGap = (gap: number): NormalizedLandmark[] => {
  const landmarks = Array.from({ length: 475 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  landmarks[10] = { x: 0.5, y: 0.1, z: 0, visibility: 1 };
  landmarks[152] = { x: 0.5, y: 0.9, z: 0, visibility: 1 };
  for (const index of [159, 158, 160, 161, 386, 385, 387, 388]) landmarks[index] = { x: 0.5, y: 0.5, z: 0, visibility: 1 };
  for (const index of [70, 63, 105, 66, 107, 336, 296, 334, 293, 300]) landmarks[index] = { x: 0.5, y: 0.5 - gap, z: 0, visibility: 1 };
  return landmarks;
};

describe('brow metrics', () => {
  it('amplifies subtle MediaPipe brow blendshape scores', () => {
    expect(amplifyBrowBlendshape(0.3)).toBeCloseTo(0.475);
    expect(amplifyBrowBlendshape(0.9)).toBe(1);
  });

  it('turns larger eyebrow-to-eye landmark gaps into stronger lift scores', () => {
    const relaxed = estimateBrowLiftFromLandmarks(landmarksWithBrowGap(0.08));
    const raised = estimateBrowLiftFromLandmarks(landmarksWithBrowGap(0.15));

    expect(raised.left).toBeGreaterThan(relaxed.left);
    expect(raised.right).toBeGreaterThan(relaxed.right);
  });

  it('uses the strongest available brow signal', () => {
    expect(combineBrowSignals(0.2, 0.7)).toBe(0.7);
    expect(combineBrowSignals(0.5, 0.2)).toBeCloseTo(0.765);
  });
});
