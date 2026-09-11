# AGENTS.md

Working conventions for an AI coding assistant on this repo.

## What this is

`portfolio-landing-page` is a personal one-page React portfolio (React 19 + Vite 8), deployed as a
static site to GitHub Pages. `.github/workflows/node.js.yml` builds on every push/PR to `main`, and on
every push to `main` deploys straight to production — there is no staging environment and no manual
gate. Treat a push to `main` as equivalent to shipping.

## Commands

```bash
npm run dev              # vite dev server
npm run build             # vite build
npm run preview           # preview a production build locally
npm run lint               # eslint "src/**/*.{js,jsx}"
npm run lint:fix           # eslint --fix
npm run format             # prettier --write "src/**/*.{js,jsx,css,json,md}"
npm run format:check       # prettier --check (what CI effectively requires via a clean build)
npm run photos:build       # scripts/build-photos.mjs — rebuilds public/photos + src/data/photos.json
npm run photos:clean       # removes the generated photos output
```

There is currently no test runner in this repo. The correctness gate to run before every push is:

```bash
npm run lint && npm run format:check && npm run build
```

If a test runner is ever added, fold `npm test` into that gate and into this section.

## Working sessions

- **One task per session.** When a PR-sized change is done, say so plainly and suggest starting a new
  conversation for the next one, rather than letting one session drift across unrelated work.
- **Keep replies short.** Skip recaps of what the diff already shows, verification tables a sentence
  would cover, and "what's next" epilogues. Say what changed and why; let the diff speak for what.
- **If a request is unusually large or open-ended, say so before diving in** and propose splitting it,
  rather than running long unprompted. (This repo has no token/usage budget to check against — the
  point is scope hygiene, not spend.)
- **Branch per task.** Before editing, fetch and fast-forward `main`, then branch from it:
  ```bash
  git fetch origin && git merge --ff-only origin/main
  git checkout -b <branch-name>
  ```
  A single contributor normally doesn't need a full git-worktree setup — plain branching is enough.
  Reach for a worktree only if you're ever running more than one agent/session against this repo at
  the same time, so two sessions can't collide on the same working copy.

## Git/PR conventions

- Fetch and fast-forward `main` before branching (above) — don't trust a stale local `main`.
- Run the correctness gate locally before pushing (see Commands). It's exactly what CI runs; catching
  a failure locally is one command, catching it after a push is a round trip through Actions.
- Assign the repo owner on every PR you open: `gh pr create --assignee @me --title "..." --body "..."`.
- Don't read large files whole. Grep/search for the symbol or string first, then read the surrounding
  range. Files here are small today, but this is a cheap habit worth keeping as the repo grows.

## Traps

A running list of non-obvious mistakes that cost real time to discover — things reading the code once
wouldn't reveal. Empty for now. When you (or a future session) lose real time to something surprising,
add an entry here: what the trap is, why it isn't obvious, and how to avoid it. Don't record ordinary
bugs, just things that would plausibly bite someone else the same way.

## Design practices

- **Stress-test feature/UI changes against concrete edge cases** before implementing — e.g. long names
  overflowing a layout, missing images, empty data lists, narrow/mobile viewports — rather than only
  designing for the happy path.
- **Prefer designing out irreversible risk over adding a recovery path.** Concretely here: a push to
  `main` deploys immediately (see "What this is"), so treat force-pushes or history rewrites on `main`
  with real caution, and prefer a design that avoids the destructive case entirely over one that just
  makes it recoverable after the fact.
- **For third-party setup (GitHub Pages custom domain/DNS, any API integration, etc.), verify steps
  against current docs before writing a walkthrough** rather than relying on memory — provider UIs and
  APIs drift.

## Issue-driven planning

- If you notice something out of scope while working on a task, file a GitHub issue for it instead of
  fixing it opportunistically in the current change. Keep each change scoped to what was asked.
- Once a PR that resolves a filed issue merges, close that issue rather than leaving it open.
- **Unattended/scheduled review pattern (for future use, not wired up yet):** if this repo ever gets a
  scheduled or on-demand "sweep" job, the pattern worth reusing is — pick up issues explicitly marked
  ready for unattended work, implement them one at a time with one PR each, and scale how much to take
  on to what's reasonable to hand off without review until it's done. Nothing here relies on that
  existing yet; note it if/when a scheduler gets set up for this repo.

## Handoff format

End a session (or a distinct chunk of work) with one copyable block:

```
Done: <what changed, one line per PR/commit>
Next: <what's left, if anything>
Open questions: <anything needing a decision, or "none">
```
