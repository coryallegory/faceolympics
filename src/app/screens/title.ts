import type { Screen } from '../navigation';
import { button } from '../ui';

export interface TitleScreenOptions {
  onStart: () => void;
  onCalibration: () => void;
}

export function showTitleScreen(options: TitleScreenOptions): Screen {
  return (ctx) => {
    ctx.render('<main class="screen hero"><p class="eyebrow">Camera stays on your device</p><h1>Face Olympics</h1><p>Goofy mini-events controlled by your face.</p><div id="actions"></div></main>');

    ctx.app.querySelector<HTMLDivElement>('#actions')?.append(
      button('Start Playing', options.onStart),
      button('Camera Calibration', options.onCalibration),
    );
  };
}
