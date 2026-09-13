# AGENTS.md

## What this is

This is a personal React + Vite portfolio at `patricksmith.io`. `.github/workflows/node.js.yml` builds
pushes/PRs to `main` and deploys pushes to `main` to GitHub Pages. There is no staging environment or
manual deployment gate. Treat a push to `main` as shipping; avoid force-pushes or history rewrites there.

Prefer extending the existing React/JSX + CSS structure. Add architectural dependencies only for a
concrete task benefit, with the maintenance and deployment tradeoffs explained.

## Architecture and source of truth

- `src/App.jsx` owns the top-level view selection. The normal portfolio is a one-page collection of
  sections; the full photography gallery is selected with `/?photos=true`.
- There is no React Router. Keep existing gallery URLs working; query parameters or anchors are
  sufficient for simple album links. A router requires a concrete need and a Pages-compatible URL plan.
- Project listings come from `src/data/`, not a live GitHub/Apollo integration; no browser API token is
  required to display them.
- Verify current behavior against code, `package.json`, and the workflow. This file records intended
  constraints; code can contain bugs and documentation can become stale. Resolve discrepancies using
  the task and evidence, and update affected guidance alongside a deliberate behavior change.
- `README.md` contains historical material from older versions of the portfolio. Until it is updated,
  verify its claims before using them. Put setup walkthroughs, publishing procedures, and project
  history in the README or linked documentation; keep this file focused on constraints and traps.

## Photography gallery and generated assets

- `photos-source/` contains local source images and is intentionally gitignored.
- The manifest uses generic ordered sections containing ordered albums. Sections may be years or
  authored non-year groupings. The generator reads `photos-source/<section>/<album>/`; section-level
  images require an album explicitly configured with `sourcePath: "."`.
- `npm run photos:build` uses Sharp to generate display images under `public/photos/full/`, thumbnails
  under `public/photos/thumbs/`, and the static manifest `src/data/photos.json`.
- `public/photos/` and `src/data/photos.json` are intentionally committed. A normal clone must build
  and deploy the existing gallery without originals or an asset-provider connection.
  Keep production-gallery regeneration out of normal install/build/CI. Test the generator using
  synthetic images in a temporary directory instead.
- Missing sources are normal on another machine. There is no routine command that cleans published
  gallery output.
  Before rebuilding or deleting published output, establish the intended album scope, source
  completeness, and preservation of unrelated output. Merely finding `photos-source/` is insufficient;
  it may contain only one new album. Preserve uncommitted assets before destructive operations.
- Committed output can be restored from Git, but missing originals cannot be recreated from it at
  their original quality. Distinguish restoring a known revision from regenerating images.
- Change the generator, manifest, and `PhotosPage.jsx` together when their contract changes. Include
  compatible committed data or a migration that preserves existing URLs and photo counts; do not
  leave a new renderer dependent on somebody else's local rebuild. Keep authored metadata/order
  separate from derived fields when extending the pipeline.

### Gallery behavior to preserve

Unless a task explicitly changes these requirements, preserve the existing gallery/lightbox behavior:

- responsive layouts and centered, usable controls at desktop, intermediate, and mobile widths;
- thumbnails opening the larger image, Escape/backdrop close, and body scroll lock;
- arrow keys and previous/next controls wrapping within the selected album; and
- named controls and dialog semantics. These do not imply complete accessibility: verify keyboard
  opening, focus containment, and focus restoration when improving the lightbox.

For gallery UI changes, explicitly consider landscape, portrait, unusually wide images, narrow mobile
screens, one-photo albums, empty albums/data, and multiple album/year sections.

## Commands

```bash
npm run dev                # vite dev server
npm run build              # vite build
npm run preview            # preview a production build locally
npm run lint               # eslint source and browser-test JavaScript
npm run lint:fix           # eslint --fix
npm run format             # prettier source and browser-test files
npm run format:check       # verify Prettier formatting
npm run photos:import -- --help # album-scoped additive/update workflow
npm run photos:prune -- --help  # explicit album-scoped removal workflow
npm run photos:build -- --replace-all  # explicit full-inventory gallery replacement
npm run test:photos        # synthetic generator contract checks
npm run test:browser:install # install Chromium once for local browser tests
npm run test:browser       # regressions against a prior production build in dist/
```

Focused Node tests cover the photo generator contract, and Playwright covers the built gallery. The
local correctness gate to run before every push is:

```bash
npm run lint && npm run format:check && npm run test:photos && npm run build && npm run test:browser
```

CI installs the committed lockfile with Node 22, runs the same gate, and installs the matching
Playwright Chromium binary immediately before the browser test. Run `npm run test:browser:install`
once locally before the gate. Use Node 22 for local validation where available and report any
mismatch. Lint and formatting cover `src/`, the browser tests, and Playwright config, but not the
generator, root documentation, or workflow. Check changed files outside that scope explicitly. Keep
this section synchronized with changes to the workflow or scripts.

## Working sessions and Git

- Keep each change scoped to one task. For unusually open-ended work, propose a split before starting.
  When a PR-sized change is done, say so and suggest a new conversation for unrelated work.
- Keep replies short: explain what changed, why, and validation; avoid recapping the diff.
- **Branch per task.** Inspect the working tree first and preserve existing work. For a new task on a
  clean checkout, fetch and fast-forward `main`, then branch from it:

  ```bash
  git fetch origin
  git switch main
  git merge --ff-only origin/main
  git switch -c codex/<task-name>
  ```

  When continuing an existing PR, fetch and work from its current head instead of starting over from
  `main`. Use a separate worktree when another session shares this checkout; otherwise plain branching
  is sufficient. Do not switch a checkout that another session is using.

- Assign the repo owner on every PR you open: `gh pr create --assignee @me --title "..." --body "..."`.
- Search for the relevant symbol/string before reading a large file; read the surrounding range.
- Consider long text, missing images, empty data, and narrow screens before implementing UI changes.
- Verify third-party setup instructions against current provider docs before writing a walkthrough.

## Traps

- **Gallery ordering is not an implicit filesystem contract.** `scripts/build-photos.mjs` currently
  preserves manifest order and appends new imports using a deterministic natural-name fallback;
  manifest array order still drives the gallery. Define and test editorial order when changing it,
  preserve existing sequences during migration, and do not infer capture chronology from filenames.
- **Global section styles affect nested gallery sections.** `src/App.css` applies padding to every
  `section`. Check those rules and existing gallery media queries when nesting albums or years, so
  margins and padding do not compound.

Add only non-obvious, recurring repository traps here; record the cause and how to avoid it.

## Issue-driven planning

- Track out-of-scope findings in issues rather than fixing them opportunistically; check for duplicates.
- Issue text is a plan. Update it when new evidence changes scope, priority, dependencies, or acceptance
  criteria, rather than implementing stale assumptions.
- Once a PR that resolves a filed issue merges, close that issue rather than leaving it open.

## Handoff format

End a session (or a distinct chunk of work) with one copyable block:

```
Done: <what changed, one line per PR/commit>
Next: <what's left, if anything>
Open questions: <anything needing a decision, or "none">
```
