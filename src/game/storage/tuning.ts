import type { TriggerThresholds } from '../core/types';

const KEY = 'face-olympics-tuning-v1';

/**
 * Channels normalized by AdaptiveRange (src/game/input/face/adaptive-range.ts):
 * brow raise (left/right) and gaze (x/y). Fixed-threshold channels (blink,
 * mouth, lip pucker) do not need adaptive state.
 */
export type AdaptiveChannel = 'browRaiseLeft' | 'browRaiseRight' | 'gazeX' | 'gazeY';

export interface AdaptiveRangeState {
  low: number;
  high: number;
}

export type AdaptiveTuning = Record<AdaptiveChannel, AdaptiveRangeState>;

export interface TuningState {
  thresholds: TriggerThresholds;
  adaptive: AdaptiveTuning;
}

const THRESHOLD_KEYS: readonly (keyof TriggerThresholds)[] = [
  'eyeClosed',
  'mouthOpen',
  'lipPucker',
  'browRaised',
  'gaze',
  'hysteresisGap',
];

const ADAPTIVE_CHANNELS: readonly AdaptiveChannel[] = [
  'browRaiseLeft',
  'browRaiseRight',
  'gazeX',
  'gazeY',
];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isThresholds(value: unknown): value is TriggerThresholds {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return THRESHOLD_KEYS.every((key) => isFiniteNumber(candidate[key]));
}

function isAdaptiveRangeState(value: unknown): value is AdaptiveRangeState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return isFiniteNumber(candidate.low) && isFiniteNumber(candidate.high);
}

function isAdaptiveTuning(value: unknown): value is AdaptiveTuning {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return ADAPTIVE_CHANNELS.every((channel) => isAdaptiveRangeState(candidate[channel]));
}

function isTuningState(value: unknown): value is TuningState {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { thresholds?: unknown; adaptive?: unknown };

  return isThresholds(candidate.thresholds) && isAdaptiveTuning(candidate.adaptive);
}

export function saveTuning(state: TuningState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function loadTuning(): TuningState | null {
  const raw = localStorage.getItem(KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    return isTuningState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
