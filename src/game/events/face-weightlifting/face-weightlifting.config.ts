import type { MedalThresholds } from '../../scoring/medals';

export const faceWeightliftingConfig = {
  roundMs: 25000,
  holdTargetMs: 4500,
  medals: {
    bronze: 2000,
    silver: 4500,
    gold: 8000,
  } satisfies MedalThresholds,
};
