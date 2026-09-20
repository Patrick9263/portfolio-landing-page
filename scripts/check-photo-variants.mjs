// Read-only check of committed delivery metadata and actual files; no originals.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { resolveLayout } from './build-photos.mjs'

const manifest = JSON.parse(await fs.readFile('src/data/photos.json', 'utf8'))
const layout = JSON.parse(
  await fs.readFile('src/data/photo-layout.json', 'utf8')
)
assert.deepEqual(resolveLayout(layout, manifest), manifest)
const urls = new Set()
let photoCount = 0
for (const section of manifest.sections) {
  for (const album of section.albums) {
    for (const photo of album.photos) {
      photoCount++
      const full = await sharp(path.join('public', photo.fullSrc)).metadata()
      assert.equal(full.width, photo.width)
      assert.equal(full.height, photo.height)
      for (const candidate of photo.srcSet || []) {
        const metadata = await sharp(
          path.join('public', candidate.src)
        ).metadata()
        assert.equal(metadata.width, candidate.width)
        assert.equal(metadata.height, candidate.height)
        assert.ok(candidate.width < full.width)
        assert.ok(candidate.height <= full.height)
        assert.ok(!urls.has(candidate.src))
        urls.add(candidate.src)
      }
    }
  }
}
const visit = async (directory) => {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await visit(file)
    else
      assert.ok(
        urls.has('/' + path.relative('public', file)),
        `Unreferenced derivative: ${file}`
      )
  }
}
await visit('public/photos/responsive')
console.log(
  `Verified ${photoCount} photos and ${urls.size} responsive derivatives without originals.`
)
