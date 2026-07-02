import type { Medal } from '../core/types';

export interface MedalThresholds {
  bronze: number;
  silver: number;
  gold: number;
}

export function medalForScore(score: number, thresholds: MedalThresholds): Medal {
  if (score >= thresholds.gold) {
    return 'gold';
  }

  if (score >= thresholds.silver) {
    return 'silver';
  }

  if (score >= thresholds.bronze) {
    return 'bronze';
  }

  return 'none';
}

export function medalLabel(medal: Medal): string {
  return medal === 'none' ? 'Try Again' : medal[0].toUpperCase() + medal.slice(1);
}
