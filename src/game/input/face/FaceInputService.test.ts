import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../core/types';
import type { TuningState } from '../../storage/tuning';
import { AdaptiveRange } from './adaptive-range';
import { FaceInputService, cameraStartErrorMessage } from './FaceInputService';

type FaceInputServiceInternals = {
  adaptiveBrowLeft: AdaptiveRange;
};

function getAdaptiveBrowLeft(service: FaceInputService): AdaptiveRange {
  return (service as unknown as FaceInputServiceInternals).adaptiveBrowLeft;
}

function installDocumentStub() {
  globalThis.document = {
    baseURI: 'https://example.test/',
    createElement: vi.fn(() => ({
      pause: vi.fn(),
      srcObject: null,
      muted: false,
      playsInline: false,
    })),
  } as unknown as Document;
}

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error - test-only teardown of the stubbed global
  delete globalThis.document;
});

// FaceInputService itself touches `document` (video element) and getUserMedia at construction
// / start() time, which this project deliberately keeps out of unit tests (no jsdom - see
// app-state.test.ts). cameraStartErrorMessage is exported as a standalone pure function
// specifically so the message-mapping logic that start() relies on is independently testable
// without a live camera or a DOM environment.
describe('cameraStartErrorMessage', () => {
  it('maps a denied permission to a friendly, actionable message', () => {
    const error = new DOMException('Permission denied', 'NotAllowedError');
    expect(cameraStartErrorMessage(error)).toBe(
      'Camera access was denied. Allow camera access for this site in your browser settings, then retry.',
    );
  });

  it('maps a missing camera device to a distinct message', () => {
    const error = new DOMException('no devices found', 'NotFoundError');
    expect(cameraStartErrorMessage(error)).toBe('No camera was found on this device.');
  });

  it('maps a camera already in use to a distinct message', () => {
    const error = new DOMException('could not start video source', 'NotReadableError');
    expect(cameraStartErrorMessage(error)).toBe(
      'The camera is already in use by another application. Close other apps or tabs using it, then retry.',
    );
  });

  it('falls back to a generic message with details for an unrecognized error', () => {
    const error = new Error('boom');
    expect(cameraStartErrorMessage(error)).toBe('Could not start the front camera (boom).');
  });

  it('falls back to a generic message for a non-Error rejection value', () => {
    expect(cameraStartErrorMessage('weird rejection')).toBe(
      'Could not start the front camera (weird rejection).',
    );
  });
});

describe('FaceInputService tuning API', () => {
  it('seedTuning round-trips tuning state and reapplies trigger thresholds to current signals', () => {
    installDocumentStub();
    const service = new FaceInputService();

    service.setDebugInput({ mouthOpen: 0.7 });
    expect(service.getEventInput().triggers.mouthOpen).toBe(true);

    const state: TuningState = {
      thresholds: {
        ...DEFAULT_THRESHOLDS,
        mouthOpen: 0.8,
        browRaised: 0.72,
        gaze: 0.58,
      },
      adaptive: {
        browRaiseLeft: { low: 0.2, high: 0.8 },
        browRaiseRight: { low: 0.25, high: 0.75 },
        gazeX: { low: 0.1, high: 0.6 },
        gazeY: { low: 0.05, high: 0.55 },
      },
    };

    service.seedTuning(state);

    expect(service.getTuningSnapshot()).toEqual(state);
    expect(service.getEventInput().triggers.mouthOpen).toBe(false);
  });

  it('a seeded adaptive range remaps in-range values instead of using cold-start passthrough', () => {
    installDocumentStub();
    const coldService = new FaceInputService();
    const seededService = new FaceInputService();
    const rawValue = 0.35;

    expect(getAdaptiveBrowLeft(coldService).normalize(rawValue, 16)).toBe(rawValue);

    seededService.seedTuning({
      thresholds: { ...DEFAULT_THRESHOLDS },
      adaptive: {
        browRaiseLeft: { low: 0.2, high: 0.8 },
        browRaiseRight: { low: 0.2, high: 0.8 },
        gazeX: { low: 0.1, high: 0.6 },
        gazeY: { low: 0.1, high: 0.6 },
      },
    });

    const normalized = getAdaptiveBrowLeft(seededService).normalize(rawValue, 16);
    expect(normalized).not.toBe(rawValue);
    expect(normalized).toBeCloseTo(0.25, 2);
  });
});
