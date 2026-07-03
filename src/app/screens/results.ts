import type { EventResult } from '../../game/core/types';
import { medalLabel } from '../../game/scoring/medals';
import type { Screen } from '../navigation';
import { button } from '../ui';

export interface ResultsScreenOptions {
  result: EventResult;
  onRetry: () => void;
  onEventSelect: () => void;
}

export function showResultsScreen(options: ResultsScreenOptions): Screen {
  return (ctx) => {
    const { result, onRetry, onEventSelect } = options;

    ctx.render(`<main class="screen"><h2>${result.title} Results</h2><div class="medal">${medalLabel(result.medal)}</div><p>${result.summary}</p><p>Score: ${result.score}</p><div id="actions"></div></main>`);

    ctx.app.querySelector<HTMLDivElement>('#actions')?.append(
      button('Retry', onRetry),
      button('Event Select', onEventSelect),
    );
  };
}
