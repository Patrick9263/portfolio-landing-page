import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import { buildPhotos, stableNaturalCompare } from './build-photos.mjs'

const makeImage = async (file, width = 32, height = 24) => {
  await fs.mkdir(path.dirname(file), { recursive: true })
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 80, b: 120 },
    },
  })
    .png()
    .toFile(file)
}

const withFixture = async (run) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'photo-build-test-'))
  try {
    await run({
      root,
      sourceDir: path.join(root, 'source'),
      publicPhotosDir: path.join(root, 'public', 'photos'),
      dataFile: path.join(root, 'data', 'photos.json'),
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

test('stable fallback uses natural numeric order and a deterministic tie-break', () => {
  const values = ['img10.png', 'Éclair.png', 'img2.png', 'IMG2.png']
  assert.deepEqual(values.sort(stableNaturalCompare), [
    'IMG2.png',
    'img2.png',
    'img10.png',
    'Éclair.png',
  ])
})

test('committed manifest preserves the 50-photo production gallery', async () => {
  const repositoryRoot = path.resolve(import.meta.dirname, '..')
  const manifest = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, 'src/data/photos.json'), 'utf8')
  )
  const photos = manifest.sections.flatMap((section) =>
    section.albums.flatMap((album) => album.photos)
  )

  assert.equal(manifest.schemaVersion, 2)
  assert.equal(photos.length, 50)
  assert.equal(new Set(photos.map((photo) => photo.src)).size, 50)

  for (const photo of photos) {
    assert.ok(photo.width > 0)
    assert.ok(photo.height > 0)
    await fs.access(path.join(repositoryRoot, 'public', photo.src))
    await fs.access(path.join(repositoryRoot, 'public', photo.fullSrc))
  }
})

test('build preserves authored photo order, metadata, and legacy output paths', async () => {
  await withFixture(async ({ sourceDir, publicPhotosDir, dataFile }) => {
    await makeImage(path.join(sourceDir, 'current', 'img2.png'))
    await makeImage(path.join(sourceDir, 'current', 'img10.png'))
    await fs.mkdir(path.dirname(dataFile), { recursive: true })
    await fs.writeFile(
      dataFile,
      JSON.stringify({
        schemaVersion: 2,
        sections: [
          {
            id: 'current',
            title: 'Current',
            albums: [
              {
                id: 'current',
                title: null,
                sourcePath: '.',
                outputPath: 'current',
                photos: [
                  { id: 'img10', title: 'First', alt: 'First photo' },
                  { id: 'img2', title: 'Second', alt: 'Second photo' },
                ],
              },
            ],
          },
        ],
      })
    )

    const { manifest, additions, removals } = await buildPhotos({
      sourceDir,
      publicPhotosDir,
      dataFile,
    })
    const album = manifest.sections[0].albums[0]

    assert.deepEqual(
      album.photos.map((photo) => photo.id),
      ['img10', 'img2']
    )
    assert.equal(album.photos[0].title, 'First')
    assert.equal(album.photos[0].alt, 'First photo')
    assert.equal(album.photos[0].src, '/photos/thumbs/current/img10.webp')
    assert.equal(album.photos[0].fullSrc, '/photos/full/current/img10.webp')
    assert.equal(additions, 0)
    assert.equal(removals, 0)
    await fs.access(
      path.join(publicPhotosDir, 'thumbs', 'current', 'img10.webp')
    )
    await fs.access(path.join(publicPhotosDir, 'full', 'current', 'img2.webp'))
  })
})

test('new nested albums use deterministic fallback order', async () => {
  await withFixture(async ({ sourceDir, publicPhotosDir, dataFile }) => {
    await makeImage(path.join(sourceDir, '2026', 'Trips', 'img10.png'))
    await makeImage(path.join(sourceDir, '2026', 'Trips', 'img2.png'))

    const { manifest } = await buildPhotos({
      sourceDir,
      publicPhotosDir,
      dataFile,
    })
    const [section] = manifest.sections
    const [album] = section.albums

    assert.equal(section.id, '2026')
    assert.equal(album.id, 'trips')
    assert.equal(album.outputPath, '2026/trips')
    assert.deepEqual(
      album.photos.map((photo) => photo.id),
      ['img2', 'img10']
    )
  })
})

test('slug collisions fail before existing output changes', async () => {
  await withFixture(async ({ sourceDir, publicPhotosDir, dataFile }) => {
    await makeImage(path.join(sourceDir, 'Current', 'Album', 'a_b.png'))
    await makeImage(path.join(sourceDir, 'Current', 'Album', 'a-b.png'))
    await fs.mkdir(publicPhotosDir, { recursive: true })
    const sentinel = path.join(publicPhotosDir, 'keep.txt')
    await fs.writeFile(sentinel, 'keep')

    await assert.rejects(
      buildPhotos({ sourceDir, publicPhotosDir, dataFile }),
      /Photo .* ID collision/
    )
    assert.equal(await fs.readFile(sentinel, 'utf8'), 'keep')
    await assert.rejects(fs.access(dataFile))
  })
})

test('direct section images require an explicitly configured album', async () => {
  await withFixture(async ({ sourceDir, publicPhotosDir, dataFile }) => {
    await makeImage(path.join(sourceDir, 'Current', 'photo.png'))

    await assert.rejects(
      buildPhotos({ sourceDir, publicPhotosDir, dataFile }),
      /no automatic Highlights album is created/
    )
    await assert.rejects(fs.access(publicPhotosDir))
    await assert.rejects(fs.access(dataFile))
  })
})
