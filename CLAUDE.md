# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server
npm run build      # tsc type-check then Vite production build → dist/
npm run test       # Vitest (run once)
npm run typecheck  # tsc --noEmit only
npm run lint       # ESLint
```

Run a single test file: `npx vitest run src/game/events/events.test.ts`

`tsc` is not on PATH; use `node_modules/.bin/tsc` locally or rely on `npm run build` / `npm run typecheck`.

## Architecture

Single-page DOM app — no game engine. `src/app/main.ts` is the entire app: it owns all screen rendering, the `requestAnimationFrame` play loop, and orchestration between layers. There is no router or component framework.

**Data flow:**
```
FaceInputService (camera + MediaPipe)
  → NormalizedFaceInput  (per-frame face state)
  → CalibrationProfile   (thresholds captured at calibration time)
  → FaceOlympicsEvent.update(deltaMs, input)
  → EventFrameResult     (score, feedback, finished flag)
```

**Layer boundaries** (enforced by convention, not build tooling):
- `src/game/core/types.ts` — all shared interfaces and constants. Everything imports from here; nothing in `core/` imports from other layers.
- `src/game/input/` — camera and MediaPipe only. `FaceInputService` owns `getUserMedia`, the `<video>` element, and the MediaPipe `FaceLandmarker` tick loop.
- `src/game/events/` — pure state machines. Events receive `NormalizedFaceInput`; they never touch the camera, DOM, or storage directly.
- `src/app/main.ts` — wires everything together and owns all DOM mutation.

**Events** implement `FaceOlympicsEvent` (defined in `types.ts`). Lifecycle: `init → start(calibration) → update(delta, input)* → finish → dispose`. Adding an event requires: a class + config file under `src/game/events/<name>/`, and registration in `src/game/events/registry.ts`.

`CalibrationProfile` is passed into `event.start()` and used to compare raw `NormalizedFaceInput` values against calibrated thresholds during `update()`. `DEFAULT_CALIBRATION` and `DEFAULT_INPUT` in `types.ts` are the test-safe constants — use them in unit tests to avoid needing a live camera.

**Deployment:** GitHub Actions builds `dist/` and pushes it to the `gh-pages` branch via `JamesIves/github-pages-deploy-action`. The Vite `base: './'` produces relative asset paths, which is required for GitHub Pages project-page hosting.

## Key constraints

- Events must not access camera APIs or the DOM directly.
- Camera and MediaPipe processing stay in the browser; no video or landmark data is uploaded.
- `main.ts` calls `cancelAnimationFrame` before every screen transition to prevent stale RAF loops.
- `CalibrationProfile` has asymmetric shape: `neutral` stores resting values, `thresholds` stores trigger levels. Keep them separate when extending.
