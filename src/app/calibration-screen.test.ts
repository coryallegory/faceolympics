import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountCalibration } from './calibration-screen';

const buttonSpy = vi.hoisted(() => vi.fn((label: string, onClick: () => void) => ({
  textContent: label,
  click: onClick,
})));

vi.mock('./ui', () => ({
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

// mountCalibration queries the global `document` directly (it isn't handed a scoped
// root like the screens are), so the test stubs `globalThis.document` rather than
// pulling jsdom into the project - same rationale as app-state.test.ts.
function installDomHarness() {
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
  const triggerConsole: FakeNode = { textContent: '' };
  const nodes = new Map<string, unknown>([
    ['#actions', actions],
    ['#preview', preview],
    ['#tracker-status', trackerStatus],
    ['#readout', readout],
    ['#trigger-console', triggerConsole],
  ]);

  globalThis.document = {
    querySelector: <T>(selector: string): T | null => (nodes.get(selector) as T | undefined) ?? null,
    contains: (node: unknown) => node === preview,
  } as unknown as Document;

  return { actions, preview, readout, trackerStatus, triggerConsole };
}

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error - test-only teardown of the stubbed global
  delete globalThis.document;
});

describe('mountCalibration', () => {
  it('shows the service-provided error message and offers Retry when camera start fails', async () => {
    const dom = installDomHarness();
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
    };
    const onRetry = vi.fn();

    await mountCalibration(
      { mode: 'landing-test' },
      {
        face: face as unknown as never,
        setRafId: vi.fn(),
        onPlay: vi.fn(),
        onRetry,
        onBack: vi.fn(),
      },
    );

    expect(face.start).toHaveBeenCalledTimes(1);
    expect(dom.preview.dataset.status).toBe('Camera unavailable');
    expect(dom.trackerStatus.textContent).toBe(`ERROR: ${friendlyMessage}`);
    expect(JSON.parse(dom.readout.textContent)).toMatchObject({
      error: friendlyMessage,
      details: 'permission denied',
    });
    expect(dom.actions.children.map((button) => button.textContent)).toEqual(['Retry', 'Back']);

    dom.actions.children[0].click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('falls back to the raw error text when the rejection is not an Error instance', async () => {
    const dom = installDomHarness();
    const face = {
      start: vi.fn().mockRejectedValue('weird rejection'),
      getDebugFrame: vi.fn(() => ({
        landmarks: [],
        blendshapes: {},
        updatedAt: 0,
        status: 'error' as const,
        message: 'Could not start the front camera (weird rejection).',
      })),
    };

    await mountCalibration(
      { mode: 'event', eventId: 'dragon-blast' },
      {
        face: face as unknown as never,
        setRafId: vi.fn(),
        onPlay: vi.fn(),
        onRetry: vi.fn(),
        onBack: vi.fn(),
      },
    );

    expect(JSON.parse(dom.readout.textContent)).toMatchObject({
      details: 'weird rejection',
    });
  });
});
