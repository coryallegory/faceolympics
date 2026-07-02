import type { CalibrationProfile, NormalizedFaceInput } from '../../core/types';

export function buildCalibration(samples: NormalizedFaceInput[]): CalibrationProfile | null {
  const present = samples.filter((sample) => sample.facePresent);
  if (present.length < 5) return null;
  const avg = (pick: (sample: NormalizedFaceInput) => number) => present.reduce((sum, sample) => sum + pick(sample), 0) / present.length;
  const mouth = avg((sample) => sample.mouthOpen);
  const leftBrow = avg((sample) => sample.leftEyebrowRaised);
  const rightBrow = avg((sample) => sample.rightEyebrowRaised);
  const brow = avg((sample) => sample.eyebrowsRaised);
  return {
    neutral: { mouthOpen: mouth, eyebrowsRaised: brow, leftEyebrowRaised: leftBrow, rightEyebrowRaised: rightBrow },
    thresholds: {
      blinkClosed: 0.55,
      eyebrowsRaised: Math.min(0.75, Math.max(0.35, brow + 0.18)),
      leftEyebrowRaised: Math.min(0.75, Math.max(0.35, leftBrow + 0.18)),
      rightEyebrowRaised: Math.min(0.75, Math.max(0.35, rightBrow + 0.18)),
      mouthOpen: Math.min(0.85, mouth + 0.35),
      lipsPursed: 0.55,
    },
    confidence: avg((sample) => sample.confidence),
    createdAt: Date.now(),
  };
}
