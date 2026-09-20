// Explicit, source-less additive migration. Never run as part of install/build.
import { addResponsiveVariants } from './build-photos.mjs'
await addResponsiveVariants()
console.log(
  'Responsive derivatives added; full images and thumbnails preserved.'
)
