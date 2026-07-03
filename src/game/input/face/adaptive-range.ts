const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const DEFAULT_MIN_SPAN = 0.15;
export const DEFAULT_RETUNE_TIME_MS = 60_000;

export interface AdaptiveRangeOptions {
  minSpan?: number;
  retuneTimeMs?: number;
}

export interface AdaptiveRangeSnapshot {
  low: number;
  high: number;
}

export class AdaptiveRange {
  private low: number | null = null;
  private high: number | null = null;
  private mean: number | null = null;
  private readonly minSpan: number;
  private readonly retuneTimeMs: number;

  constructor(options: AdaptiveRangeOptions = {}) {
    this.minSpan = options.minSpan ?? DEFAULT_MIN_SPAN;
    this.retuneTimeMs = options.retuneTimeMs ?? DEFAULT_RETUNE_TIME_MS;
  }

  normalize(value: number, deltaMs: number): number {
    this.observe(value, deltaMs);

    const { low, high } = this.snapshot();
    const span = high - low;
    if (span < this.minSpan) return value;

    return clamp01((value - low) / span);
  }

  seed(low: number, high: number): void {
    const seededLow = Math.min(low, high);
    const seededHigh = Math.max(low, high);

    this.low = seededLow;
    this.high = seededHigh;
    this.mean = (seededLow + seededHigh) / 2;
  }

  snapshot(): AdaptiveRangeSnapshot {
    if (this.low === null || this.high === null) {
      return { low: 0, high: 0 };
    }

    return { low: this.low, high: this.high };
  }

  private observe(value: number, deltaMs: number): void {
    if (this.low === null || this.high === null || this.mean === null) {
      this.low = value;
      this.high = value;
      this.mean = value;
      return;
    }

    const alpha = this.decayFactor(deltaMs);
    const nextMean = this.mean + (value - this.mean) * alpha;
    const nextLow = value < this.low ? value : this.low + (nextMean - this.low) * alpha;
    const nextHigh = value > this.high ? value : this.high + (nextMean - this.high) * alpha;

    this.mean = nextMean;
    this.low = Math.min(nextLow, nextHigh);
    this.high = Math.max(nextLow, nextHigh);
  }

  private decayFactor(deltaMs: number): number {
    const elapsedMs = Math.max(0, deltaMs);
    if (this.retuneTimeMs <= 0) return 1;
    return 1 - Math.exp(-elapsedMs / this.retuneTimeMs);
  }
}
