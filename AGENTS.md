# AGENTS.md

Working conventions for an AI coding assistant on this repo.

## What this is

`portfolio-landing-page` is a personal one-page React portfolio (React 19 + Vite 8), deployed as a
static site to GitHub Pages at `patricksmith.io`. `.github/workflows/node.js.yml` builds on every
push/PR to `main`, and on every push to `main` deploys straight to production — there is no staging
environment and no manual gate. Treat a push to `main` as equivalent to shipping.

The codebase is intentionally small and static. Prefer extending the existing React/JSX + CSS
structure over adding a backend, application-wide state library, routing framework, or other large
architectural dependency unless the task genuinely requires one.

## Architecture and source of truth

- `src/App.jsx` owns the top-level view selection. The normal portfolio is a one-page collection of
  sections; the full photography gallery is selected with `/?photos=true`.
- There is currently no React Router. Do not add one merely to support the existing gallery.
- Most site sections live under `src/components/<section>/`. Prefer the existing component + CSS
  organization for incremental work.
- When documentation conflicts with the running code, treat the current code, `package.json`, this
  file, and `.github/workflows/node.js.yml` as the primary sources of truth.
- `README.md` contains historical material from older versions of the portfolio. Until it is updated,
  do not treat legacy references there (for example Apollo, particles.js, or old package choices) as
  evidence of the current architecture.

## Photography gallery and generated assets

The gallery has a source/generated-file workflow that is easy to misunderstand on a fresh clone:

- `photos-source/` contains local source images and is intentionally gitignored.
- Each immediate directory inside `photos-source/` is treated by `scripts/build-photos.mjs` as an
  album/section. Preserve that grouping mechanism; it is also the intended path for sections such as
  years as the gallery grows.
- `npm run photos:build` uses Sharp to generate display images under `public/photos/full/`, thumbnails
  under `public/photos/thumbs/`, and the static manifest `src/data/photos.json`.
- `public/photos/` and `src/data/photos.json` are generated artifacts, but they are intentionally
  committed. A normal clone must be able to build and deploy the existing gallery without access to
  the local source images.
- GitHub Actions does not run `photos:build` because `photos-source/` is not present in the repository.
  Do not add gallery regeneration to CI unless the source-asset strategy changes deliberately.
- Do not run `npm run photos:clean`, delete generated gallery assets, or rebuild the complete gallery
  unless `photos-source/` is actually available and the task calls for it. A Codespace, remote agent,
  or fresh clone may have the complete deployed/generated gallery while lacking the source files
  needed to recreate it.
- When changing `scripts/build-photos.mjs`, preserve the contract between the generator,
  `src/data/photos.json`, and `src/components/photos-page/PhotosPage.jsx`.

### Gallery behavior to preserve

Unless a task explicitly changes these requirements, preserve the existing gallery/lightbox behavior:

- responsive layouts across desktop, intermediate, and narrow/mobile widths;
- thumbnails open the larger generated image in a modal lightbox;
- Escape closes the lightbox;
- left/right arrow keys navigate;
- previous/next navigation wraps around the current album;
- clicking the backdrop closes the lightbox;
- body scrolling is disabled while the lightbox is open;
- navigation and close controls remain visually centered and usable on desktop and mobile; and
- accessible button labels and dialog semantics remain intact.

For gallery UI changes, explicitly consider landscape, portrait, unusually wide images, narrow mobile
screens, one-photo albums, empty albums/data, and multiple album/year sections.

## Commands

```bash
npm run dev                # vite dev server
npm run build              # vite build
npm run preview            # preview a production build locally
npm run lint               # eslint "src/**/*.{js,jsx}"
npm run lint:fix           # eslint --fix
npm run format             # prettier --write "src/**/*.{js,jsx,css,json,md}"
npm run format:check       # prettier --check "src/**/*.{js,jsx,css,json,md}"
npm run photos:build       # scripts/build-photos.mjs — rebuilds public/photos + src/data/photos.json
npm run photos:clean       # removes the generated photos output; see gallery warning above
```

There is currently no test runner in this repo. The local correctness gate to run before every push is:

```bash
npm run lint && npm run format:check && npm run build
```

CI currently runs `npm run build`; the local gate is intentionally stricter and also checks lint and
formatting. If CI is expanded later, keep this section synchronized with the workflow. If a test runner
is ever added, fold `npm test` into the local gate and CI.

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
- Run the local correctness gate before pushing (see Commands). CI currently catches build failures;
  the local lint/format checks catch additional problems before the round trip through Actions.
- Assign the repo owner on every PR you open: `gh pr create --assignee @me --title "..." --body "..."`.
- Don't read large files whole. Grep/search for the symbol or string first, then read the surrounding
  range. Files here are small today, but this is a cheap habit worth keeping as the repo grows.

## Traps

- **Generated gallery assets can exist without their source files.** `photos-source/` is gitignored but
  `public/photos/` and `src/data/photos.json` are committed. A fresh/remote clone can therefore serve
  the gallery but cannot safely regenerate it. Do not interpret the missing source directory as a
  reason to clean generated output.
- **Gallery ordering is not an implicit filesystem contract.** `scripts/build-photos.mjs` currently
  reads directory entries without an explicit user-facing sort. If a feature depends on album/year or
  photo ordering (for example newest year first), implement and test that ordering explicitly rather
  than assuming `fs.readdir()` order.
- **The README is partially historical.** Verify architectural claims against the current repo before
  acting on README-era package or design descriptions.

When you (or a future session) lose real time to another non-obvious repo-specific surprise, add it
here: what the trap is, why it isn't obvious, and how to avoid it. Don't record ordinary bugs, just
things that would plausibly bite someone else the same way.

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
- Treat issue text as a plan, not immutable truth. If newly discovered repo context changes the best
  implementation, dependencies, priority, or acceptance criteria of an open issue, update the issue
  before implementing it rather than blindly following stale assumptions.
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
