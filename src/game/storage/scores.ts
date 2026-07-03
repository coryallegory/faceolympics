import type { EventResult } from '../core/types';

const KEY = 'face-olympics-results-v1';

function isStoredResult(value: unknown): value is EventResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as { eventId?: unknown; score?: unknown };

  return typeof result.eventId === 'string'
    && typeof result.score === 'number'
    && Number.isFinite(result.score);
}

export function saveResult(result: EventResult): void {
  const history = loadResults();
  const existing = history.find((item) => item.eventId === result.eventId);
  const best = existing && existing.score >= result.score ? existing : result;
  const others = history.filter((item) => item.eventId !== result.eventId);

  localStorage.setItem(KEY, JSON.stringify([...others, best]));
}

export function loadResults(): EventResult[] {
  const raw = localStorage.getItem(KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    return Array.isArray(parsed) ? parsed.filter(isStoredResult) : [];
  } catch {
    return [];
  }
}
