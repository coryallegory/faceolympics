import type { MedalThresholds } from '../../scoring/medals';

export const blinkOffConfig = {
  maxMs: 30000,
  blinkPenaltyMs: 1200,
  medals: {
    bronze: 5000,
    silver: 12000,
    gold: 20000,
  } satisfies MedalThresholds,
};
