import type { MedalThresholds } from '../../scoring/medals';

export const dragonBlastConfig = {
  roundMs: 30000,
  chargeToHit: 0.9,
  medals: {
    bronze: 3,
    silver: 6,
    gold: 10,
  } satisfies MedalThresholds,
};
