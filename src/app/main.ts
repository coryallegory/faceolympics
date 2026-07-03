import '../styles/main.css';
import type { FaceOlympicsEvent } from '../game/core/types';
import { eventFactories, eventList } from '../game/events/registry';
import { saveResult } from '../game/storage/scores';
import {
  buildCalibrationHtml,
  mountCalibration,
  type CalibrationScreenOptions,
} from './calibration-screen';
import {
  clearCurrentEvent,
  getCurrentEvent,
  getFaceService,
  setCurrentEvent,
} from './app-state';
import { createNavigation, type Screen } from './navigation';
import { showMenuScreen } from './screens/menu';
import { showPlayScreen } from './screens/play';
import { showResultsScreen } from './screens/results';
import { showTitleScreen } from './screens/title';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root');
}

const navigation = createNavigation(app);

function titleScreen(): Screen {
  return showTitleScreen({
    onStart: () => navigation.goTo(menuScreen()),
    onCalibration: () => navigation.goTo(calibrationScreen({ mode: 'landing-test' })),
  });
}

function menuScreen(): Screen {
  return showMenuScreen({
    events: eventList,
    onSelectEvent: (eventId) => {
      void startEvent(eventId);
    },
    onBack: () => navigation.goTo(titleScreen()),
  });
}

function calibrationScreen(options: CalibrationScreenOptions): Screen {
  return async (ctx) => {
    const next = options.eventId ? eventFactories[options.eventId]() : undefined;
    setCurrentEvent(next);

    ctx.render(buildCalibrationHtml(options, next?.title, ctx.buildCode));

    await mountCalibration(options, {
      face: getFaceService(),
      setRafId: ctx.setAnimationFrame,
      onPlay: () => {
        void startCurrentEvent();
      },
      onBack: () => {
        clearCurrentEvent();
        ctx.goTo(options.mode === 'event' ? menuScreen() : titleScreen());
      },
    });
  };
}

async function startEvent(eventId: string): Promise<void> {
  const event = eventFactories[eventId]();
  setCurrentEvent(event);
  await startEventInstance(event);
}

async function startCurrentEvent(): Promise<void> {
  const event = getCurrentEvent();

  if (!event) {
    return;
  }

  await startEventInstance(event);
}

async function startEventInstance(event: FaceOlympicsEvent): Promise<void> {
  await event.init({ now: () => performance.now() });
  void getFaceService().start();
  goToPlay(event);
}

function goToPlay(event: FaceOlympicsEvent): void {
  navigation.goTo(showPlayScreen({
    event,
    face: getFaceService(),
    onExit: () => {
      clearCurrentEvent();
      navigation.goTo(menuScreen());
    },
    onFinish: (finishedEvent) => {
      const result = finishedEvent.finish();
      saveResult(result);
      clearCurrentEvent();
      navigation.goTo(showResultsScreen({
        result,
        onRetry: () => {
          void startEvent(result.eventId);
        },
        onEventSelect: () => navigation.goTo(menuScreen()),
      }));
    },
  }));
}

navigation.goTo(titleScreen());
