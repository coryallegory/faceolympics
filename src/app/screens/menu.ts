import type { FaceOlympicsEvent } from '../../game/core/types';
import type { Screen } from '../navigation';
import { button } from '../ui';

export interface MenuScreenOptions {
  events: readonly FaceOlympicsEvent[];
  onSelectEvent: (eventId: string) => void;
  onCameraCheck: () => void;
  onBack: () => void;
}

export function showMenuScreen(options: MenuScreenOptions): Screen {
  return (ctx) => {
    ctx.render('<main class="screen simple"><h2>Pick an Event</h2><p>Choose one short face-controlled challenge.</p><div id="events" class="cards"></div><div id="actions"></div></main>');

    const wrap = ctx.app.querySelector<HTMLDivElement>('#events');
    const actions = ctx.app.querySelector<HTMLDivElement>('#actions');

    for (const event of options.events) {
      const card = button(
        `${event.title}\n${event.description}`,
        () => options.onSelectEvent(event.id),
      );
      card.className = 'card';
      wrap?.append(card);
    }

    actions?.append(
      button('Camera Check', options.onCameraCheck),
      button('Back', options.onBack),
    );
  };
}
