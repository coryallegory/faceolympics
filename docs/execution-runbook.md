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
   > `needs-human-check`, then one issue per task: title `<ID>: <task name>`, body = the task's
   > full text from the doc plus its Depends/Blocks lines, labeled with its track and wave, plus
   > `needs-human-check` if its Verify section includes manual camera steps. Use `gh`. Skip issues
   > that already exist. Output a table of issue numbers per task ID.
2. You: enable branch protection on `main` (require the deploy workflow's build job to pass;
   require PRs). Save the issue-number table — you'll reference it constantly.
3. Optional but recommended now: record/choose the ~5 s face clip for task E3.

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

## Task prompt template (paste into any vendor's session)

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

1. `gh pr list` — for each open PR: CI green? review done? If review missing, launch a review
   session (opposite vendor). Merge approved PRs **in dependency order**.
2. Camera queue: for PRs labeled `needs-human-check`, open the `pr/<n>` preview (or run
   locally), walk the PR's stated manual steps, comment pass/fail.
3. Stale branches: if `main` moved under an open PR, comment "rebase onto main" (an agent
   session or you can do it).
4. `gh issue list --state open` — pick the next tasks whose Depends are all merged; launch one
   session each (respect your in-flight cap); comment `in progress — <vendor>` on each issue.
5. Anything escalated (agent stopped and commented)? Decide, reply on the issue, relaunch.

## Failure handling

- **Agent goes off-spec / touches forbidden files:** close the PR unmerged, comment why on the
  issue, relaunch fresh (usually with the other vendor or a stronger model). Don't try to steer
  a confused session — a fresh session with a clarified issue comment is cheaper.
- **Task turns out to be wrongly specified:** fix the backlog doc yourself (or with one
  session), note the change in the issue, then relaunch. The doc is versioned; spec changes are
  commits, not chat lore.
- **Merge conflict between two merged-adjacent PRs:** shouldn't happen inside the ownership
  matrix; if it does, that's a signal a task violated ownership — check before resolving.
