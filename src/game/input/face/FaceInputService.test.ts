import { describe, expect, it } from 'vitest';
import { cameraStartErrorMessage } from './FaceInputService';

// FaceInputService itself touches `document` (video element) and getUserMedia at construction
// / start() time, which this project deliberately keeps out of unit tests (no jsdom — see
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
