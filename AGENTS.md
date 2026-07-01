# AGENTS.md

## Project: Face Olympics

Face Olympics is a mobile-first, browser-based single-player game collection for kids ages 7–12. Players control short, goofy Olympic-style events with face tracking instead of virtual joystick or D-pad controls.

The project is a public GitHub Pages web app. It should prioritize a reliable proof of concept before broader features such as Cup mode, PWA polish, or a large unlock system.

## Product Goals

- Build a portrait-oriented mobile web game that runs in modern phone and tablet browsers.
- Use the front-facing camera and client-side face tracking as the primary input.
- Keep camera processing local to the device; do not upload video or face data.
- Make each event short, readable, replayable, and funny to watch.
- Make the player's face feel connected to the game through clear on-screen reactions and feedback.
- Use simple 2D SVG/cartoon-style visuals that can evolve independently from gameplay logic.
- Maintain modular code organization so events, input adapters, scoring, UI, and assets can evolve separately.

## Initial Proof-of-Concept Scope

The first POC should focus on single-event play from a menu, not Cup mode.

### Required POC Screens

- Title screen: `Face Olympics`
- Main menu with large mobile-friendly buttons
- Event selection screen
- Per-event calibration screen
- Event play screen
- Results/retry screen
- Settings/debug screen only if needed for calibration diagnostics

### Initial Events

Implement the least-complex reliable starter events first:

1. **Blink-Off**
   - Input: keep eyes open; blink ends or penalizes the run.
   - Goal: last as long as possible without blinking.
   - Why first: validates blink detection and basic event timer/scoring.

2. **Face Weightlifting**
   - Input: eyebrows raised lifts, relaxed eyebrows stabilizes/lowers, blink creates risk.
   - Goal: lift and hold long enough to score.
   - Why first: validates eyebrow thresholds and sustained expression state.

3. **Dragon Blast**
   - Input: mouth open charges, lips pursed/blowing releases if available; fallback release can use mouth-close-after-charge until pursed detection is reliable.
   - Goal: hit as many targets as possible within a short round.
   - Why first: validates mouth-open thresholds and charge/release gameplay.

Do not implement Cup mode, unlock achievements, or the full event roster until the input system and first three events are reliable.

## Technical Direction

- Prefer **TypeScript** with a browser-first app structure.
- Prefer **Phaser + TypeScript** for the game layer if a game engine is useful; otherwise use a lightweight TypeScript/canvas architecture. Keep the decision documented.
- Use **MediaPipe Face Landmarker** unless implementation findings prove another browser library is materially better.
- Target GitHub Pages deployment using a `gh-pages` branch.
- Configure deployment to run on pushes to `main` and `master`, and support manual `workflow_dispatch` runs.
- PWA support is optional and should not block the POC.

## Architecture Principles

- Mobile-first and portrait-first. Avoid layouts that require landscape orientation.
- No virtual joystick or D-pad controls.
- Large on-screen buttons are allowed for menus, pause, retry, calibration, and event selection.
- Events must not access camera APIs directly.
- Events must consume normalized input from shared input services.
- Keep face tracking, gesture detection, calibration, scoring, UI, and event gameplay separate.
- Keep event visuals/assets event-owned where practical.
- Prefer configuration over hard-coded thresholds and durations.
- Keep gameplay loops simple and deterministic where possible.
- Keep code testable without a live camera by isolating pure state updates and scoring logic.
- Never put try/catch blocks around imports.

## Suggested Repository Organization

```txt
/
  AGENTS.md
  README.md
  docs/
    project-plan.md
    architecture.md
    event-design.md
  package.json
  .github/
    workflows/
      deploy.yml
  public/
    assets/
      shared/
  src/
    app/
    game/
      core/
      events/
        blink-off/
        dragon-blast/
        face-weightlifting/
      input/
        face/
        calibration/
      scoring/
      storage/
      ui/
    styles/
```

Each event should own its event-specific logic, config, and assets:

```txt
src/game/events/example-event/
  ExampleEvent.ts
  example-event.config.ts
  example-event.assets.ts
  example-event.scoring.ts
  example-event.test.ts
```

Shared visual primitives, UI components, sounds, and reusable effects may live in shared folders when they are genuinely reused.

## Event Interface Contract

Each event should follow a common interface or equivalent contract. Adapt exact names to the chosen framework.

```ts
interface FaceOlympicsEvent {
  id: string;
  title: string;
  description: string;
  requiredInputs: FaceInputPrimitive[];
  init(context: EventContext): void | Promise<void>;
  start(calibration: CalibrationProfile): void;
  update(deltaMs: number, input: NormalizedFaceInput): EventFrameResult;
  pause(): void;
  resume(): void;
  finish(): EventResult;
  dispose(): void;
}
```

Events should return results through shared scoring and medal models rather than custom one-off result objects.

## Face Input System

Reusable primitives may include:

- Left blink
- Right blink
- Both eyes closed
- Eye gaze direction
- Mouth open percentage
- Lips pursed / blowing gesture
- Smile detected
- Eyebrows raised
- Left eyebrow raised
- Right eyebrow raised
- Head tilt / roll
- Head turn / yaw
- Head up/down / pitch
- Face leaves camera frame

### Calibration Requirements

- Calibration must be callable before every event.
- Calibration should be independent from event controllers so it can also be launched from settings later.
- Store neutral face, blink thresholds, eyebrow thresholds, mouth-open threshold, and any useful confidence values.
- Calibration should provide clear, kid-friendly prompts.
- When calibration fails, show a helpful retry flow rather than starting the event with bad thresholds.

### Debug Overlay

Build a debug overlay early. It should show current normalized input values, confidence, face presence, and calibrated thresholds. The overlay should be easy to disable for normal play.

## Camera and Privacy

- Use the front-facing camera.
- Camera processing should happen locally in the browser.
- Do not upload or persist camera images, video, biometric templates, or raw landmark streams.
- A small picture-in-picture camera preview is acceptable, especially during calibration and debugging.
- The player should understand that their face controls the game even if the full camera feed is not the main visual surface.

## Scoring and Progression

- Use fixed score thresholds for Bronze, Silver, and Gold medals in the POC.
- Keep medal thresholds per event in event-owned config files.
- Persist scores and medals in local browser storage when implemented.
- Do not prioritize unlock achievements in the POC.
- Future unlock categories may include silly hats, face stickers, arenas, opponents, and effects.

## Tone and Content

- Keep the tone silly, physical, and funny, but not random for its own sake.
- Keep humor age-appropriate for kids ages 7–12.
- Avoid inappropriate, mean-spirited, frightening, or adult content.
- Prefer readable UI and clear feedback over visual clutter.
- Scores should be engaging, but fun and replayability should remain the primary experience.

## Definition of Done for New Events

A new event is complete only when it has:

- A module following the shared event contract.
- Event-owned config and scoring thresholds.
- A calibration dependency list declaring required face inputs.
- Mobile portrait layout validation.
- Pause, retry, and results flow integration.
- Clear input feedback so players know what their face action did.
- Unit tests for pure event state/scoring logic where practical.
- A validation plan documented before implementation starts.
- Acceptance criteria that can be checked by a human playtest and automated tests where possible.

## PR Review and Automated Merge Policy

Codex is expected to operate as an automated project manager for the POC when requested. For implementation PRs, Codex must call an independent review subagent before merging. The review subagent should check the PR diff against acceptance criteria, this `AGENTS.md`, relevant docs, test results, security/privacy expectations, and POC scope.

Codex may merge without human intervention only when:

- The review subagent explicitly approves the PR or reports no blocking issues.
- Required local checks and CI/status checks pass.
- The change remains within documented POC scope.
- The change introduces no unresolved privacy, child-safety, camera-behavior, deployment-secret, dependency-license, destructive-data, or automation-policy risk.
- The PR body documents tests run, skipped checks, known limitations, and any manual verification gaps.

If the review subagent requests changes or blocks the PR, Codex must address the feedback and request another review before merging. If the same blocker persists after repeated attempts, Codex should stop the automation loop and report the blocker.

## Validation and Testing Expectations

Before assigning or implementing a task, define how it will be validated.

Prefer this pattern:

1. Identify acceptance criteria.
2. Identify automated tests or static checks that can catch regressions.
3. Implement the smallest change that satisfies the criteria.
4. Run the relevant checks.
5. Document any manual verification needed, especially for camera behavior.

Recommended checks as the codebase emerges:

- Type checking.
- Linting.
- Unit tests for scoring, event state machines, calibration transforms, and storage helpers.
- Build verification.
- Manual mobile browser camera smoke tests for face tracking behavior.

## GitHub Pages Deployment

- Add a GitHub Actions workflow at `.github/workflows/deploy.yml` once the app scaffold exists.
- Deploy to a `gh-pages` branch.
- Trigger deployment on pushes to `main` and `master`.
- Include `workflow_dispatch` for manual deployment.
- Keep build output out of source folders unless required by the deployment tool.

## Documentation Expectations

Use `docs/` for durable project context beyond this file. Good candidates include:

- `docs/project-plan.md`
- `docs/architecture.md`
- `docs/event-design.md`
- `docs/face-input.md`
- `docs/deployment.md`
- `docs/codex-pm-workflow.md`

Update documentation when architecture, event contracts, or deployment behavior changes.
