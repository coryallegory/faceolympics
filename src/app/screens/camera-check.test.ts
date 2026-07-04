import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EventInput } from '../../game/core/types';
import type { FaceDebugFrame } from '../../game/input/face/FaceInputService';
import type { TuningState } from '../../game/storage/tuning';
import { showCameraCheckScreen } from './camera-check';

const diagnosticSpies = vi.hoisted(() => ({
  buildDiagnosticHtml: vi.fn(() => '<main>camera check</main>'),
  logDiagnosticMessage: vi.fn(),
  startDiagnosticOverlay: vi.fn(),
}));

const buttonSpy = vi.hoisted(() => vi.fn((label: string, onClick: () => void) => ({
  textContent: label,
  click: onClick,
})));

const overlaySpies = vi.hoisted(() => ({
  drawFaceOverlay: vi.fn(),
}));

vi.mock('../calibration-screen', () => diagnosticSpies);
vi.mock('../face-overlay', () => overlaySpies);
vi.mock('../ui', () => ({
  button: buttonSpy,
}));

interface FakeButton {
  textContent: string;
  click: () => void;
}

interface FakeNode {
  id: string;
  textContent: string;
  parentElement: FakeContainer | null;
  className?: string;
  children?: FakeNode[];
  append?: (...nodes: FakeNode[]) => void;
}

interface FakeContainer extends FakeNode {
  children: FakeNode[];
  append: (...nodes: FakeNode[]) => void;
}

interface FakeDetails extends FakeContainer {
  open: boolean;
}

interface FakePreview {
  clientHeight: number;
  clientWidth: number;
  dataset: Record<string, string>;
  prepended: unknown[];
  prepend: (node: unknown) => void;
}

interface FakeActions {
  children: FakeButton[];
  replaceChildren: (...nodes: FakeButton[]) => void;
}

interface FakeCanvas {
  height: number;
  width: number;
  getContext: (kind: string) => CanvasRenderingContext2D | null;
}

interface FakeApp {
  querySelector: <T>(selector: string) => T | null;
  contains: (node: unknown) => boolean;
}

interface AnimationFrameHarness {
  queue: FrameRequestCallback[];
  runNext: (timestamp?: number) => void;
}

function installAnimationFrameHarness(): AnimationFrameHarness {
  const queue: FrameRequestCallback[] = [];

  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      queue.push(callback);
      return queue.length;
    }),
  );

  return {
    queue,
    runNext(timestamp = 16) {
      const callback = queue.shift();

      if (!callback) {
        throw new Error('No queued animation frame callback to run.');
      }

      callback(timestamp);
    },
  };
}

function createContainer(id: string, register: (node: FakeNode) => void): FakeContainer {
  return {
    id,
    textContent: '',
    parentElement: null,
    children: [],
    append(...nodes: FakeNode[]) {
      for (const node of nodes) {
        node.parentElement = this;
        this.children.push(node);
        register(node);
      }
    },
  };
}

function createNode(id: string, parentElement: FakeContainer | null = null): FakeNode {
  return {
    id,
    textContent: '',
    parentElement,
  };
}

function createScreenHarness() {
  const nodes = new Map<string, unknown>();
  const register = (node: FakeNode): void => {
    nodes.set(`#${node.id}`, node);
    for (const child of node.children ?? []) {
      register(child);
    }
  };

  const actions: FakeActions = {
    children: [],
    replaceChildren(...buttons: FakeButton[]) {
      this.children = buttons;
    },
  };
  const preview: FakePreview = {
    clientHeight: 360,
    clientWidth: 240,
    dataset: {},
    prepended: [],
    prepend(node: unknown) {
      this.prepended.push(node);
    },
  };
  const trackerStatus = createNode('tracker-status');
  const panel = createContainer('debug-panel', register);
  const readout = createNode('readout', panel);
  const triggerConsole = createNode('trigger-console');
  const overlayContext = {
    clearRect: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  const canvas: FakeCanvas = {
    height: 0,
    width: 0,
    getContext: vi.fn(() => overlayContext),
  };

  panel.children.push(readout);

  nodes.set('#actions', actions);
  nodes.set('#preview', preview);
  nodes.set('#tracker-status', trackerStatus);
  nodes.set('#readout', readout);
  nodes.set('#trigger-console', triggerConsole);
  nodes.set('#face-overlay', canvas);

  globalThis.document = {
    createElement: (tagName: string) => {
      if (tagName === 'details') {
        return {
          ...createContainer('', register),
          open: false,
        } as unknown as HTMLDetailsElement;
      }

      return createContainer('', register) as unknown as HTMLElement;
    },
  } as unknown as Document;

  const app: FakeApp = {
    querySelector: <T>(selector: string): T | null => (nodes.get(selector) as T | undefined) ?? null,
    contains: (node: unknown) => node === preview,
  };
  const goTo = vi.fn();
  const render = vi.fn();
  const setAnimationFrame = vi.fn();

  return {
    actions,
    app: app as unknown as HTMLDivElement,
    canvas,
    getNode<T>(selector: string): T | null {
      return (nodes.get(selector) as T | undefined) ?? null;
    },
    goTo,
    overlayContext,
    preview,
    readout,
    render,
    setAnimationFrame,
    trackerStatus,
    triggerConsole,
  };
}

function createLegacyFace() {
  const video = { nodeName: 'VIDEO' } as unknown as HTMLVideoElement;

  return {
    face: {
      start: vi.fn().mockResolvedValue(video),
      getDebugFrame: vi.fn(),
    },
    video,
  };
}

function createNewModelFace() {
  const video = {
    nodeName: 'VIDEO',
    videoHeight: 640,
    videoWidth: 480,
  } as unknown as HTMLVideoElement;
  const eventInput: EventInput = {
    signals: {
      facePresent: true,
      confidence: 0.91,
      mouthOpen: 0.74,
      lipPucker: 0.21,
      browRaiseLeft: 0.83,
      browRaiseRight: 0.48,
      eyeOpenLeft: 0.96,
      eyeOpenRight: 0.87,
      gazeX: 0.4,
      gazeY: -0.65,
    },
    triggers: {
      blinkLeft: true,
      blinkRight: false,
      bothEyesClosed: false,
      mouthOpen: true,
      lipsPursed: false,
      browsRaised: true,
      browLeftRaised: true,
      browRightRaised: false,
      lookLeft: false,
      lookRight: true,
      lookUp: false,
      lookDown: true,
    },
  };
  const tuning: TuningState = {
    thresholds: {
      eyeClosed: 0.45,
      mouthOpen: 0.52,
      lipPucker: 0.57,
      browRaised: 0.61,
      gaze: 0.4,
      hysteresisGap: 0.15,
    },
    adaptive: {
      browRaiseLeft: { low: 0.18, high: 0.88 },
      browRaiseRight: { low: 0.12, high: 0.76 },
      gazeX: { low: 0.05, high: 0.62 },
      gazeY: { low: 0.08, high: 0.71 },
    },
  };
  const frame: FaceDebugFrame = {
    landmarks: [],
    blendshapes: {
      browInnerUp: 0.66,
      jawOpen: 0.82,
    },
    updatedAt: 123,
    status: 'tracking',
    message: 'Tracking face landmarks and blendshapes.',
  };

  return {
    eventInput,
    face: {
      start: vi.fn().mockResolvedValue(video),
      getDebugFrame: vi.fn(() => frame),
      getEventInput: vi.fn(() => eventInput),
      getTuningSnapshot: vi.fn(() => tuning),
    },
    frame,
    tuning,
    video,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  // @ts-expect-error - test-only teardown of the stubbed global
  delete globalThis.document;
});

describe('showCameraCheckScreen', () => {
  it('shows the service-provided error message and a retry state when camera start fails', async () => {
    const harness = createScreenHarness();
    const friendlyMessage = 'Camera access was denied. Allow camera access for this site in your browser settings, then retry.';
    const face = {
      start: vi.fn().mockRejectedValue(new Error('permission denied')),
      getDebugFrame: vi.fn(() => ({
        landmarks: [],
        blendshapes: {},
        updatedAt: 0,
        status: 'error' as const,
        message: friendlyMessage,
      })),
    } as unknown as { start: () => Promise<HTMLVideoElement>; getDebugFrame: () => unknown };

    await showCameraCheckScreen({
      face: face as unknown as never,
      onBack: vi.fn(),
    })({
      app: harness.app,
      buildCode: 'TEST',
      goTo: harness.goTo,
      render: harness.render,
      setAnimationFrame: harness.setAnimationFrame,
    });

    expect(face.start).toHaveBeenCalledTimes(1);
    expect(harness.preview.dataset.status).toBe('Camera unavailable');
    expect(harness.trackerStatus.textContent).toBe(`ERROR: ${friendlyMessage}`);
    expect(JSON.parse(harness.readout.textContent)).toMatchObject({
      error: friendlyMessage,
      details: 'permission denied',
    });
    expect(harness.actions.children.map((button) => button.textContent)).toEqual(['Retry', 'Back']);
    expect(diagnosticSpies.startDiagnosticOverlay).not.toHaveBeenCalled();

    harness.actions.children[0].click();
    expect(harness.goTo).toHaveBeenCalledTimes(1);
    expect(diagnosticSpies.logDiagnosticMessage).toHaveBeenCalledWith(
      harness.app,
      `${friendlyMessage} (permission denied)`,
    );
  });

  it('uses the legacy diagnostic overlay when the A9 camera-check API is absent', async () => {
    const harness = createScreenHarness();
    const { face, video } = createLegacyFace();

    await showCameraCheckScreen({
      face: face as unknown as never,
      onBack: vi.fn(),
    })({
      app: harness.app,
      buildCode: 'TEST',
      goTo: harness.goTo,
      render: harness.render,
      setAnimationFrame: harness.setAnimationFrame,
    });

    expect(harness.preview.dataset.status).toBe('');
    expect(harness.preview.prepended).toEqual([video]);
    expect(harness.actions.children.map((button) => button.textContent)).toEqual(['Back']);
    expect(diagnosticSpies.logDiagnosticMessage).toHaveBeenCalledWith(
      harness.app,
      'Camera Check ready. Move eyes, brows, mouth, and face.',
    );
    expect(diagnosticSpies.startDiagnosticOverlay).toHaveBeenCalledWith(
      harness.app,
      face,
      video,
      harness.setAnimationFrame,
    );
  });

  it('renders the exact trigger console and tuning readout for the new camera-check model', async () => {
    const animationFrames = installAnimationFrameHarness();
    const harness = createScreenHarness();
    const { eventInput, face, frame, tuning, video } = createNewModelFace();

    await showCameraCheckScreen({
      face: face as unknown as never,
      onBack: vi.fn(),
    })({
      app: harness.app,
      buildCode: 'TEST',
      goTo: harness.goTo,
      render: harness.render,
      setAnimationFrame: harness.setAnimationFrame,
    });

    const blendshapeDetails = harness.getNode<FakeDetails>('#blendshape-details');
    const blendshapeReadout = harness.getNode<FakeNode>('#blendshape-readout');

    expect(diagnosticSpies.startDiagnosticOverlay).not.toHaveBeenCalled();
    expect(blendshapeDetails).not.toBeNull();
    expect(blendshapeReadout?.textContent).toBe('{}');
    expect(animationFrames.queue).toHaveLength(1);

    animationFrames.runNext();

    expect(harness.trackerStatus.textContent).toBe('TRACKING: Tracking face landmarks and blendshapes.');
    expect(harness.canvas.width).toBe(harness.preview.clientWidth);
    expect(harness.canvas.height).toBe(harness.preview.clientHeight);
    expect(harness.overlayContext.clearRect).toHaveBeenCalledWith(
      0,
      0,
      harness.preview.clientWidth,
      harness.preview.clientHeight,
    );
    expect(overlaySpies.drawFaceOverlay).toHaveBeenCalledWith(
      harness.overlayContext,
      frame,
      eventInput.triggers,
      video,
      harness.preview.clientWidth,
      harness.preview.clientHeight,
    );
    expect(harness.triggerConsole.textContent).toBe(JSON.stringify({
      blinkLeft: true,
      blinkRight: false,
      bothEyesClosed: false,
      mouthOpen: true,
      lipsPursed: false,
      browsRaised: true,
      browLeftRaised: true,
      browRightRaised: false,
      lookLeft: false,
      lookRight: true,
      lookUp: false,
      lookDown: true,
    }, null, 2));
    expect(harness.readout.textContent).toBe(JSON.stringify({
      signals: eventInput.signals,
      thresholds: tuning.thresholds,
      adaptive: tuning.adaptive,
    }, null, 2));
    expect(blendshapeReadout?.textContent).toBe('{}');
  });

  it('keeps blendshapes behind the details toggle for the new camera-check model', async () => {
    const animationFrames = installAnimationFrameHarness();
    const harness = createScreenHarness();
    const { face, frame } = createNewModelFace();

    await showCameraCheckScreen({
      face: face as unknown as never,
      onBack: vi.fn(),
    })({
      app: harness.app,
      buildCode: 'TEST',
      goTo: harness.goTo,
      render: harness.render,
      setAnimationFrame: harness.setAnimationFrame,
    });

    const blendshapeDetails = harness.getNode<FakeDetails>('#blendshape-details');
    const blendshapeReadout = harness.getNode<FakeNode>('#blendshape-readout');

    if (!blendshapeDetails || !blendshapeReadout) {
      throw new Error('Expected blendshape details elements to exist.');
    }

    animationFrames.runNext();
    expect(blendshapeReadout.textContent).toBe('{}');

    blendshapeDetails.open = true;
    animationFrames.runNext(32);

    expect(blendshapeReadout.textContent).toBe(JSON.stringify(frame.blendshapes, null, 2));
  });
});
