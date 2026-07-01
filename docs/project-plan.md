# Face Olympics Initial Project Plan

## Vision

Face Olympics is a portrait-first mobile browser game collection for kids ages 7–12. Players use facial gestures captured by the front-facing camera to control short Olympic-style events. The POC should prove that camera-based input can feel responsive, readable, funny, and safe on mobile browsers.

## POC Goals

- Ship a public GitHub Pages prototype.
- Provide a title/menu flow and event selection.
- Calibrate before each event.
- Implement three starter events with shared contracts.
- Add a debug overlay for face input confidence and thresholds.
- Persist basic scores/medals locally.
- Keep all camera and face processing client-side.

## Recommended Initial Stack

Use TypeScript for maintainability. Start with Vite for a fast browser build and evaluate Phaser for the 2D game/event layer. If Phaser adds unnecessary overhead for the first POC, use canvas/SVG modules behind the same event contract so the rendering approach can evolve later.

Use MediaPipe Face Landmarker first because it is browser-oriented and designed around face landmark detection. Revisit only if mobile performance or required gesture detection is insufficient.

## Initial Event Order

1. Blink-Off
2. Face Weightlifting
3. Dragon Blast

These events cover the core detection families needed by later games: blinks, eyebrows, and mouth gestures.

## Deferred Features

- Cup mode
- Full roster of 15 events
- Unlock achievements
- PWA polish
- Rich audio/voiceover
- Advanced visual effects

## Milestones

### Milestone 1: App Skeleton and Deployment

- Create TypeScript web app scaffold.
- Add portrait mobile layout shell.
- Add GitHub Pages deployment workflow to `gh-pages`.
- Add title/menu/event-selection routes or states.
- Add baseline lint/typecheck/build scripts.

### Milestone 2: Face Input Foundation

- Integrate front-facing camera access.
- Integrate MediaPipe Face Landmarker or chosen equivalent.
- Normalize face inputs into shared primitives.
- Add per-event calibration flow.
- Add picture-in-picture preview and debug overlay.

### Milestone 3: First Playable Event

- Implement Blink-Off using the event contract.
- Add timer, score, medal thresholds, retry flow, and result screen.
- Add tests for event state and scoring logic.

### Milestone 4: Additional POC Events

- Implement Face Weightlifting.
- Implement Dragon Blast.
- Reuse calibration and scoring systems.
- Validate that event modules remain isolated.

### Milestone 5: Polish and Playtest

- Improve mobile readability and touch target sizes.
- Add simple SVG/cartoon visuals and light sound effects if practical.
- Tune thresholds and scoring based on manual playtests.
- Document known device/browser limitations.

## Acceptance Criteria for the POC

- The app runs from GitHub Pages on a modern mobile browser.
- The app requests the front-facing camera and detects face presence.
- The user can select one of three events from a menu.
- Calibration runs before each event.
- Each event can be completed, scored, retried, and exited.
- Bronze/Silver/Gold thresholds are implemented for each event.
- Debug overlay can show normalized face inputs and thresholds.
- No raw camera video, images, or landmark recordings are uploaded to a server.
