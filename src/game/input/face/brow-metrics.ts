import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

const averageY = (landmarks: readonly NormalizedLandmark[], indices: readonly number[]): number | null => {
  let sum = 0;
  for (const index of indices) {
    const point = landmarks[index];
    if (!point) return null;
    sum += point.y;
  }
  return sum / indices.length;
};

const distance = (a: NormalizedLandmark | undefined, b: NormalizedLandmark | undefined): number | null => {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
};

const faceScale = (landmarks: readonly NormalizedLandmark[]): number | null => distance(landmarks[10], landmarks[152]);

function browLiftFromGeometry(
  landmarks: readonly NormalizedLandmark[],
  browIndices: readonly number[],
  upperEyeIndices: readonly number[],
): number {
  const scale = faceScale(landmarks);
  const browY = averageY(landmarks, browIndices);
  const eyeY = averageY(landmarks, upperEyeIndices);
  if (!scale || browY === null || eyeY === null) return 0;

  const browEyeGap = (eyeY - browY) / scale;
  // Face Landmarker eyebrow mesh points tend to sit on the brow ridge, not on the
  // visible eyebrow hair. This maps small brow-ridge movement into a larger,
  // player-facing control signal so raises feel closer to the actual eyebrow motion.
  return clamp01((browEyeGap - 0.115) / 0.075);
}

export interface BrowLiftScores {
  left: number;
  right: number;
}

export function estimateBrowLiftFromLandmarks(landmarks: readonly NormalizedLandmark[]): BrowLiftScores {
  return {
    left: browLiftFromGeometry(landmarks, [70, 63, 105, 66, 107], [159, 158, 160, 161]),
    right: browLiftFromGeometry(landmarks, [336, 296, 334, 293, 300], [386, 385, 387, 388]),
  };
}

export function amplifyBrowBlendshape(score: number): number {
  return clamp01(score * 1.45 + 0.04);
}

export function combineBrowSignals(blendshapeScore: number, landmarkScore: number): number {
  return clamp01(Math.max(amplifyBrowBlendshape(blendshapeScore), landmarkScore));
}
