# Face Olympics POC Architecture

The POC uses a lightweight TypeScript/Vite app instead of Phaser. The first three events are simple state machines with DOM/SVG-style cartoon presentation, so avoiding a game engine keeps the prototype smaller while preserving the shared event contract for a future engine swap.

## Layers

- `src/app/`: app state, screens, calibration flow, play loop, results, and debug view.
- `src/game/core/`: shared event, input, calibration, score, and result contracts.
- `src/game/input/`: front-camera and MediaPipe Face Landmarker integration plus calibration transforms.
- `src/game/events/`: event-owned config, scoring thresholds, and pure update logic.
- `src/game/scoring/` and `src/game/storage/`: shared medal and local score helpers.

Camera access is front-facing and all MediaPipe processing happens in the browser. The app does not upload video, images, raw landmarks, or biometric templates.
