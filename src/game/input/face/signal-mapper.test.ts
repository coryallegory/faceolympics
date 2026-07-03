import { describe, expect, it } from 'vitest';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { combineBrowSignals, estimateBrowLiftFromLandmarks } from './brow-metrics';
import { mapToSignals } from './signal-mapper';

const createLandmarks = (): NormalizedLandmark[] =>
  Array.from({ length: 475 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));

const createBrowLandmarks = (leftGap: number, rightGap: number): NormalizedLandmark[] => {
  const landmarks = createLandmarks();
  landmarks[10] = { x: 0.5, y: 0.1, z: 0, visibility: 1 };
  landmarks[152] = { x: 0.5, y: 0.9, z: 0, visibility: 1 };

  for (const index of [159, 158, 160, 161]) {
    landmarks[index] = { x: 0.4, y: 0.5, z: 0, visibility: 1 };
  }
  for (const index of [386, 385, 387, 388]) {
    landmarks[index] = { x: 0.6, y: 0.5, z: 0, visibility: 1 };
  }
  for (const index of [70, 63, 105, 66, 107]) {
    landmarks[index] = { x: 0.4, y: 0.5 - leftGap, z: 0, visibility: 1 };
  }
  for (const index of [336, 296, 334, 293, 300]) {
    landmarks[index] = { x: 0.6, y: 0.5 - rightGap, z: 0, visibility: 1 };
  }

  return landmarks;
};

describe('signal mapper', () => {
  it('maps image-right blink to the subject left eye openness', () => {
    const signals = mapToSignals({ eyeBlinkRight: 0.7 }, createLandmarks());

    expect(signals.eyeOpenLeft).toBeCloseTo(0.3);
    expect(signals.eyeOpenRight).toBe(1);
  });

  it('maps image-left blink to the subject right eye openness', () => {
    const signals = mapToSignals({ eyeBlinkLeft: 0.6 }, createLandmarks());

    expect(signals.eyeOpenLeft).toBe(1);
    expect(signals.eyeOpenRight).toBeCloseTo(0.4);
  });

  it('swaps brow channels from image space to subject anatomy after combining blendshape and geometry', () => {
    const landmarks = createBrowLandmarks(0.12, 0.16);
    const geometry = estimateBrowLiftFromLandmarks(landmarks);
    const signals = mapToSignals(
      {
        browOuterUpLeft: 0.5,
        browOuterUpRight: 0.1,
      },
      landmarks,
    );

    expect(geometry.left).toBeGreaterThan(0);
    expect(geometry.right).toBeGreaterThan(geometry.left);
    expect(signals.browRaiseLeft).toBeCloseTo(combineBrowSignals(0.1, geometry.right));
    expect(signals.browRaiseRight).toBeCloseTo(combineBrowSignals(0.5, geometry.left));
  });

  it('maps upward gaze to positive gazeY', () => {
    const signals = mapToSignals(
      {
        eyeLookUpLeft: 0.6,
        eyeLookUpRight: 0.8,
        eyeLookDownLeft: 0.1,
        eyeLookDownRight: 0.1,
      },
      createLandmarks(),
    );

    expect(signals.gazeY).toBeCloseTo(0.6);
  });

  it('maps downward gaze to negative gazeY', () => {
    const signals = mapToSignals(
      {
        eyeLookUpLeft: 0.1,
        eyeLookUpRight: 0.1,
        eyeLookDownLeft: 0.7,
        eyeLookDownRight: 0.5,
      },
      createLandmarks(),
    );

    expect(signals.gazeY).toBeCloseTo(-0.5);
  });

  it('maps subject-left gaze to negative gazeX on the mirrored preview', () => {
    const signals = mapToSignals(
      {
        eyeLookInLeft: 0.8,
        eyeLookOutRight: 0.6,
        eyeLookOutLeft: 0.1,
        eyeLookInRight: 0.2,
      },
      createLandmarks(),
    );

    expect(signals.gazeX).toBeCloseTo(-0.55);
  });

  it('maps subject-right gaze to positive gazeX on the mirrored preview', () => {
    const signals = mapToSignals(
      {
        eyeLookInLeft: 0.1,
        eyeLookOutRight: 0.2,
        eyeLookOutLeft: 0.8,
        eyeLookInRight: 0.6,
      },
      createLandmarks(),
    );

    expect(signals.gazeX).toBeCloseTo(0.55);
  });

  it('returns neutral signals for empty blendshapes without NaN values', () => {
    const signals = mapToSignals({}, createLandmarks());

    expect(signals).toMatchObject({
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
    });
    expect(Object.values(signals).some((value) => typeof value === 'number' && Number.isNaN(value))).toBe(false);
  });

  it('treats missing landmarks as zero brow-geometry contribution', () => {
    const signals = mapToSignals({ browOuterUpRight: 0.2 }, undefined);

    expect(signals.browRaiseLeft).toBeCloseTo(combineBrowSignals(0.2, 0));
    expect(signals.browRaiseRight).toBe(0);
  });
});
