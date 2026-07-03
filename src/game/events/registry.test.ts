import { describe, expect, it } from 'vitest';
import { eventFactories, eventList } from './registry';

describe('event registry metadata', () => {
  it('exposes the same id/title/description/requiredInputs as the live event instances, without constructing them at module load', () => {
    expect(eventList).toHaveLength(Object.keys(eventFactories).length);

    for (const metadata of eventList) {
      const liveInstance = eventFactories[metadata.id]();

      expect(metadata.title).toBe(liveInstance.title);
      expect(metadata.description).toBe(liveInstance.description);
      expect(metadata.requiredInputs).toEqual(liveInstance.requiredInputs);
    }
  });

  it('does not eagerly instantiate playable event behavior for eventList entries', () => {
    for (const metadata of eventList) {
      expect(() => metadata.init({ now: () => 0 })).toThrow();
      expect(() => metadata.dispose()).toThrow();
    }
  });

  it('still creates real, playable instances via eventFactories', () => {
    for (const id of Object.keys(eventFactories)) {
      const instance = eventFactories[id]();

      expect(() => instance.init({ now: () => 0 })).not.toThrow();
    }
  });
});
