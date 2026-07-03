import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_THRESHOLDS } from '../../core/types';
import type { TuningState } from '../../storage/tuning';
import { FaceInputService, cameraStartErrorMessage } from './FaceInputService';

function installDocumentStub() {
  let pendingVideoFrameCallback: VideoFrameRequestCallback | null = null;
  const video = {
    pause: vi.fn(),
    play: vi.fn().mockResolvedValue(undefined),
    requestVideoFrameCallback: vi.fn((cb: VideoFrameRequestCallback) => {
      pendingVideoFrameCallback = cb;
      return 1;
    }),
    readyState: 2,
    srcObject: null,
    muted: false,
    playsInline: false,
  };
  globalThis.document = {
    baseURI: 'https://example.test/',
    createElement: vi.fn(() => video),
  } as unknown as Document;

  return {
    video,
    runPendingFrame() {
      const callback = pendingVideoFrameCallback;
      if (!callback) throw new Error('Expected FaceInputService to schedule a video frame callback.');
      pendingVideoFrameCallback = null;
      callback(0, {} as VideoFrameCallbackMetadata);
    },
  };
}

async function serviceSignalForSingleFrame(
  service: FaceInputService,
  runPendingFrame: () => void,
): Promise<number> {
  const fakeStream = { getTracks: () => [] } as unknown as MediaStream;
  const detectForVideo = vi.fn(() => ({
    faceBlendshapes: [{
      categories: [{ categoryName: 'browOuterUpRight', score: 0.35 }],
    }],
    faceLandmarks: [[{ x: 0, y: 0, z: 0 }]],
  }));

  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(fakeStream),
    },
  });
  Object.defineProperty(service, 'createLandmarker', {
    value: vi.fn().mockResolvedValue({ detectForVideo }),
    configurable: true,
  });

  await service.start();
  await Promise.resolve();
  runPendingFrame();

  return service.getEventInput().signals.browRaiseLeft;
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

  it('a seeded adaptive range changes the normalized brow signal reported by the service', async () => {
    const coldDocument = installDocumentStub();
    const coldService = new FaceInputService();
    const coldSignal = await serviceSignalForSingleFrame(
      coldService,
      coldDocument.runPendingFrame,
    );

    coldService.stop();

    const seededDocument = installDocumentStub();
    const seededService = new FaceInputService();

    seededService.seedTuning({
      thresholds: { ...DEFAULT_THRESHOLDS },
      adaptive: {
        browRaiseLeft: { low: 0.2, high: 0.8 },
        browRaiseRight: { low: 0.2, high: 0.8 },
        gazeX: { low: 0.1, high: 0.6 },
        gazeY: { low: 0.1, high: 0.6 },
      },
    });
    const seededSignal = await serviceSignalForSingleFrame(
      seededService,
      seededDocument.runPendingFrame,
    );

    expect(coldSignal).toBeCloseTo(0.5475, 4);
    expect(seededSignal).toBeCloseTo((coldSignal - 0.2) / 0.6, 4);
    expect(seededSignal).not.toBeCloseTo(coldSignal, 4);
  });
});
