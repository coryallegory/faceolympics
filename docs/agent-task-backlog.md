# Face Olympics — Task Backlog v2 (parallel-agent edition)

A reviewed, prioritized backlog intended for execution by coding agents working **in parallel,
one PR per task**. Each task states the problem, exact files, the change, verification, and its
dependency edges. Tasks in different tracks touch disjoint files and can run concurrently once
their listed dependencies have merged.

## Decisions already made (do not relitigate in task PRs)

1. **Two-tier input model.** The input layer exposes continuous 0–1 **signals** per facial
   channel (mouth open, brow raise left/right, eye openness left/right, lip pucker, gaze X/Y)
   and derived boolean **triggers** (computed centrally from signals + thresholds + hysteresis).
   Events consume `{ signals, triggers }`. No more booleans baked inside the camera service.
2. **No calibration wizard.** Blink, mouth-open, and lip-purse use fixed default thresholds
   (their blendshapes are near-bimodal across people). Brow and gaze channels use **adaptive
   range normalization** (decayed rolling low/high percentiles) with guardrails, seeded by an
   optional 2-second "raise your brows" quick-tune. No multi-step calibration ceremony.
3. **Boot flow:** app start → title → event menu directly; the camera does NOT start at
   launch. Every event start passes through a **Get Ready gate** (camera start → tracker
   ready → face present → 3-2-1 countdown) so no event clock runs before input works. A
   **Camera Check** screen (preview, overlay, trigger console, brow quick-tune) is a menu
   item for diagnostics — it is not required to play. Persisted tuning is restored on boot.
4. **Gaze:** coarse directions only (look left/right/up/down) from MediaPipe `eyeLook*`
   blendshapes. No screen-point gaze estimation.
5. **No identity features.** No face recognition, no stored embeddings, no per-person biometric
   templates. Adaptive normalization handles a new player sitting down. Named profiles may come
   later for scores only.
6. **Privacy invariant (from CLAUDE.md):** camera frames and landmark data never leave the
   browser. New code must not add network calls carrying face-derived data.

## Ground rules for executing agents

- Read `CLAUDE.md` first. Layer rules: events (`src/game/events/`) never touch DOM/camera/
  storage; shared types live in `src/game/core/types.ts`; only `src/app/` touches the DOM.
- One task = one branch = one PR, titled with the task ID (e.g. `P0.2: extract screen modules`).
- Before opening the PR run: `npm run typecheck`, `npm run test`, `npm run lint` — all green.
- Touch only files inside your task's track ownership (see matrix below) plus files the task
  explicitly lists. If you believe you must edit another track's files, stop and flag it in the
  PR description instead of doing it.
- `src/game/core/types.ts` is a **contract file**: only Phase 0 tasks may change it. Everything
  else consumes it read-only.
- Camera/MediaPipe behavior cannot run in unit tests. Correctness for input code is established
  by testing the pure modules (mapper, trigger engine, adaptive tracker). Do not mock MediaPipe.
- Before writing a `needs-human-check` task's manual verification steps, confirm the screen is
  actually reachable via current navigation (check `main.ts`'s wiring, not just that the file
  exists) — A5 (#58) wrote steps for "Menu → Camera Check" before B2 had wired that menu entry
  in, which produced a false-negative manual-test result (issue #17) that took real
  investigation to root-cause. If the screen isn't reachable yet, say so in the task/PR instead
  of writing steps around it.

## Execution & validation protocol

- **Spec vs. state.** This document is the immutable spec. Execution state lives in GitHub
  Issues: one issue per task (title `<ID>: <task name>`, body copied from this doc, labels
  `track:<letter>`, `wave:<n>`, and `needs-human-check` when the task's Verify section includes
  manual camera steps). PRs reference their issue with `Closes #<n>`. Only the PM — the repo
  owner, or an agent they designate — creates or updates issues. Nobody edits this doc to
  record progress — status-in-doc guarantees merge conflicts across parallel branches.
  (Human-PM operation is described in `docs/execution-runbook.md`.)
- **Validation plan first.** Before writing implementation code, the assigned agent writes the
  task's validation plan — unit tests to be added (names + what each asserts), commands to run,
  manual steps with expected observations — as the opening section of the PR description (open
  a draft PR early, or put it in the first commit message). Implementation follows the plan;
  deviations must be explained in the PR.
- **PR requirements.** Every PR contains: task ID + `Closes #<issue>`; the validation plan;
  pasted output of `npm run typecheck`, `npm test`, `npm run lint`; and for tasks with manual
  camera steps, the `needs-human-check` label. A PR missing any of these is not mergeable.
- **Human verification queue.** Agents cannot blink at a webcam. PRs labeled
  `needs-human-check` wait for the repo owner to verify via the per-PR preview deployment (E2)
  or locally, then comment approval. E1 and E2 must merge before wave 1 so this queue works.
- **Isolation.** Each implementation agent works on branch `task/<id>` in its own git worktree.
  Rebase onto `main` before marking the PR ready. Never push to `main` directly.
- **Merge authority.** The repo owner merges Phase −1/0 PRs personally. Wave-task PRs may be
  merged by the PM only when CI is green, a review pass found no correctness issues, and no
  `needs-human-check` label is pending (and only if the owner has granted merge authority).
- **Escalation.** If completing a task appears to require editing another track's files or
  changing `src/game/core/types.ts`, the agent stops and reports in the PR/issue; the PM
  escalates to the repo owner rather than improvising a contract change.

## Track / file-ownership matrix

| Track | Owns | Agent-parallel with |
|---|---|---|
| P0 (contracts) | `src/game/core/types.ts`, `src/app/` restructure | nothing — serial, merges first |
| A — Input pipeline | `src/game/input/**` | B, C, D, E, F |
| B — Camera Check & boot wiring | `src/app/screens/camera-check.ts`, boot/menu wiring, `src/app/calibration-screen.ts` (until deleted) | A, C, D, E, F |
| C — Storage | `src/game/storage/**` | A, B, D, E, F |
| D — Events & play screen | `src/game/events/**`, `src/app/screens/play.ts`, `src/app/screens/results.ts` | A, B, C, E, F |
| E — CI/deployment | `.github/**` | everything |
| F — Cross-cutting quality | listed per task | see task notes |

Dependency notation: **Depends:** must be merged first. **Blocks:** listed for convenience.
Tasks with no Depends line can start immediately after Phase 0 (or immediately, where noted).

Priorities: **P1** correctness, **P2** robustness/quality, **P3** polish.

---

## Phase −1 — Pre-contract cleanup (serial, do before everything)

### F1 (P2). Reformat the single-line source files

- **Files:** `src/game/core/types.ts`, `src/game/events/registry.ts`, the three event classes
  under `src/game/events/*/`, `src/game/events/*/*.config.ts`, `src/game/scoring/medals.ts`,
  `src/game/storage/scores.ts`, `src/game/events/events.test.ts`
- **Problem:** These files are single, extremely long lines (whole classes on one line). Every
  subsequent PR that touches them would produce unreviewable diffs.
- **Change:** Reformat only these files to match `src/app/main.ts` style (2-space indent, one
  statement per line, single quotes, semicolons). No logic or rename changes. No Prettier
  config.
- **Blocks:** all Phase 0+ work (merge this first so later diffs are readable).
- **Verify:** typecheck/test/lint green; `git diff --stat` shows only listed files.

## Phase 0 — Contract tasks (serial: P0.1 then P0.2)

### P0.1 (P1). Input model v2 in `types.ts`

- **Files:** `src/game/core/types.ts` only.
- **Change:** Add, alongside the existing types (do not delete anything yet):

  ```ts
  export interface FaceSignals {
    facePresent: boolean;
    confidence: number;          // tracker confidence 0–1
    mouthOpen: number;           // 0–1
    lipPucker: number;           // 0–1
    browRaiseLeft: number;       // 0–1, subject's anatomical left
    browRaiseRight: number;
    eyeOpenLeft: number;         // 1 = fully open, 0 = closed (subject's left)
    eyeOpenRight: number;
    gazeX: number;               // -1..1, positive = gaze moves right on the MIRRORED preview
    gazeY: number;               // -1..1, positive = looking up
  }
  export interface FaceTriggers {
    blinkLeft: boolean; blinkRight: boolean; bothEyesClosed: boolean;
    mouthOpen: boolean; lipsPursed: boolean;
    browsRaised: boolean; browLeftRaised: boolean; browRightRaised: boolean;
    lookLeft: boolean; lookRight: boolean; lookUp: boolean; lookDown: boolean;
  }
  export interface EventInput { signals: FaceSignals; triggers: FaceTriggers; }
  export interface TriggerThresholds {   // fixed defaults; hysteresis applied by engine
    eyeClosed: number;       // eyeOpen falls below → blink; reopen at eyeClosed + gap
    mouthOpen: number; lipPucker: number;
    browRaised: number;      // applied to ADAPTIVELY NORMALIZED brow signal
    gaze: number;            // |gazeX|/|gazeY| above → look trigger
    hysteresisGap: number;   // e.g. 0.15
  }
  export const DEFAULT_THRESHOLDS: TriggerThresholds = {
    eyeClosed: 0.45, mouthOpen: 0.45, lipPucker: 0.5,
    browRaised: 0.6, gaze: 0.4, hysteresisGap: 0.15,
  };
  export const DEFAULT_SIGNALS: FaceSignals = { /* neutral values, eyes open = 1 */ };
  export const DEFAULT_TRIGGERS: FaceTriggers = { /* all false */ };
  export const DEFAULT_EVENT_INPUT: EventInput = { signals: DEFAULT_SIGNALS, triggers: DEFAULT_TRIGGERS };
  ```

  Also add a transitional event interface so events can migrate incrementally:
  `update(deltaMs, input: EventInput)` — define `FaceOlympicsEventV2` extending the existing
  shape but with the new `update` signature, or (simpler, preferred) change
  `FaceOlympicsEvent.update` to take `EventInput` and update the three event classes and
  `events.test.ts` mechanically in this same PR (map old fields: `bothEyesClosed` →
  `triggers.bothEyesClosed`, `mouthOpen` number → `signals.mouthOpen`, `eyebrowsRaised` →
  `max(signals.browRaiseLeft, browRaiseRight)` for now, `lipsPursed` → `triggers.lipsPursed`).
  Keep `NormalizedFaceInput`, `CalibrationProfile`, `DEFAULT_INPUT`, `DEFAULT_CALIBRATION`
  exported and marked `/** @deprecated remove in A4/B2 */` so untouched code still compiles.
  Drop `headRoll` from nothing yet — it dies with `NormalizedFaceInput` later.
- **Verify:** typecheck/test/lint green. Event tests updated to build `EventInput` fixtures
  from `DEFAULT_EVENT_INPUT`.

### P0.2 (P1). Extract screens from `main.ts`; navigation + app-state modules

- **Files:** `src/app/main.ts`, new `src/app/navigation.ts`, `src/app/app-state.ts`,
  `src/app/ui.ts`, `src/app/screens/{title,menu,play,results}.ts`
  (`calibration-screen.ts` stays put for now — Track B owns its replacement).
- **Problem:** `main.ts` owns every screen; parallel agents editing it will conflict on every
  PR. Also (fold in these existing bugs while moving the code):
  - `event.init(context)` is never called despite being in the documented lifecycle.
  - "Pause / Exit" abandons the current event without `dispose()`; `startEvent` overwrites
    `current` without disposing.
  - The play loop rebuilds `#arena` `innerHTML` and re-serializes debug JSON at 60 Hz — render
    the skeleton once, cache nodes, update `textContent` only; update the debug pane only when
    its `<details>` is open.
- **Change:** `navigation.ts` exposes `goTo(screen: (ctx) => void)` and owns
  `cancelAnimationFrame` on every transition (current `render()` behavior) plus the build-stamp
  suffix. `app-state.ts` holds what are now module-level lets (`current`, tuning state, the
  shared `FaceInputService` instance). `ui.ts` gets the shared `button()` helper. Each screen
  module exports one `show(...)` function. `main.ts` shrinks to imports + boot call.
  Behavior must be pixel-identical; this is a move, not a redesign (except the three folded
  fixes above).
- **Depends:** F1, P0.1.
- **Verify:** typecheck/test/lint green; manual smoke test (bottom of doc) passes.

### P0.3 (P2). Remove deprecated legacy-input members from `types.ts`

- **Files:** `src/game/core/types.ts` only.
- **Problem:** A4 introduced the new signals/triggers pipeline but, to stay unblocked, deferred
  deleting the deprecated `NormalizedFaceInput`, `CalibrationProfile`, `DEFAULT_INPUT`,
  `DEFAULT_CALIBRATION` exports — they were still referenced (`play.ts`'s temporary bridge, and
  the three event classes' `start(calibration)` signature) at the time A4 merged. Leaving them
  in place indefinitely is tech debt in a contract file.
- **Change:** delete the four deprecated exports and their `@deprecated` jsdoc. Before deleting,
  grep the repo for any remaining references — there should be none once B2 and D1 have merged;
  if any remain, stop and flag rather than deleting a still-used type (that means one of B2/D1
  didn't fully migrate).
- **Depends:** A4, B2, D1 (all three — D1 removes the last consumer of `CalibrationProfile` via
  `event.start()`; B2 is the doc's original sequencing choice, confirm no residual references
  before deleting).
- **Verify:** typecheck/test/lint green; `git grep` for the four removed names outside `types.ts`
  returns nothing.

---

## Track A — Input pipeline (owns `src/game/input/**`)

### A1 (P1). Pure mapper: MediaPipe result → `FaceSignals`

- **Files:** new `src/game/input/face/signal-mapper.ts` + test; `FaceInputService.ts` trimmed.
- **Problem:** The blendshape→input logic (including the anatomical left/right swap — MediaPipe
  "Left" means image-left = subject's right, see comment in `FaceInputService.tick()` — and
  blink handling) sits untested inside the camera loop. It has regressed before (commits
  `35015bd`, `b650435`).
- **Change:** `mapToSignals(blendshapes: Record<string, number>, landmarks): FaceSignals`.
  Pure; no state. Mapping: `mouthOpen` = jawOpen; `lipPucker` = mouthPucker;
  `eyeOpenLeft` = 1 − eyeBlink(image-Right) (swap!); brow channels combine blendshape + the
  existing geometry estimate via `brow-metrics.ts` (swap applies); gaze from `eyeLook*`:
  `gazeY = mean(lookUp both eyes) − mean(lookDown both eyes)`, `gazeX` analogous from
  lookIn/lookOut resolved per eye to the mirrored-screen convention in `types.ts` — pin the
  convention with tests, e.g. "subject looks toward their own left ⇒ gazeX is negative/positive
  per the declared convention" (pick one, document it, test it).
- **Tests (one `it` each):** left/right blink swap both directions; brow swap; gaze up, down,
  left, right; empty blendshapes → neutral signals, no NaN; missing landmarks → geometry
  contribution is 0.
- **Depends:** P0.1. **Blocks:** A2, A3, A4.
- **Verify:** `npm run test`.

### A2 (P1). Pure trigger engine with hysteresis

- **Files:** new `src/game/input/face/trigger-engine.ts` + test.
- **Change:** `class TriggerEngine { constructor(thresholds: TriggerThresholds); update(signals: FaceSignals): FaceTriggers }`
  (or a pure `(state, signals) → [state, triggers]` function). Every boolean crosses its
  threshold going active and releases at `threshold − hysteresisGap`. Blink = eyeOpen falling
  below `eyeClosed`. `browsRaised` uses `max(browRaiseLeft, browRaiseRight)` **after** adaptive
  normalization (engine receives already-normalized brow values; see A3). Look triggers from
  |gazeX|/|gazeY| vs `thresholds.gaze` with the same hysteresis.
- **Tests:** hysteresis sequences per channel (rise → hold in dead zone → release below gap);
  both-eyes-closed requires both.
- **Depends:** P0.1 (parallel-safe with A1). **Blocks:** A4.

### A3 (P2). Adaptive range normalizer for brow and gaze channels

- **Files:** new `src/game/input/face/adaptive-range.ts` + test.
- **Change:** `class AdaptiveRange` tracking decayed rolling low/high estimates of a scalar
  stream; `normalize(x)` returns `(x − low)/(high − low)` clamped 0–1. Guardrails:
  1. Until observed span `high − low` exceeds a minimum (e.g. 0.15), return the raw value —
     fixed defaults still work during cold start.
  2. Low/high decay toward the running mean with a time constant of ~60 s, so a new player or
     changed lighting re-tunes within a minute.
  3. `seed(low, high)` to load persisted state or the quick-tune result (B3).
  Keep it dependency-free and time-driven by a `deltaMs` argument (no `Date.now()` inside) so
  tests are deterministic.
- **Tests:** synthetic streams — constant input never triggers normalization (guardrail 1);
  step pattern converges; person-swap simulation (range shifts) re-converges; seed respected.
- **Depends:** P0.1 (parallel-safe with A1/A2). **Blocks:** A4.

### A4 (P1). Rewire `FaceInputService` to signals/triggers; retire the old pipeline

- **Files:** `src/game/input/face/FaceInputService.ts`, `src/app/screens/play.ts`,
  `src/app/calibration-screen.ts`, `src/game/input/calibration/` (delete). Also covers narrow,
  forced call-site updates in any other file whose function signature changes as a direct,
  non-design-decision consequence of retiring `CalibrationProfile` (e.g. `src/app/face-overlay.ts`,
  `src/app/screens/camera-check.ts` — precedent set and owner-ratified in A4's own PR review;
  if an edit requires a judgment call on another track's behalf rather than a mechanical type
  fixup, stop and escalate instead).
- **Change:** `tick()` = detect → `mapToSignals` → adaptive-normalize brow/gaze → `TriggerEngine`
  → store. Public API: `getEventInput(): EventInput`, `getSignals()`, `getDebugFrame()`,
  `setDebugInput(patch)` reworked to patch signals. Remove `getInput()`/`NormalizedFaceInput`
  usage everywhere; delete `calibration.ts` and `CalibrationProfile` plumbing
  (`main.ts`/`app-state.ts` keep only `TriggerThresholds` + adaptive state). `play.ts` may keep a
  clearly-marked temporary bridge back to the legacy `NormalizedFaceInput`/`CalibrationProfile`
  shape for the three still-unmigrated event classes — **do not** delete
  `src/game/core/types.ts`'s deprecated members in this task; that's split out as **P0.3** since
  it can't land until D1 stops passing `CalibrationProfile` into `event.start()`.
- **Depends:** A1, A2, A3, P0.2. **Blocks:** B2, B3, B4, D1, P0.3.
- **Verify:** typecheck/test/lint; manual smoke test — triggers fire on the camera-test screen.

### A5 (P1). Handle camera-permission failure at the service boundary

- **Files:** `FaceInputService.ts` (report state), plus the screens that call `face.start()`
  (Track B Camera Check screen; the play screen's Get Ready gate, D4).
- **Problem:** A denied `getUserMedia` is an unhandled rejection; calibration/camera screens
  hang on "Starting front camera…".
- **Change:** `start()` failures set `debugFrame.status = 'error'` with a friendly message and
  reject; callers catch: Camera Check shows the error + Retry button (B1); the Get Ready gate
  shows it and offers Retry / "play anyway with debug controls" (D4). This task delivers the
  service-side behavior + a shared user-facing message; B1 and D4 consume it.
- **Depends:** P0.2. **Blocks:** D4 error path; coordinate with B1 (shared screen file) —
  same agent or sequenced.
- **Verify:** block camera permission in Chrome; both screens degrade gracefully.

### A6 (P2). Camera lifecycle: release on title, clean restart

- **Files:** `FaceInputService.ts`, `src/app/screens/title.ts`.
- **Problem:** `face.stop()` is never called (camera light stays on all session); `stop()`
  doesn't pause the video, clear `srcObject`, or halt/restart the tick loop; landmarker is
  never closed.
- **Change:** `stop()` also pauses video, nulls `srcObject`, sets `running = false`;
  `scheduleTick`/`tick` no-op when not running; `start()` resumes ticking if the landmarker is
  already loaded. Title screen calls `face.stop()` on show.
- **Depends:** A4. **Verify:** camera light off on title, tracking resumes on re-entry.

### A7 (P2). Pin the MediaPipe model version; optional self-hosting

- **Files:** `FaceInputService.ts` (`createLandmarker`), optionally
  `scripts/copy-mediapipe-assets.mjs`.
- **Problem:** model URL uses `.../float16/latest/face_landmarker.task` — unpinned third-party
  runtime dependency; app breaks offline despite self-hosted WASM.
- **Change:** replace `latest` with a pinned version segment (verify the URL returns 200
  before committing). Optionally extend the copy script to download-and-cache the `.task` into
  `public/mediapipe/models/` and prefer the local URL with the pinned CDN as fallback
  (mirroring the existing WASM local→CDN pattern).
- **Depends:** none (can start immediately). **Verify:** tracker reaches TRACKING in dev.

### A8 (P3). Head-pose compensation for brow geometry

- **Files:** `FaceInputService.ts`, `brow-metrics.ts`.
- **Change:** enable `outputFacialTransformationMatrixes`, derive pitch, and correct the
  brow–eye gap in `browLiftFromGeometry` for head pitch so nodding doesn't read as brow motion.
  Only worth doing if manual testing shows pitch artifacts after A3 lands.
- **Depends:** A4.

### A9 (P1). Expose tuning seed/snapshot API on `FaceInputService`

- **Files:** `src/game/input/face/FaceInputService.ts`, and `trigger-engine.ts` only if a
  thresholds setter turns out to be the cleaner option there (see Change).
- **Problem:** B2 needs to seed persisted tuning (a `TuningState` from C3's `loadTuning()`) into
  the running `FaceInputService` on boot, and read the current tuning back out to persist on
  results / when leaving Camera Check. Today the service's four `AdaptiveRange` fields
  (`adaptiveBrowLeft`, `adaptiveBrowRight`, `adaptiveGazeX`, `adaptiveGazeY`) and its
  `TriggerEngine` (constructed once with the hardcoded `DEFAULT_THRESHOLDS`) are `private
  readonly`, with no way for a caller to seed or read them. B2's implementer correctly stopped
  rather than edit a Track A file outside its ownership — see issue #22's blocked comment for
  the full analysis.
- **Change:** add two public methods to `FaceInputService`:
  - `seedTuning(state: TuningState): void` — calls `.seed(low, high)` (already exists on
    `AdaptiveRange`) on each of the four adaptive fields from `state.adaptive`, and applies
    `state.thresholds` to the trigger engine — simplest is replacing `this.triggerEngine` with
    `new TriggerEngine(state.thresholds)` rather than adding a setter to `TriggerEngine`, unless
    that proves awkward against `TriggerEngine`'s current internal `triggers` state.
  - `getTuningSnapshot(): TuningState` — reads `{low, high}` back from each `AdaptiveRange`'s
    existing `snapshot()` method, plus the currently-active `TriggerThresholds` (store whatever
    thresholds were last applied in a field, since `TriggerEngine` doesn't expose them back out).
- **Depends:** A4 (merged). **Blocks:** B2.
- **Verify:** unit test — `seedTuning()` followed by `getTuningSnapshot()` round-trips the
  per-channel low/high and thresholds; a freshly seeded `AdaptiveRange` channel no longer
  behaves as cold-start for a value inside the seeded span (i.e. `normalize()` remaps it instead
  of passing the raw value through, per `AdaptiveRange`'s existing guardrail behavior).

---

## Track B — Camera Check & boot wiring (owns `src/app/screens/camera-check.ts`, menu/boot wiring)

### B1 (P1). Camera Check screen (menu-accessible diagnostic)

- **Files:** new `src/app/screens/camera-check.ts`; reuse/absorb `calibration-screen.ts` +
  `face-overlay.ts` rendering (overlay canvas, tracker status panel, trigger console, readout).
- **Change:** A diagnostic screen — reached from a "Camera Check" button on the event menu,
  NOT part of the launch flow — showing the mirrored preview + overlay, tracker status, and the
  live trigger console (as today), plus a Back button. Starting it triggers the camera
  permission prompt if not yet granted; a denied/failed camera shows the friendly error from
  A5 with a Retry button. Delete the old save/reset calibration buttons; delete
  `calibration-screen.ts` once nothing imports it.
- **Depends:** P0.2. (Can be built against the old `getInput()` API before A4 lands; the
  trigger-console rewrite to signals/triggers is B4.)
- **Verify:** manual smoke test step 5.

### B2 (P1). Boot wiring + persisted tuning

- **Files:** `src/app/main.ts` / `navigation.ts` boot wiring, `app-state.ts`,
  `src/app/screens/menu.ts` (adding the Camera Check entry — coordinate with Track D if
  concurrent).
- **Change:** Boot goes title → menu with no camera start. On boot, load persisted tuning
  (thresholds + adaptive-range seeds) via Track C's C3 API and `seed()` the service — using
  A9's `seedTuning()`/`getTuningSnapshot()`, not by reaching into `FaceInputService`'s private
  state; save tuning state on results and when leaving Camera Check. Add the "Camera Check"
  menu button.
- **Depends:** B1, A4, C3, A9 (blocked without it — `FaceInputService` had no public API to
  seed/read adaptive-range or threshold state; see issue #22). **Verify:** reload restores
  tuning (inspect localStorage); no permission prompt appears until an event or Camera Check is
  opened.

### B3 (P2). Brow quick-tune

- **Files:** `camera-check.ts`.
- **Change:** A "Tune eyebrows (2 s)" button on the Camera Check screen: prompt "raise your
  eyebrows as high as you can", sample brow signals for ~2 s (~20 samples), take the p90 as
  `high` and the pre-prompt resting p50 as `low`, call `AdaptiveRange.seed()` for both brow
  channels, log to the trigger console. Validation: if `high − low < 0.15`, show "couldn't
  detect a clear raise — try again" and don't seed.
- **Depends:** B2. **Verify:** manual — after tuning, `browsRaised` trigger fires on a modest
  raise.

### B4 (P2). Trigger console/readout on the new input model

- **Files:** `camera-check.ts`.
- **Change:** console lists exactly the `FaceTriggers` keys; readout shows
  `{ signals, thresholds, adaptive: {low, high} per channel }` instead of the old
  input/thresholds/blendshapes dump (keep blendshapes behind the existing details toggle).
- **Depends:** B1, A4.

---

## Track C — Storage (owns `src/game/storage/**`)

### C1 (P1). Harden `loadResults` against corrupt localStorage

- **Files:** `src/game/storage/scores.ts`, new `scores.test.ts`.
- **Problem:** bare `JSON.parse` — corrupt storage throws inside the results screen.
- **Change:** try/catch → `[]`; filter entries to objects with string `eventId` and numeric
  `score`. Tests stub `globalThis.localStorage` with a Map-backed object.
- **Depends:** F1 only. Can start immediately after F1. **Blocks:** C2.

### C2 (P1). Keep personal-best results

- **Files:** `scores.ts`, `scores.test.ts`.
- **Problem:** `saveResult` replaces the stored result per event — a bad retry erases a gold run.
- **Change:** keep the higher score. Tests: 100 then 50 → 100; 100 then 150 → 150.
- **Depends:** C1.

### C3 (P1). Tuning persistence API

- **Files:** new `src/game/storage/tuning.ts` + test.
- **Change:** `saveTuning(state)` / `loadTuning(): TuningState | null` under a versioned key
  (`face-olympics-tuning-v1`), where `TuningState = { thresholds: TriggerThresholds, adaptive: Record<channel, {low, high}> }`.
  Same corrupt-data hardening as C1. Pure storage module — Track B consumes it.
- **Depends:** P0.1. **Blocks:** B2.

---

## Track D — Events & play/results screens (owns `src/game/events/**`, `screens/play.ts`, `screens/results.ts`)

### D1 (P1). Events consume triggers (drop remaining raw-threshold hacks)

- **Files:** the three event classes, `events.test.ts`, `src/app/screens/play.ts`.
- **Problem:** After P0.1's mechanical migration, Dragon Blast still compares
  `signals.mouthOpen > 0.55` and Weightlifting still applies its own brow threshold — both
  should use `triggers.mouthOpen` / `triggers.browsRaised` so hysteresis and adaptive
  normalization apply uniformly. `start(calibration)` parameters become vestigial. A4 also left a
  temporary `toLegacyInput`/`DEFAULT_CALIBRATION` bridge in `play.ts` so it could keep driving
  events through the old `NormalizedFaceInput` shape until this task lands.
- **Change:** switch both to triggers; change `start()` signature per whatever P0.1/A4 left
  (target: `start(): void`), taking `EventInput` directly. Blink-Off already uses
  `triggers.bothEyesClosed` post-P0.1. Remove `play.ts`'s `toLegacyInput` bridge and call
  `event.start()`/`event.update()` with `getEventInput()`'s result directly — this is what
  actually retires the bridge, not just a follow-on cleanup.
- **Depends:** P0.1, A4. **Blocks:** P0.3. **Verify:** updated unit tests drive events purely via
  `EventInput` fixtures; `git grep toLegacyInput` returns nothing.

### D2 (P2). Broaden event tests

- **Files:** `events.test.ts`.
- **Cases:** Blink-Off face-absent penalty and `maxMs` auto-finish; Dragon Blast purse-release
  scores only when charge ≥ `chargeToHit`; Weightlifting blink drops the bar / halts hold
  accrual; medal boundary tests for `medalForScore` (new `src/game/scoring/medals.test.ts` —
  scoring dir is unowned, coordinate title in PR).
- **Depends:** D1.

### D3 (P2). Clamp frame delta (background-tab jump)

- **Files:** `screens/play.ts`.
- **Problem:** returning from a hidden tab delivers one huge `deltaMs`, instantly ending timed
  events.
- **Change:** `delta = Math.min(rawDelta, 100)` in the loop.
- **Depends:** P0.2. **Verify:** hide tab 10 s during Blink-Off; run survives.

### D4 (P1). Get Ready gate + countdown on event start

- **Files:** `screens/play.ts`.
- **Problem:** Today `startEvent` fires `void face.start()` and the event clock runs
  immediately — the first play happens during the permission prompt, MediaPipe load, and face
  acquisition, so timed events (Blink-Off especially) are over before input works.
- **Change:** entering an event renders the play screen in a "Get Ready" state:
  1. `await face.start()`; on failure show the A5 error message with a Retry button and an
     "open Camera Check" link — do not start the event.
  2. Show "Looking for your face…" until the tracker status is `tracking` and a face is
     present (timeout after ~10 s → offer "play anyway with debug controls").
  3. Then a ~3-2-1 countdown (~1 s per step) in the arena, then `event.start()` and the loop.
  Navigating away at any stage must cancel pending timers/awaits (token check or a cleanup
  hook from `navigation.ts`). Repeat plays with a warm camera should pass steps 1–2
  near-instantly.
- **Depends:** P0.2, D3, A5 (error surface). **Verify:** manual smoke test step 2; with
  camera blocked, the gate shows the error instead of starting the event.

### D5 (P3). Registry metadata without live instances

- **Files:** `src/game/events/registry.ts`.
- **Problem:** `eventList` instantiates three event objects at module load just for
  id/title/description.
- **Change:** export plain metadata objects with the same shape; keep `eventFactories`.
- **Depends:** F1.

### D6 (P3, optional). Coarse-gaze demo event

- **Files:** new `src/game/events/look-out/` + registry entry.
- **Change:** a simple 30 s event using `triggers.lookLeft/lookRight` (e.g. dodge left/right on
  cue; score = correct dodges) to validate the gaze channel end-to-end. Config + medals file
  matching existing event structure; unit tests via `EventInput` fixtures.
- **Depends:** D1.

---

## Track E — CI/deployment (owns `.github/**`; can start immediately)

### E1 (P1). Run lint + tests in CI before deploy

- **Files:** the deploy workflow under `.github/workflows/`.
- **Problem:** workflow is `npm ci → build → deploy`; tests and lint never run in CI, so broken
  code ships to Pages. Critical given the PR-per-task workflow this backlog assumes.
- **Change:** add `- run: npm run lint` and `- run: npm test` after `npm ci`.

### E2 (P1). Per-PR preview folders; skip forks

- **Files:** same workflow.
- **Problem:** every PR deploys to the same `pr/` folder with `clean: false` — parallel PRs
  (this whole plan) clobber each other's previews; fork PRs fail on missing write permission.
- **Change:** `target-folder: pr/${{ github.event.number }}`; gate the step with
  `github.event.pull_request.head.repo.full_name == github.repository`.
- **Verify:** two open PRs deploy to distinct `pr/<n>` folders.

### E3 (P3, optional). Automated browser smoke test with a fake camera

- **Files:** new `e2e/` directory (Playwright config + one spec), `package.json` devDeps and an
  `npm run e2e` script, a CI step after E1's test step, `e2e/fixtures/face.y4m`.
- **Rationale:** most manual smoke-test steps exist only because agents can't produce a live
  face. Chromium can fake one: launch with `--use-fake-device-for-media-stream` and
  `--use-file-for-fake-video-capture=e2e/fixtures/face.y4m`, where the fixture is a short
  (~5 s, low-res) clip of a face — MediaPipe will track it like a real camera.
- **Change:** one Playwright spec asserting: menu renders without a permission prompt; entering
  Blink-Off passes the Get Ready gate (tracker reaches tracking, countdown appears, event clock
  starts); Camera Check shows TRACKING status. Grant camera permission via Playwright's
  `context.grantPermissions(['camera'])`.
- **Constraint:** the fixture clip must be supplied or approved by the repo owner (their own
  face or a synthetic one — do NOT download a stranger's face). Keep it small (< 2 MB, 320×240);
  note in the PR if Git LFS seems warranted.
- **Depends:** D4, E1, owner-supplied fixture. **Payoff:** clears the `needs-human-check` label
  from most subsequent PRs' basic camera verification.

---

## Track F — Cross-cutting quality

### F1 — see Phase −1 (reformat; first PR of all).

### F2 (P3). Injected build id instead of hand-bumped `BUILD_CODE`

- **Files:** `vite.config.ts`, ambient d.ts under `src/`, `navigation.ts` (post-P0.2 home of
  the build stamp).
- **Change:** Vite `define` injects `__BUILD_ID__` (short git hash via `execSync`, try/catch →
  `'dev'`); stamp renders it.
- **Depends:** P0.2.

### F3 (P3). Confidence semantics

- **Files:** `signal-mapper.ts`.
- **Problem (carried from v1 review):** old code reported `max(all blendshape scores)` as
  "confidence" — any strong expression maxed it out. When writing A1, set
  `signals.confidence` from the landmarker's actual detection presence (or a fixed value with a
  TODO) rather than reproducing that bug. This is a checklist item for A1's reviewer, not a
  separate PR.

### F4 (P1). Preview folders on gh-pages get deleted by every production deploy

- **Files:** `.github/workflows/deploy.yml`.
- **Problem:** the "Deploy production site" step doesn't set `clean-exclude`, so its default
  `clean: true` deletes anything on `gh-pages` not in the new `dist/` — including every
  `pr/<n>/` folder E2 creates. Confirmed: the D1 merge deleted `pr/53`, `pr/56`, and `pr/58`
  in one commit, which turned a correct fix (A5, PR #58) into an apparent manual-test
  failure (issue #17) because the preview a reviewer needed had already been wiped by an
  unrelated merge.
- **Change:** add `clean-exclude: pr` to the production deploy step. Per-PR previews are
  unaffected (already `clean: false`).
- **Depends:** none. **Verify:** a `pr/<n>/` folder from a still-open PR survives a
  subsequent merge to main.

### F5 (P1). `calibration-screen.ts` has no camera-start error handling

- **Files:** `src/app/calibration-screen.ts` (`mountCalibration`), `src/app/main.ts`
  (wiring only).
- **Problem:** A5 (#58) fixed the unhandled-`getUserMedia`-rejection bug in
  `camera-check.ts`, but `calibration-screen.ts`'s `mountCalibration` has the identical gap
  and was out of A5's file ownership. It's reachable directly from the title screen's
  "Camera Calibration" button — the more likely thing a tester clicks first — which is what
  caused the false-negative manual-test report on A5/#58 (see #17).
- **Change:** mirror A5/camera-check.ts's fix — try/catch around `face.start()`, read
  `getDebugFrame().message`, show a Retry action, guard against writing to a torn-down
  screen if the user navigates away mid-await.
- **Depends:** none. **Note for future cleanup:** per Decisions-already-made #2 ("no
  calibration wizard") and B1's original intent to delete this file once nothing imports
  it — once B2/D4 land and make this screen fully redundant, prefer deleting the title
  screen's "Camera Calibration" entry and this file over maintaining it further.
- **Verify:** deny camera permission via Title → Camera Calibration; screen shows the
  friendly error + Retry instead of hanging.

---

## Execution schedule (what can run when)

```
Serial spine:   F1 ──▶ P0.1 ──▶ P0.2
                                  │
Parallel wave 1 (after P0.2):     ├─▶ A1, A2, A3   (Track A, one agent or three)
  E1, E2 (anytime, even before)   ├─▶ B1
  A7 (anytime)                    ├─▶ C1 ─▶ C2 ; C3
                                  └─▶ D3, D5
Wave 2:         A1+A2+A3 ─▶ A4 ─▶ { A5*, A6, B2 (also needs C3), B4, D1 }
                A5 + D3 ─▶ D4 (Get Ready gate — P1, schedule early in wave 2/3)
Wave 3:         B2 ─▶ B3 ;  D1 ─▶ D2, D6 ;  F2, A8 anytime after deps
*A5 shares camera-check.ts with B1/B4 — same agent or sequence within Track B's queue.
```

## Manual smoke test (referenced by tasks)

1. `npm run dev`, open in Chrome.
2. Title → Start → menu appears with NO camera permission prompt. Pick an event: the Get Ready
   gate starts the camera, waits for the face, counts down 3-2-1, then the event clock starts.
3. Each event plays, finishes, shows results with a medal; Retry and Event Select work; a
   retry with a warm camera reaches the countdown near-instantly.
4. Pause/Exit mid-event, start a different event — no console errors.
5. Menu → Camera Check: preview + overlay track the face, tracker panel reaches TRACKING,
   trigger console logs blink/brow/mouth/look events; brow quick-tune works; Back returns.
6. Return to title — camera light turns off; re-enter an event — tracking resumes.
7. Reload the page — tuning persists (no re-tune needed for brow triggers).
