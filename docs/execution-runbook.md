# Execution Runbook (human PM, mixed Codex/Claude agents)

Companion to `docs/agent-task-backlog.md` (the spec). This file is for the **human operator**
coordinating multiple single-task agent sessions — any vendor — against this repo. There is no
persistent PM agent: GitHub issues/PRs are the shared state, and you are the scheduler.

## Operating principles

- **One session = one task = one branch = one PR.** Sessions are disposable; never reuse a
  session across tasks. All context an agent needs is in the backlog doc + its issue.
- **You are the lock.** Never launch two sessions for the same issue. Comment
  `in progress — <vendor>` on an issue when you launch its session.
- **GitHub is the only coordination channel.** Agents must not depend on anything said in a
  chat session; if it matters, it goes in the issue or PR.
- **Local sessions need separate checkouts.** Two agents editing one working directory will
  trample each other even on different branches. Use `git worktree add ../fo-task-<id> -b task/<id>`
  per local session (cloud agents handle this themselves).

## Where to spend which credits

| Work | Model tier | Why |
|---|---|---|
| P0.1, P0.2 (contract tasks), A4 (integration) | Strongest Claude available | Everything downstream builds on these; a subtle flaw taxes 20 PRs |
| Reviewing the contract PRs | Strongest available (or careful human review) | Same reason |
| All other wave tasks | Codex / Sonnet-class | Decomposed specifically so mid-tier models succeed |
| Reviews of wave PRs | Opposite vendor from the implementer | Cross-vendor review catches more; cheap |
| Stage 0 bootstrap, E-track CI edits | Cheapest available | Mechanical |

## Stage 0 — Bootstrap (one cheap session + 10 min of you)

1. Launch one session with:
   > Read docs/agent-task-backlog.md. Create GitHub labels `track:A`…`track:F`, `wave:0`–`wave:3`,
   > `needs-human-check`, `status:todo`, `status:in-progress`, `status:blocked`,
   > `status:in-review`, then one issue per task: title `<ID>: <task name>`, body = the task's
   > full text from the doc plus its Depends/Blocks lines, labeled with its track, wave,
   > `status:todo`, plus `needs-human-check` if its Verify section includes manual camera
   > steps. Use `gh`. Skip issues that already exist. Output a table of issue numbers per task ID.
2. You: enable branch protection on `main` (require the deploy workflow's build job to pass;
   require PRs). Save the issue-number table — you'll reference it constantly.
3. Optional but recommended now: record/choose the ~5 s face clip for task E3.

**If you already ran Stage 0 before the `status:*` labels existed** (as of this doc revision),
backfill once with a cheap session:
> Create GitHub labels `status:todo`, `status:in-progress`, `status:blocked`, `status:in-review`
> if they don't exist. For every open issue matching `<ID>: ` in its title that has none of
> those four labels, add `status:todo`. Report which issues you labeled.

## Stage 1 — Spine (serial; strong model; you merge each before starting the next)

Order: **F1 → P0.1 → P0.2.** One session each, using the task prompt template below.
Review P0.1 and P0.2 diffs yourself (or spend a strong-model review session) before merging.
Nothing else starts until P0.2 is on `main`.

Exception: **E1 and E2** (CI) touch only `.github/` — launch them with a cheap session in
parallel with the spine, and merge E1/E2 first if ready. The per-PR previews (E2) are what make
your camera-check queue workable.

## Stage 2 — Wave 1 fan-out (parallel; mostly cheap sessions)

Eligible immediately after P0.2 merges: **A1, A2, A3, B1, C1→C2, C3, D3, D5, A7.**
Launch as many as you can review — 3–4 in flight is a sane cap. Any vendor.

## Stage 3 — Integration point (strong model again)

**A4** (rewire FaceInputService) after A1+A2+A3 merge. Treat like a contract task: strong
model, careful review. Then fan out again: **A5, A6, B2 (needs C3), B4, D1, D4.**
D4 (Get Ready gate) is P1 — schedule it early; it's also E3's prerequisite.

## Stage 4 — Tail (cheap, opportunistic)

**B3, D2, D6, F2, A8, E3** as their dependencies land. E3 is worth prioritizing once D4 is in:
it converts most future `needs-human-check` items into CI assertions, directly reducing your
per-cycle workload.

## Two modes

**Mode 1 — single-task session.** You launch one session per task, watch it, review, merge,
launch the next. Maximum control, maximum attention required. Template below.

**Mode 2 — hands-off batch coordinator.** You launch one session with a fixed prompt — no
per-run editing, no task IDs to supply — and it figures out the current project state from
GitHub itself: which issues are still `status:todo`, whether their dependencies are merged,
whether their files overlap with anything already in flight. It claims a small batch, spawns
one implementer subagent per task in its own git worktree, runs a first-pass review on each
resulting PR, updates issue labels so the *next* session (any vendor) knows what's already
spoken for, and reports back. **It never merges anything.** You still do final review (human +
a separate alternate-vendor session, e.g. Codex) and merge yourself.

Status lives entirely in GitHub labels (`status:todo` / `status:in-progress` /
`status:in-review` / `status:blocked`, plus GitHub's own open/closed), so this works whether
your *next* paste is another Mode 2 session, a manual Mode 1 session, or a Codex session — none
of them need anything from your previous chat, only the repo's current label state.

Mode 2 costs more tokens per run than Mode 1 (the coordinator holds context for a whole batch
and runs review passes), so it trades credits for your attention. It self-limits batch size —
you generally don't need to tune anything, but you can paste `Cap this batch at N tasks.` or
`Only consider track B.` as an extra line if you want to narrow it for a given run.

### Batch coordinator prompt (Mode 2 — copy verbatim, no edits needed)

```
You are coordinating the next batch of work from docs/agent-task-backlog.md for this repo,
using docs/execution-runbook.md's protocol. You implement nothing yourself — you only
determine what's eligible, spawn subagents, run first-pass reviews, update tracking labels,
and report. You never merge a PR, and you never push directly to main.

1. Run `gh issue list --label status:todo --state open` (and separately check
   `status:in-progress`/`status:in-review` issues for anything stale — e.g. in-progress with
   no commits/PR activity in a long time — and note it in your report, but don't touch it).
2. For each `status:todo` issue, read its body for the task's Depends line (cross-reference
   docs/agent-task-backlog.md if the issue body is ambiguous). An issue is ELIGIBLE only if
   every dependency task's issue is closed (merged). If not eligible, leave it status:todo and
   skip it silently (it'll be picked up once its dependency lands).
3. Among eligible issues, drop any whose task file-list overlaps (per the doc's ownership
   matrix) with: (a) another eligible issue you're about to start in this same batch, or
   (b) any issue currently `status:in-progress`/`status:in-review`. When two eligible issues
   conflict with each other, keep the lower task ID for this batch and leave the other
   status:todo for next time. Do not guess an ordering beyond that simple rule.
4. Cap the batch at 5 tasks (fewer if fewer are eligible). Prefer tasks from the
   lowest-numbered wave label present among eligible issues, so earlier waves clear before
   later ones start — unless that would make the batch empty, in which case take what's
   eligible regardless of wave.
5. For each chosen issue: label it status:in-progress (remove status:todo), comment
   "in progress — batch coordinator", then spawn one Agent (isolation: "worktree", run in
   background) instructed to: read docs/agent-task-backlog.md and execute exactly that task
   (cite the issue number) on branch task/<id>; write the validation plan first into the draft
   PR description; implement strictly within the task's listed files; run npm run typecheck,
   npm test, npm run lint and paste output into the PR; open the PR with "Closes #<N>"; apply
   label needs-human-check if the task's Verify section has manual steps; if the task seems to
   require editing src/game/core/types.ts or files outside its listed ownership, stop, comment
   on the issue explaining why, set the issue label to status:blocked, and do not open a PR.
6. As each implementer subagent finishes: if it opened a PR, relabel the issue
   status:in-review and spawn a second subagent to review that PR (correctness of the diff,
   validation plan actually followed, no files touched outside ownership, tests assert
   behavior not implementation trivia); have it post findings as PR comments and state
   APPROVE or REQUEST CHANGES with reasons. This is a first-pass check, not a substitute for
   human/alternate-vendor review — do not merge regardless of its verdict. If the subagent
   instead escalated without a PR, leave the issue at status:blocked.
7. Do not poll or sleep waiting on subagents — you'll be notified as each completes. Once every
   started task has either reached status:in-review (with first-pass review posted) or
   status:blocked, stop and report: a table of task ID / issue / PR link / CI status / review
   verdict / status, plus how many status:todo issues remain and why (still blocked on
   dependencies, or held back this run for capacity/overlap reasons). Then wait for me — do
   not start another batch in this same session.
```

Paste that same block again, unmodified, in a **fresh** session whenever you're ready to
advance the process — after you've merged whatever it's waiting on you for. The label state on
GitHub is what makes "just paste it again" safe; the new session rediscovers everything from
scratch and won't re-claim work another session already has in flight.

### Task prompt template (Mode 1, single task — paste into any vendor's session)

> Read docs/agent-task-backlog.md in full, especially "Execution & validation protocol".
> Execute exactly task **<ID>** (GitHub issue **#<N>**) — nothing more. Branch `task/<id>` off
> latest `main`. Write the validation plan FIRST into a draft PR description (tests you will
> add and what each asserts; manual steps with expected observations). Implement strictly
> within the task's listed files. Run `npm run typecheck`, `npm test`, `npm run lint`; paste
> their output into the PR. Mark the PR ready with `Closes #<N>`. If the task seems to require
> editing src/game/core/types.ts or files outside its ownership, STOP and comment on the issue
> instead of proceeding.

## Review prompt template

> Review PR **#<n>** against task **<ID>** in docs/agent-task-backlog.md. Check: correctness of
> the diff; the validation plan was written and actually followed; no files outside the task's
> ownership were touched; tests assert behavior (not implementation trivia). Post findings as
> PR comments. State clearly APPROVE or REQUEST CHANGES with reasons.

## Your per-cycle checklist (each time you sit down, ~10–15 min)

With Mode 2, most of this collapses to: **review what's waiting, merge what's good, paste the
coordinator prompt again.** The full version, for when you want more control or something looks
off:

1. `gh pr list` — for each open PR (issue label `status:in-review`): CI green? first-pass
   review posted and clean? If review is missing or you want a second opinion, launch a review
   session with the opposite vendor from whoever implemented it. Merge approved PRs **in
   dependency order** — merging closes the issue automatically (`Closes #N`), which is what
   lets the next coordinator run treat that task as done.
2. Camera queue: for PRs labeled `needs-human-check`, open the `pr/<n>` preview (or run
   locally), walk the PR's stated manual steps, comment pass/fail before merging.
3. Anything `status:blocked`? Read the escalation comment, decide, reply on the issue, and
   either fix the backlog doc + relabel `status:todo`, or resolve manually yourself.
4. Stale branches: if `main` moved under an open PR, comment "rebase onto main" (an agent
   session or you can do it).
5. Nothing left to review/merge? Paste the Mode 2 coordinator prompt into a fresh session to
   claim the next batch. That's the entire "advance the process" step — it self-selects
   eligible work from current label state.

## Failure handling

- **Agent goes off-spec / touches forbidden files:** close the PR unmerged, comment why on the
  issue, relaunch fresh (usually with the other vendor or a stronger model). Don't try to steer
  a confused session — a fresh session with a clarified issue comment is cheaper.
- **Task turns out to be wrongly specified:** fix the backlog doc yourself (or with one
  session), note the change in the issue, then relaunch. The doc is versioned; spec changes are
  commits, not chat lore.
- **Merge conflict between two merged-adjacent PRs:** shouldn't happen inside the ownership
  matrix; if it does, that's a signal a task violated ownership — check before resolving.
