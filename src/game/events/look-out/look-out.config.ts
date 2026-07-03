import type { MedalThresholds } from '../../scoring/medals';

export const lookOutConfig = {
  roundMs: 30000,
  cueIntervalMs: 2200,
  reactionWindowMs: 1200,
  medals: {
    bronze: 3,
    silver: 6,
    gold: 9,
  } satisfies MedalThresholds,
};
