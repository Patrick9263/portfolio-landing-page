# Gallery delivery measurements (issue #28)

Measured on 2026-09-20, macOS arm64, Node **22.23.2**, locked Chromium
from Playwright 1.63.0. Baseline: **3f3b631** (current main at task start).
Installed react-photo-album: **3.6.1**; inspected its local `dist/types.d.ts`,
`dist/utils/index.js`, and `dist/static/index.js` before implementing.
No new dependencies, router, original-photo access, or production regeneration.

## Reproduce

```sh
# Select Node 22 before running these commands.
npm ci
npm run test:browser:install
npm run build
npm run measure:gallery -- /tmp/gallery-after.json
npm run photos:check
```

The measurement starts its own Vite preview on port 4288. Each route/profile gets
a fresh Chromium context, reduced motion, and only local network requests (external
fonts/services are blocked consistently). Initial means `networkidle` before
scrolling. Then each of the 50 images is scrolled into view and decoded, followed
by opening the first lightbox. The script records requested URLs, selected image
widths, Resource Timing encoded body bytes and transfer bytes. Chromium reports
300 bytes of response overhead per uncached resource in these runs; these are
browser transfer estimates, not packet captures. Lazy-load proximity thresholds
are browser-dependent, so initial request counts can vary by browser/version.
All-gallery totals are the more stable comparison. No timing/latency claims.

To reproduce the baseline, use a separate clean checkout of `3f3b631`, install its
lockfile with Node 22, copy only `scripts/measure-gallery.mjs` from this PR into its
`scripts/` directory, build, and run `node scripts/measure-gallery.mjs /tmp/gallery-before.json`.
The measurement script supports the original manifest without variants. Do not
copy the new manifest/assets into the baseline checkout. Neither measurement
command writes gallery assets. Raw records: [before](issue-28-before.json) and
[after](issue-28-after.json).

## Bundles and committed assets

Bytes, not rounded kB. Gzip is computed per requested file with Node's
`gzipSync` default settings; it is a reproducible compression estimate, not Vite
preview's actual JS HTTP encoding. Vite's console gzip estimator differs slightly.

| Payload | Before raw / gzip | After raw / gzip |
| --- | ---: | ---: |
| Homepage initial JavaScript | 303,888 / 95,742 | 281,745 / 89,873 |
| Gallery-only separately requested JavaScript + embedded data | 0 (eagerly included above) | 39,596 / 8,744 |
| Gallery visit total JavaScript | 303,888 / 95,742 | 321,341 / 98,617 |
| Render manifest, standalone minified JSON (already included in JS; do not add twice) | 8,779 / 1,090 | 24,313 / 2,183 |
| Homepage initial CSS, raw (rounded kB) | 24.74 | 17.76 |
| Deferred gallery CSS, raw (rounded kB) | 0 | 7.14 |

The baseline has **no independently measurable gallery chunk**: PhotosPage,
react-photo-album and manifest share its entry chunk. The after value is the actual
additional gallery request, not an estimated allocation of compressed shared code.
The homepage now saves **22,143 raw / 5,869 gzip bytes** and requests none of the
PhotosPage chunk, library styles, manifest, or photo assets. The homepage Photos
teaser uses its own small stylesheet. Both routes still share the main React/app
chunk; reverse-splitting homepage code out of gallery visits is outside this issue.

| Committed image set | Before | After |
| --- | ---: | ---: |
| 50 legacy thumbnails | 2,554,726 | 2,554,726 |
| 50 legacy full images | 5,764,076 | 5,764,076 |
| Additional responsive derivatives (186) | 0 | 6,667,850 |
| Total | 8,318,802 | 14,986,652 |

Every legacy asset is byte-for-byte unchanged. IDs, titles, alt text, authored
order, album output paths, thumbnail/full URLs, and the 50-photo count are unchanged.
Only processor-derived `srcSet` fields were added to the schema-v2 render manifest.
The authored layout has no diff. This worktree has no `photos-source/`; builds,
metadata reconciliation, and all committed-file checks succeeded without it.

## Cold image network comparison

Each cell shows **body bytes / browser transfer bytes**. Initial request counts
are equal before/after. All-gallery means all 50 images, without opening a lightbox.

| Gallery profile | Initial requests | Initial before | Initial after | All-gallery before | All-gallery after |
| --- | ---: | ---: | ---: | ---: | ---: |
| Phone 390×844, DPR 1 | 9 | 525,672 / 528,372 | 183,936 / 186,636 | 2,554,726 / 2,569,726 | 697,422 / 712,422 |
| Tablet 820×1180, DPR 1 | 5 | 294,288 / 295,788 | 286,224 / 287,724 | 2,554,726 / 2,569,726 | 2,283,986 / 2,298,986 |
| Desktop 1440×1000, DPR 1 | 31 | 1,601,700 / 1,611,000 | 780,226 / 789,526 | 2,554,726 / 2,569,726 | 1,231,262 / 1,246,262 |
| High-DPI phone 390×844, DPR 3 | 9 | 525,672 / 528,372 | 582,838 / 585,538 | 2,554,726 / 2,569,726 | 2,945,272 / 2,960,272 |

All-gallery body-byte change: **−72.7% phone, −10.6% tablet, −51.8% desktop,
+15.3% high-DPI**. The high-DPI increase buys larger actual candidates rather than
stretching narrow thumbnails. This is an explicit quality/storage tradeoff, not
a universal bandwidth reduction.

The homepage requests four non-gallery images totaling **53,817 body / 55,017
transfer bytes**, unchanged across all four profiles. It requests zero gallery
images. On gallery visits, **zero full images** are requested before opening a
lightbox, before and after. Opening the first photo adds exactly one unchanged
full image: **128,632 body / 128,932 transfer bytes**. No adjacent preloading was
added: these measurements establish no navigation-latency benefit to justify
speculative full-image downloads.

## Candidate decision and sharpness

The issue's 2800px figure is a builder ceiling, not the dimensions of these
committed images. Representative actual files:

| Photo | Shape | Full | Legacy thumbnail |
| --- | --- | --- | --- |
| dsc00881 | Landscape | 1280×853 | 900×600 |
| dsc00782 | Portrait | 720×1280 | 506×900 |
| dsc01749 | Panorama | 1280×533 | 900×375 |

Before writing any published output, candidate WebPs and side-by-side comparisons
were generated under `/private/tmp/issue28-candidates`. Widths 400, 640, 960,
1200 and qualities 72/80 were compared against the legacy thumbnails. A preliminary
480px test also showed savings, but 400px better matches the 358 CSS pixel phone
container. Representative encoded bytes:

| Photo | Legacy thumb | 400px q72 / q80 | 640px q72 / q80 | 960px q72 / q80 | 1200px q72 / q80 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Landscape | 39,126 | 9,878 / 12,694 | 19,994 / 26,172 | 34,234 / 43,706 | 46,182 / 59,510 |
| Portrait | 59,720 | 35,576 / 44,712 | 66,450 / 82,548 | skipped | skipped |
| Panorama | 41,442 | 8,304 / 10,646 | 19,378 / 25,190 | 36,564 / 47,844 | 51,368 / 64,864 |

Chosen: WebP quality **72**, width candidates **400, 640, 960, 1200**, skipping every
width greater than or equal to its source width. Actual height comes from Sharp's
output info. 400 serves small phone/desktop tiles; 640 covers intermediate tiles
and gives the 720px portrait source a larger option than its 506px legacy thumbnail;
960 covers the 720px tablet container for landscapes; 1200 improves high-DPI
landscapes. No image is upscaled during generation. Tiny future imports retain
the legacy fallback when no candidate fits.

Visual checks compared landscape, portrait and panorama at 358 CSS pixels:
400/q72 introduces mild fine-texture softening but retains usable building edges
and scene detail at that display size; q80 costs more without a compelling visible
improvement there. Actual phone, tablet, desktop and DPR-3 gallery screenshots
were also inspected. Portraits on tablet/DPR-3 remain limited by the 720px full
source: a 640px derivative improves on 506px but cannot supply 1074 native pixels
on a 358px DPR-3 screen. These checks are visual judgments, not a perceptual metric
or a claim of lossless fidelity.

**All variants are additional lossy derivatives of committed full WebPs.** No
originals were consulted, no detail was recovered from thumbnails, and no legacy
file was re-encoded. For consistent behavior, future imports and explicit full
replacement also derive variants from their staged full image. A candidate can be
reproduced without touching published output using the already-installed Sharp:

```sh
node --input-type=module -e "import sharp from 'sharp'; await sharp('public/photos/full/current/dsc00881.webp').resize({width:400,withoutEnlargement:true}).webp({quality:72}).toFile('/tmp/dsc00881-400-q72.webp')"
```

## Contract and validation

- v3 `Photo.srcSet` is an array of `{src,width,height}`; album `sizes` describes
  **container width** and the library computes each tile's size. The CSS-matching
  size rules preserve the existing columns/rows breakpoints. Its default
  `loading="lazy"` and `decoding="async"` remain in use.
- v3 automatically adds `photo.src` at `photo.width` if that width is absent in
  candidates. The renderer uses the largest candidate's actual dimensions so it
  never labels a thumbnail with full-image dimensions or adds a full URL to the
  gallery's `srcSet`. Published manifest `width/height` still describe the full.
- `photos:variants` is an explicit source-less migration, outside build/install/CI.
  It stages the existing gallery, validates source dimensions and collisions,
  derives responsive files, resolves authored metadata, and uses the existing
  rollback transaction. It leaves authored layout and legacy file bytes intact.
- Album imports/updates and explicit full replacement generate the same contract.
  Imports recognize variant-only updates; shrinking a source removes only its
  obsolete known derivatives. Sync validates/preserves derived fields without
  originals. Prune reports and removes exactly the selected photos' known files.
  Unknown destination files cause migration/import to fail rather than overwrite.
- Synthetic tests cover actual dimensions, no enlargement, repeated replacement,
  source-less sync/migration, malformed candidates, collisions, album-scoped
  additions/updates, precise pruning, and migration/import/prune rollback.
- Production browser tests cover homepage exclusion, direct gallery loading,
  delayed and failed chunks with reload recovery, teaser/Back/Forward, actual
  candidate selection and deferred full-image requests at 320, 390, 820, 1100,
  1440 and 1600px plus DPR 3. Existing multi-section, empty, one-photo, panorama,
  keyboard/focus, scroll-lock, wraparound and dialog tests remain green.
- Complete Node 22 gate: lint, format check, **33 synthetic tests**, build,
  **42 production browser tests**. Also `git diff --check`, `photos:check` (50 photos,
  186 actual derivatives), reproducible network measurements, explicit formatting/
  syntax review of scripts outside the configured gate, and legacy-asset diff audit.

All issue acceptance criteria are addressed. Remaining limits: additional lossy
encoding, 6.67 MB more repository assets, higher high-DPI transfer, and sharpness
bounded by existing full-image resolution. The PR must remain open for owner review;
this report does not authorize merging or deployment.
