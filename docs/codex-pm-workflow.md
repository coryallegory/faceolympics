# Codex Project Manager Workflow

This document describes how to use Codex as an automated project manager for the Face Olympics POC. Codex can plan work, decompose it into PR-sized tasks, implement or delegate tasks, request independent subagent reviews, merge approved PRs, and continue until the POC acceptance criteria are met.

## Operating Model

Use Codex in recurring project-manager sessions with this standing instruction:

```txt
Act as project manager for the Face Olympics POC. Use AGENTS.md and docs/project-plan.md as the source of truth. Maintain a prioritized backlog, choose the next smallest valuable task, define acceptance criteria and validation checks before implementation, create a branch/PR for the task, request an independent subagent PR review, merge the PR when the subagent approves it and required checks pass, and repeat until the POC acceptance criteria are met. Do not broaden scope beyond the POC without asking.
```

## Human Responsibilities

The human project owner establishes the project goals and automation policy. Under this workflow, routine POC implementation PRs do not require human approval before merge when all automated merge gates pass.

The human project owner should still:

- Confirm product decisions that materially affect scope, player experience, child safety, privacy, or public release readiness.
- Provide feedback after playtesting when available.
- Decide when the POC is complete enough to stop iteration.
- Revisit the automation policy if Codex repeatedly produces low-quality changes.


## Codex Responsibilities

Codex should:

- Treat `AGENTS.md` as the standing engineering and product instruction file.
- Keep `docs/project-plan.md` aligned with implementation reality.
- Maintain or update a project backlog as new tasks are discovered.
- Break work into small PRs with clear acceptance criteria.
- Prefer vertical slices that produce playable progress.
- Run relevant checks before creating a PR.
- Include the PR preview URL, `https://coryallegory.github.io/faceolympics/pr/?v=<current-calibration-build-code>`, in each completed task response when a PR is created.
- Request an independent subagent review for each implementation PR before merge.
- Merge PRs without human intervention only when all automated merge gates pass.
- Summarize risks, skipped checks, and verification gaps in every PR.
- Avoid expanding into deferred features such as Cup mode, unlocks, or a full event roster before the POC is complete.


## Automated PR Review and Merge Policy

Codex should use a two-agent workflow for implementation PRs:

1. **Implementing agent**
   - Selects the next backlog task.
   - Defines acceptance criteria and validation checks.
   - Implements the change.
   - Runs relevant checks.
   - Opens or prepares the PR.

2. **Review subagent**
   - Reviews the PR diff against `AGENTS.md`, `docs/project-plan.md`, this workflow, and the task acceptance criteria.
   - Checks that tests or validation steps are appropriate for the change.
   - Looks for regressions, scope creep, maintainability issues, and missed documentation updates.
   - Returns one of these decisions: `APPROVE`, `REQUEST_CHANGES`, `BLOCKED`, or `ESCALATE`.

Codex may merge a PR without human intervention only when all of these gates are satisfied:

- The review subagent returns `APPROVE`.
- Required local checks and CI checks pass.
- The PR stays within the current POC scope.
- The PR does not introduce a new privacy, child-safety, dependency-license, or deployment-secret risk.
- The PR description documents tests run, skipped checks, known limitations, and any manual verification gap.

Codex must not merge automatically when:

- The review subagent returns `REQUEST_CHANGES`, `BLOCKED`, or `ESCALATE`.
- Required checks fail or are unavailable for reasons unrelated to the environment.
- The change expands scope beyond the POC.
- The change alters automation policy, privacy rules, child-safety assumptions, or deployment credentials.
- Camera behavior requires real-device verification and the PR would mark that behavior complete without a documented manual-test gap.

When a PR is not mergeable, Codex should fix the issues and request another subagent review. If the same issue remains unresolved after repeated attempts, or if the review subagent returns `ESCALATE`, Codex should stop the automation loop and summarize the blocker rather than merge.

## Recommended Backlog Sequence

1. **Scaffold the app**
   - Create TypeScript/Vite project structure.
   - Add scripts for build, typecheck, lint, test, and preview.
   - Add mobile portrait shell.

2. **Add GitHub Pages deployment**
   - Add `.github/workflows/deploy.yml`.
   - Build on pushes to `main` and `master`.
   - Deploy production builds to the root of `gh-pages`.
   - Deploy pull request previews to the shared `pr/` subdirectory on `gh-pages`.
   - Support manual `workflow_dispatch`.

3. **Create app navigation states**
   - Title screen.
   - Main menu.
   - Event selection.
   - Calibration placeholder.
   - Event play placeholder.
   - Results/retry placeholder.

4. **Define core contracts**
   - Event interface.
   - Normalized face input model.
   - Calibration profile model.
   - Score and medal model.

5. **Implement face input foundation**
   - Camera permission flow.
   - Front-camera stream setup.
   - MediaPipe Face Landmarker integration.
   - Normalized input primitives for initial events.
   - Picture-in-picture preview.
   - Debug overlay.

6. **Implement calibration flow**
   - Neutral face calibration.
   - Blink threshold calibration.
   - Eyebrow threshold calibration.
   - Mouth-open threshold calibration.
   - Friendly retry/failure states.

7. **Implement Blink-Off**
   - First complete playable event.
   - Timer, scoring, medal thresholds, results, and retry.
   - Tests for pure event logic.

8. **Implement Face Weightlifting**
   - Eyebrow-driven lift state.
   - Strain/risk behavior.
   - Scoring and medals.
   - Tests for pure event logic.

9. **Implement Dragon Blast**
   - Mouth-open charge behavior.
   - Release behavior using pursed lips if reliable, otherwise documented fallback.
   - Targets, scoring, medals, and tests.

10. **POC polish and acceptance pass**
    - Mobile readability pass.
    - Basic SVG/cartoon visual pass.
    - Lightweight sound effects if practical.
    - Documentation of known limitations.
    - Final POC checklist against acceptance criteria.

## Per-Task PR Loop

For each task, Codex should follow this loop:

1. Restate the task and scope.
2. Define acceptance criteria.
3. Define validation commands and manual checks.
4. Implement the smallest useful change.
5. Run checks.
6. Create a PR with summary, testing, risks, follow-ups, and the PR preview URL.
7. Call an independent review subagent to review the PR against acceptance criteria.
8. If the subagent requests changes, fix them and request another review.
9. Merge automatically without human intervention when the subagent approves and all merge gates pass; otherwise stop and report the blocker.
10. Update backlog and choose the next task.

## Suggested Prompt to Start the POC Build

Use this prompt in a new Codex task when ready to begin implementation:

```txt
Act as project manager and implementation agent for Face Olympics. Read AGENTS.md, docs/project-plan.md, and docs/codex-pm-workflow.md first. Start with the next smallest POC task: scaffold the TypeScript/Vite mobile portrait app. Before coding, define acceptance criteria and validation checks. Implement only this task, run checks, commit changes, and create a PR. Then call an independent subagent to review the PR. If approved and all checks pass, merge it automatically. Do not start face tracking or events in this PR.
```

## Suggested Prompt After Each Merge

```txt
Continue as project manager for Face Olympics. Review AGENTS.md, docs/project-plan.md, and docs/codex-pm-workflow.md. Inspect the current repository state, compare it to the POC acceptance criteria, select the next smallest backlog task, define acceptance criteria and validation, implement it, run checks, commit, and create a PR. Call an independent subagent to review the PR. If approved and all checks pass, merge it automatically, then continue to the next task until the POC acceptance criteria are met or a blocker is reached.
```

## Automation Notes

Fully automatic implementation-to-merge loops require repository permissions, branch protection choices, CI configuration, and a merge command or platform integration available to Codex. Configure branch protection so automation can merge only after required checks pass.

The intended POC automation loop is:

- Codex creates each PR.
- The Pages workflow publishes each PR to the shared preview path. Codex should provide a cache-busted URL in final responses, such as `https://coryallegory.github.io/faceolympics/pr/?v=<current-calibration-build-code>`.
- CI validates the PR.
- A review subagent reviews the PR.
- Codex merges the PR when the subagent approves and all required checks pass.
- Codex continues from the updated main branch.

This workflow is intentionally limited to the POC scope. If Codex reaches a policy-sensitive decision, repeated review failure, unavailable required check, or real-device camera verification blocker, it should stop and report the blocker instead of merging.
