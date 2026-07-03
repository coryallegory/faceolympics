import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { DEFAULT_SIGNALS, type FaceSignals } from '../../core/types';
import { combineBrowSignals, estimateBrowLiftFromLandmarks } from './brow-metrics';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clamp11 = (value: number): number => Math.min(1, Math.max(-1, value));

const mean = (...values: number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

const score = (blendshapes: Record<string, number>, name: string): number =>
  blendshapes[name] ?? 0;

const mapBrowSignal = (blendshapeScore: number, geometryScore: number): number => {
  if (blendshapeScore === 0 && geometryScore === 0) return 0;
  return combineBrowSignals(blendshapeScore, geometryScore);
};

export function mapToSignals(
  blendshapes: Record<string, number>,
  landmarks?: readonly NormalizedLandmark[],
): FaceSignals {
  const geometryBrow = landmarks?.length
    ? estimateBrowLiftFromLandmarks(landmarks)
    : { left: 0, right: 0 };

  const imageLeftBrowBlendshape = Math.max(
    score(blendshapes, 'browOuterUpLeft'),
    score(blendshapes, 'browInnerUp'),
  );
  const imageRightBrowBlendshape = Math.max(
    score(blendshapes, 'browOuterUpRight'),
    score(blendshapes, 'browInnerUp'),
  );
  const imageLeftBrow = mapBrowSignal(imageLeftBrowBlendshape, geometryBrow.left);
  const imageRightBrow = mapBrowSignal(imageRightBrowBlendshape, geometryBrow.right);

  const lookUp = mean(
    score(blendshapes, 'eyeLookUpLeft'),
    score(blendshapes, 'eyeLookUpRight'),
  );
  const lookDown = mean(
    score(blendshapes, 'eyeLookDownLeft'),
    score(blendshapes, 'eyeLookDownRight'),
  );

  const subjectLookLeft = mean(
    score(blendshapes, 'eyeLookInLeft'),
    score(blendshapes, 'eyeLookOutRight'),
  );
  const subjectLookRight = mean(
    score(blendshapes, 'eyeLookOutLeft'),
    score(blendshapes, 'eyeLookInRight'),
  );

  return {
    ...DEFAULT_SIGNALS,
    // TODO A4/F3: source this from tracker presence/detection confidence once carried through.
    confidence: 1,
    mouthOpen: clamp01(score(blendshapes, 'jawOpen')),
    lipPucker: clamp01(score(blendshapes, 'mouthPucker')),
    eyeOpenLeft: clamp01(1 - score(blendshapes, 'eyeBlinkRight')),
    eyeOpenRight: clamp01(1 - score(blendshapes, 'eyeBlinkLeft')),
    browRaiseLeft: imageRightBrow,
    browRaiseRight: imageLeftBrow,
    gazeX: clamp11(subjectLookRight - subjectLookLeft),
    gazeY: clamp11(lookUp - lookDown),
  };
}
