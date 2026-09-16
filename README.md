<div align="center">
  <h1>🌵<br>React Portfolio</h1>
  <h3>Portfolio One-Pager made with ReactJs</h3>
  <h3><a href="https://patricksmith.io/" target="_blank">Live Preview</a></h3>
</div>

<div align="center"><img src="https://user-images.githubusercontent.com/29565530/144163917-196b3e87-90e2-4615-b1c7-6a905533f34b.gif" /></div>
<div align="center">
  <p>Home background effect made with React-Particles</p>
</div>

<br>

## 💬 Overview:

A simple one-page react portfolio with clearly defined and modular components which can be easily swapped in and out depending on your use-case. Currently integrated with Apollo & Github API to call repositories with a user provided auth token.

## 🛠️ Packages & APIs

- [React](https://reactjs.org/)
- [particles.js](https://github.com/VincentGarreau/particles.js/)
- [react-reveal](https://github.com/rnosov/react-reveal)
- [react-is-visible](https://github.com/lessp/react-is-visible)

## Local development

Use Node 22, matching CI. With [nvm](https://github.com/nvm-sh/nvm), the committed `.nvmrc` selects
the correct major version:

```bash
nvm use
npm ci
npm run test:browser:install
npm run dev
```

Create a production build with `npm run build` and serve it locally with `npm run preview`.

## Development checks

Pull requests and pushes to `main` install the committed lockfile with Node 22, then run the same
quality gate expected locally:

```bash
npm run lint && npm run format:check && npm run test:photos && npm run build && npm run test:browser
```

The browser suite launches Chromium against `dist/` through `vite preview`; run `npm run build` first.
Its fixtures are injected only on localhost and use isolated in-memory image responses, so the suite
does not require `photos-source/` or modify committed gallery data or assets. Lint and formatting
cover `src`, the browser tests, and Playwright configuration. Check other changed files separately.

## Photo publishing workflow

The gallery has three committed layers:

- `src/data/photo-layout.json` is the human-authored source of truth for section, album, and photo
  order; stable IDs; display titles; source mappings; initial output routes; and per-photo title/alt
  text.
- `src/data/photos.json` is the resolved schema-v2 render manifest. It combines authored fields with
  processor-derived URLs and dimensions and is what the React gallery imports.
- `public/photos/` contains the generated thumbnail and full-display assets.

Originals live only in the gitignored `photos-source/` directory, which may be missing or contain a
partial working set. Normal builds and CI use the committed render manifest/assets and never require
originals.

### Edit hierarchy, order, or text without originals

Edit `src/data/photo-layout.json`, keeping stable IDs unchanged, then reconcile the render manifest:

```bash
npm run photos:sync
```

Sync requires no originals, never writes image assets, and preserves matching generated URLs and
dimensions. It applies authored section, album, and photo order plus titles and alt text. It fails
instead of guessing when either metadata layer has missing, extra, duplicate, colliding, or malformed
IDs. Repeating sync is deterministic and idempotent. A pure reorder should change
`src/data/photos.json` but not `public/photos/`.

An album's `sourcePath` remains a metadata-only pointer to future local source inventory. Its
`outputPath` is chosen when the album is created but becomes stable once the album is published;
changing it through layout editing or `photos:sync` is rejected because existing asset URLs are not
moved or rewritten. Published asset-route changes require a future explicit migration workflow.

### Import or update one album

Put the new or updated originals for a single album in one flat local directory. Target the published
section and album by their stable IDs, not their display titles. Start with a dry run:

```bash
npm run photos:import -- \
  --section current \
  --album current \
  --source photos-source/current \
  --dry-run
```

Review the reported additions, replacements, retained photo IDs, conflicts, and affected output
paths. Then repeat the command without `--dry-run`. Files that are absent from the local directory are
retained; an import never removes published photos. Matching IDs retain their authored position,
title, alt text, and URLs, while their generated variants are replaced only when the bytes or derived
dimensions change. Genuinely new IDs append to the authored album in deterministic natural filename
order (`img2` before `img10`). Filename order is a fallback, not capture chronology.

Stable IDs are identities, not rename hints. If a renamed source produces a different ID, import adds
that ID and retains the old published photo until it is explicitly pruned.

The source directory must contain supported images only and cannot contain nested directories. The
import validates image readability, IDs, source-name collisions, and every manifest/output-path
collision before it can switch published output.

To add an album to an existing section, explicitly provide its editorial title and the path that a
future complete `photos-source/<section>/...` inventory would use:

```bash
npm run photos:import -- \
  --section 2026 \
  --album nyc-marathon \
  --source photos-source/2026/NYC-Marathon \
  --create-album \
  --album-title "NYC Marathon" \
  --source-path "NYC-Marathon" \
  --dry-run
```

Add `--create-section --section-title "2026"` when the section is also new. Section IDs do not need
to be years, and the tool never invents a `Highlights` album. New sections and albums append to their
respective authored arrays. An optional `--output-path` overrides the default `<section-id>/<album-id>`
for a new album only; the chosen route becomes stable after publication.

### Remove published photos intentionally

Pruning is separate from import and accepts exact photo IDs in one selected album. Review first:

```bash
npm run photos:prune -- \
  --section 2026 \
  --album nyc-marathon \
  --photo finish-line \
  --dry-run
```

Then repeat with `--confirm-prune` instead of `--dry-run`. Repeat `--photo <id>` to remove more than
one known photo. Prune removes those IDs from both metadata layers and deletes only their resolved
assets. Missing local source files are never used as removal evidence, and unrelated albums and
assets are preserved.

`npm run photos:build -- --replace-all` remains the deliberately destructive full-inventory workflow.
Use it only when `photos-source/` is known to contain the complete gallery; it can remove anything not
present in that inventory. It is not the command for routine album work.

### Review, recovery, and publishing

Each import, prune, or full replacement stages the authored layout, resolved manifest, and affected
asset tree, then switches them into place with backups as one logical operation. A decode, generation,
validation, write, rename, or final-switch failure restores all prior layers without using Git, so
unrelated uncommitted files are not discarded. Sync uses the same rollback approach for its
metadata-only manifest write.

After a successful operation, inspect
`git diff -- src/data/photo-layout.json src/data/photos.json public/photos`, run the full
development gate above, commit the intended manifest/assets together, and publish through the normal
pull-request workflow. If an operation reports a failure, confirm the committed gallery still builds;
rerun the dry run after fixing the named source/path/ID. Use Git only to restore a known committed
revision, not to reconstruct missing originals.

## Contact form

Production submissions use the Formspree endpoint configured in `ContactForm.jsx`. Before any real
delivery test, the repository owner should sign in to Formspree, open the form's Integration section,
and confirm that its displayed form ID and endpoint match the committed value and that the intended
destination email is active. Do not send a live test until that verification is complete.

For local testing, set `VITE_CONTACT_FORM_ENDPOINT` to a mock server URL before starting Vite. This
keeps validation, success, provider-error, network-error, and timeout checks away from Formspree and
the owner's inbox.
