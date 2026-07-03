import { describe, expect, it, vi } from 'vitest';
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

vi.mock('../calibration-screen', () => diagnosticSpies);
vi.mock('../ui', () => ({
  button: buttonSpy,
}));

interface FakeButton {
  textContent: string;
  click: () => void;
}

interface FakeNode {
  textContent: string;
}

interface FakePreview {
  dataset: Record<string, string>;
  prepended: unknown[];
  prepend: (node: unknown) => void;
}

interface FakeActions {
  children: FakeButton[];
  replaceChildren: (...nodes: FakeButton[]) => void;
}

interface FakeApp {
  querySelector: <T>(selector: string) => T | null;
  contains: (node: unknown) => boolean;
}

function createScreenHarness() {
  const actions: FakeActions = {
    children: [],
    replaceChildren(...nodes: FakeButton[]) {
      this.children = nodes;
    },
  };
  const preview: FakePreview = {
    dataset: {},
    prepended: [],
    prepend(node: unknown) {
      this.prepended.push(node);
    },
  };
  const trackerStatus: FakeNode = { textContent: '' };
  const readout: FakeNode = { textContent: '' };
  const nodes = new Map<string, unknown>([
    ['#actions', actions],
    ['#preview', preview],
    ['#tracker-status', trackerStatus],
    ['#readout', readout],
  ]);
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
    goTo,
    preview,
    readout,
    render,
    setAnimationFrame,
    trackerStatus,
  };
}

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

  it('starts the overlay when camera start succeeds', async () => {
    const harness = createScreenHarness();
    const video = { nodeName: 'VIDEO' } as unknown as HTMLVideoElement;
    const face = {
      start: vi.fn().mockResolvedValue(video),
      getDebugFrame: vi.fn(),
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
});
