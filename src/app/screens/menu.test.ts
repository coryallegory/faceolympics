import { describe, expect, it, vi } from 'vitest';
import type { FaceOlympicsEvent } from '../../game/core/types';

interface FakeButton {
  className: string;
  click: () => void;
  textContent: string;
}

interface FakeContainer {
  children: FakeButton[];
  append: (...nodes: FakeButton[]) => void;
}

const buttonSpy = vi.hoisted(() => vi.fn((label: string, onClick: () => void) => ({
  className: '',
  click: onClick,
  textContent: label,
})));

vi.mock('../ui', () => ({
  button: buttonSpy,
}));

const { showMenuScreen } = await import('./menu');

function createContainer(): FakeContainer {
  return {
    children: [],
    append(...nodes: FakeButton[]) {
      this.children.push(...nodes);
    },
  };
}

function createEvent(id: string): FaceOlympicsEvent {
  return {
    id,
    title: `Event ${id}`,
    description: `Description ${id}`,
    requiredInputs: [],
    init: vi.fn(),
    start: vi.fn(),
    update: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn(),
    dispose: vi.fn(),
  };
}

function createScreenHarness() {
  const events = createContainer();
  const actions = createContainer();
  const nodes = new Map<string, unknown>([
    ['#events', events],
    ['#actions', actions],
  ]);
  const app = {
    querySelector: <T>(selector: string): T | null => (nodes.get(selector) as T | undefined) ?? null,
  };
  const render = vi.fn();

  return {
    actions,
    app: app as unknown as HTMLDivElement,
    events,
    render,
  };
}

describe('showMenuScreen', () => {
  it('renders a Camera Check action and invokes onCameraCheck when selected', () => {
    const harness = createScreenHarness();
    const onCameraCheck = vi.fn();

    showMenuScreen({
      events: [createEvent('blink-off')],
      onSelectEvent: vi.fn(),
      onCameraCheck,
      onBack: vi.fn(),
    })({
      app: harness.app,
      buildCode: 'TEST',
      goTo: vi.fn(),
      render: harness.render,
      setAnimationFrame: vi.fn(),
    });

    expect(harness.actions.children.map((button) => button.textContent)).toEqual([
      'Camera Check',
      'Back',
    ]);

    harness.actions.children[0].click();

    expect(onCameraCheck).toHaveBeenCalledTimes(1);
  });
});
