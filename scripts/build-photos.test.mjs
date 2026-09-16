import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import sharp from 'sharp'
import {
  buildPhotos,
  importAlbum,
  pruneAlbum,
  resolveLayout,
  stableNaturalCompare,
  syncPhotos,
} from './build-photos.mjs'

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
      layoutFile: path.join(root, 'data', 'photo-layout.json'),
    })
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}

const makePhotoRecord = (sectionId, albumId, photoId, overrides = {}) => ({
  id: photoId,
  src: `/photos/thumbs/${sectionId}/${albumId}/${photoId}.webp`,
  fullSrc: `/photos/full/${sectionId}/${albumId}/${photoId}.webp`,
  width: 32,
  height: 24,
  title: photoId,
  alt: photoId,
  ...overrides,
})

const makePublishedManifest = () => ({
  schemaVersion: 2,
  sections: [
    {
      id: 'current',
      title: 'Current',
      albums: [
        {
          id: 'events',
          title: 'Events',
          sourcePath: 'Events',
          outputPath: 'current/events',
          photos: [
            makePhotoRecord('current', 'events', 'keep-first'),
            makePhotoRecord('current', 'events', 'replace-me'),
            makePhotoRecord('current', 'events', 'keep-last'),
          ],
        },
        {
          id: 'other',
          title: 'Other',
          sourcePath: 'Other',
          outputPath: 'current/other',
          photos: [makePhotoRecord('current', 'other', 'unrelated')],
        },
      ],
    },
    {
      id: 'archive',
      title: 'Archive',
      albums: [
        {
          id: 'legacy',
          title: 'Legacy',
          sourcePath: 'Legacy',
          outputPath: 'archive/legacy',
          photos: [makePhotoRecord('archive', 'legacy', 'historic')],
        },
      ],
    },
  ],
})

const layoutFromManifest = (manifest) => ({
  layoutVersion: 1,
  sections: manifest.sections.map((section) => ({
    id: section.id,
    title: section.title,
    albums: section.albums.map((album) => ({
      id: album.id,
      title: album.title,
      sourcePath: album.sourcePath,
      outputPath: album.outputPath,
      photos: album.photos.map(({ id, title, alt }) => ({ id, title, alt })),
    })),
  })),
})

const writePublishedFixture = async ({
  publicPhotosDir,
  dataFile,
  layoutFile,
}) => {
  const manifest = makePublishedManifest()
  await fs.mkdir(path.dirname(dataFile), { recursive: true })
  await fs.writeFile(dataFile, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.writeFile(
    layoutFile,
    `${JSON.stringify(layoutFromManifest(manifest), null, 2)}\n`
  )

  for (const photo of manifest.sections.flatMap((section) =>
    section.albums.flatMap((album) => album.photos)
  )) {
    for (const assetPath of [photo.src, photo.fullSrc]) {
      const target = path.join(
        publicPhotosDir,
        assetPath.slice('/photos/'.length)
      )
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, `published:${assetPath}`)
    }
  }
  return manifest
}

const readManifest = async (dataFile) =>
  JSON.parse(await fs.readFile(dataFile, 'utf8'))

const cloneForTest = (value) => JSON.parse(JSON.stringify(value))

const albumFrom = (manifest, sectionId, albumId) =>
  manifest.sections
    .find((section) => section.id === sectionId)
    .albums.find((album) => album.id === albumId)

const snapshotPath = async (targetPath) => {
  const stat = await fs.stat(targetPath)
  if (stat.isFile()) return await fs.readFile(targetPath)

  const result = {}
  const visit = async (directory, relative = '') => {
    const names = (await fs.readdir(directory)).sort()
    for (const name of names) {
      const absolute = path.join(directory, name)
      const childRelative = path.join(relative, name)
      const childStat = await fs.stat(absolute)
      if (childStat.isDirectory()) await visit(absolute, childRelative)
      else result[childRelative] = (await fs.readFile(absolute)).toString('hex')
    }
  }
  await visit(targetPath)
  return result
}

const importOptions = (
  { sourceDir, publicPhotosDir, dataFile, layoutFile },
  overrides = {}
) => ({
  sectionId: 'current',
  albumId: 'events',
  sourceAlbumDir: path.join(sourceDir, 'selected'),
  publicPhotosDir,
  dataFile,
  layoutFile,
  ...overrides,
})

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
  const layout = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, 'src/data/photo-layout.json'),
      'utf8'
    )
  )
  const photos = manifest.sections.flatMap((section) =>
    section.albums.flatMap((album) => album.photos)
  )

  assert.equal(manifest.schemaVersion, 2)
  assert.equal(layout.layoutVersion, 1)
  assert.deepEqual(resolveLayout(layout, manifest), manifest)
  assert.equal(photos.length, 50)
  assert.equal(new Set(photos.map((photo) => photo.src)).size, 50)

  for (const photo of photos) {
    assert.ok(photo.width > 0)
    assert.ok(photo.height > 0)
    await fs.access(path.join(repositoryRoot, 'public', photo.src))
    await fs.access(path.join(repositoryRoot, 'public', photo.fullSrc))
  }
})

test('sync applies authored section, album, and photo order without touching assets', async () => {
  await withFixture(async (fixture) => {
    const manifest = await writePublishedFixture(fixture)
    const layout = layoutFromManifest(manifest)
    layout.sections.reverse()
    layout.sections.find((section) => section.id === 'current').albums.reverse()
    const events = layout.sections
      .find((section) => section.id === 'current')
      .albums.find((album) => album.id === 'events')
    events.photos.reverse()
    events.photos[0].title = 'Authored title'
    events.photos[0].alt = 'Authored alt'
    await fs.writeFile(fixture.layoutFile, JSON.stringify(layout, null, 2))
    const assetsBefore = await snapshotPath(fixture.publicPhotosDir)

    const first = await syncPhotos(fixture)
    const syncedBytes = await snapshotPath(fixture.dataFile)
    const synced = await readManifest(fixture.dataFile)
    const second = await syncPhotos(fixture)

    assert.equal(first.changed, true)
    assert.equal(second.changed, false)
    assert.deepEqual(
      synced.sections.map((section) => section.id),
      ['archive', 'current']
    )
    assert.deepEqual(
      synced.sections
        .find((section) => section.id === 'current')
        .albums.map((album) => album.id),
      ['other', 'events']
    )
    assert.deepEqual(
      albumFrom(synced, 'current', 'events').photos.map((photo) => photo.id),
      ['keep-last', 'replace-me', 'keep-first']
    )
    assert.equal(
      albumFrom(synced, 'current', 'events').photos[0].title,
      'Authored title'
    )
    assert.deepEqual(await snapshotPath(fixture.dataFile), syncedBytes)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), assetsBefore)
  })
})

test('layout validation rejects duplicate and Unicode-equivalent IDs', () => {
  const cases = [
    (layout) => layout.sections.push(cloneForTest(layout.sections[0])),
    (layout) =>
      layout.sections[0].albums.push(
        cloneForTest(layout.sections[0].albums[0])
      ),
    (layout) =>
      layout.sections[0].albums[0].photos.push(
        cloneForTest(layout.sections[0].albums[0].photos[0])
      ),
    (layout) => {
      layout.sections[0].albums[0].photos[0].id = 'é'
      layout.sections[0].albums[0].photos[1].id = 'é'
    },
  ]

  for (const mutate of cases) {
    const manifest = makePublishedManifest()
    const layout = layoutFromManifest(manifest)
    mutate(layout)
    assert.throws(() => resolveLayout(layout, manifest), /duplicate|colliding/i)
  }
})

test('authored layout rejects processor-derived photo fields', () => {
  const manifest = makePublishedManifest()
  const layout = layoutFromManifest(manifest)
  layout.sections[0].albums[0].photos[0].width = 100

  assert.throws(
    () => resolveLayout(layout, manifest),
    /generated field "width"/
  )
})

test('year-like and non-year sections stay in authored order', () => {
  const manifest = makePublishedManifest()
  manifest.sections[0].id = '2026'
  manifest.sections[0].title = '2026'
  manifest.sections[1].id = 'favorites'
  manifest.sections[1].title = 'Favorites'
  const layout = layoutFromManifest(manifest)
  layout.sections.reverse()

  assert.deepEqual(
    resolveLayout(layout, manifest).sections.map((section) => section.id),
    ['favorites', '2026']
  )
})

test('sync rejects missing and unknown stable IDs instead of guessing', async () => {
  await withFixture(async (fixture) => {
    const manifest = await writePublishedFixture(fixture)
    const layout = layoutFromManifest(manifest)
    layout.sections[0].albums[0].photos.push({
      id: 'unknown-photo',
      title: 'Unknown',
      alt: 'Unknown',
    })
    await fs.writeFile(fixture.layoutFile, JSON.stringify(layout))

    await assert.rejects(syncPhotos(fixture), /has no generated record/)
  })
})

test('build preserves authored photo order, metadata, and legacy output paths', async () => {
  await withFixture(
    async ({ sourceDir, publicPhotosDir, dataFile, layoutFile }) => {
      await makeImage(path.join(sourceDir, 'current', 'img2.png'))
      await makeImage(path.join(sourceDir, 'current', 'img10.png'))
      await fs.mkdir(path.dirname(dataFile), { recursive: true })
      await fs.writeFile(
        layoutFile,
        JSON.stringify({
          layoutVersion: 1,
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
        layoutFile,
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
      assert.equal(additions, 2)
      assert.equal(removals, 0)
      await fs.access(
        path.join(publicPhotosDir, 'thumbs', 'current', 'img10.webp')
      )
      await fs.access(
        path.join(publicPhotosDir, 'full', 'current', 'img2.webp')
      )
    }
  )
})

test('new nested albums use deterministic fallback order', async () => {
  await withFixture(
    async ({ sourceDir, publicPhotosDir, dataFile, layoutFile }) => {
      await makeImage(path.join(sourceDir, '2026', 'Trips', 'img10.png'))
      await makeImage(path.join(sourceDir, '2026', 'Trips', 'img2.png'))

      const { manifest } = await buildPhotos({
        sourceDir,
        publicPhotosDir,
        dataFile,
        layoutFile,
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
    }
  )
})

test('slug collisions fail before existing output changes', async () => {
  await withFixture(
    async ({ sourceDir, publicPhotosDir, dataFile, layoutFile }) => {
      await makeImage(path.join(sourceDir, 'Current', 'Album', 'a_b.png'))
      await makeImage(path.join(sourceDir, 'Current', 'Album', 'a-b.png'))
      await fs.mkdir(publicPhotosDir, { recursive: true })
      const sentinel = path.join(publicPhotosDir, 'keep.txt')
      await fs.writeFile(sentinel, 'keep')

      await assert.rejects(
        buildPhotos({ sourceDir, publicPhotosDir, dataFile, layoutFile }),
        /Photo .* ID collision/
      )
      assert.equal(await fs.readFile(sentinel, 'utf8'), 'keep')
      await assert.rejects(fs.access(dataFile))
    }
  )
})

test('direct section images require an explicitly configured album', async () => {
  await withFixture(
    async ({ sourceDir, publicPhotosDir, dataFile, layoutFile }) => {
      await makeImage(path.join(sourceDir, 'Current', 'photo.png'))

      await assert.rejects(
        buildPhotos({ sourceDir, publicPhotosDir, dataFile, layoutFile }),
        /no automatic Highlights album is created/
      )
      await assert.rejects(fs.access(publicPhotosDir))
      await assert.rejects(fs.access(dataFile))
    }
  )
})

test('partial album import adds and replaces photos while preserving missing and unrelated published work', async () => {
  await withFixture(async (fixture) => {
    const { sourceDir, publicPhotosDir, dataFile } = fixture
    const original = await writePublishedFixture(fixture)
    const unrelatedAlbum = albumFrom(original, 'current', 'other')
    const unrelatedAsset = path.join(
      publicPhotosDir,
      unrelatedAlbum.photos[0].src.slice('/photos/'.length)
    )
    const unrelatedBytes = await fs.readFile(unrelatedAsset)
    const candidate = path.join(publicPhotosDir, 'candidate-note.txt')
    await fs.writeFile(candidate, 'uncommitted candidate')

    await makeImage(path.join(sourceDir, 'selected', 'replace-me.png'), 48, 30)
    await makeImage(path.join(sourceDir, 'selected', 'img10.png'))
    await makeImage(path.join(sourceDir, 'selected', 'img2.png'))

    const { report } = await importAlbum(importOptions(fixture))
    const manifest = await readManifest(dataFile)
    const album = albumFrom(manifest, 'current', 'events')

    assert.deepEqual(
      album.photos.map((photo) => photo.id),
      ['keep-first', 'replace-me', 'keep-last', 'img2', 'img10']
    )
    assert.deepEqual(report.added, ['img2', 'img10'])
    assert.deepEqual(report.updated, ['replace-me'])
    assert.deepEqual(report.removals, [])
    assert.deepEqual(albumFrom(manifest, 'current', 'other'), unrelatedAlbum)
    assert.deepEqual(
      albumFrom(
        JSON.parse(await fs.readFile(fixture.layoutFile, 'utf8')),
        'current',
        'other'
      ),
      layoutFromManifest(original).sections[0].albums[1]
    )
    assert.deepEqual(await fs.readFile(unrelatedAsset), unrelatedBytes)
    assert.equal(await fs.readFile(candidate, 'utf8'), 'uncommitted candidate')
    await fs.access(path.join(publicPhotosDir, 'full/current/events/img2.webp'))
    await fs.access(
      path.join(publicPhotosDir, 'thumbs/current/events/img10.webp')
    )
  })
})

test('a renamed source becomes a new ID while the old published ID remains', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(
      path.join(fixture.sourceDir, 'selected', 'replacement-name.png')
    )

    await importAlbum(importOptions(fixture))

    const manifest = await readManifest(fixture.dataFile)
    const layout = JSON.parse(await fs.readFile(fixture.layoutFile, 'utf8'))
    assert.deepEqual(
      albumFrom(manifest, 'current', 'events').photos.map((photo) => photo.id),
      ['keep-first', 'replace-me', 'keep-last', 'replacement-name']
    )
    assert.deepEqual(
      albumFrom(layout, 'current', 'events').photos.map((photo) => photo.id),
      ['keep-first', 'replace-me', 'keep-last', 'replacement-name']
    )
  })
})

test('repeated album import is byte-for-byte idempotent', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(
      path.join(fixture.sourceDir, 'selected', 'replace-me.png'),
      48,
      30
    )
    const options = importOptions(fixture)

    await importAlbum(options)
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeLayout = await snapshotPath(fixture.layoutFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)
    const { report } = await importAlbum(options)

    assert.deepEqual(report.updated, [])
    assert.deepEqual(report.unchangedImported, ['replace-me'])
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.layoutFile), beforeLayout)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
  })
})

test('album import dry run reports a candidate without changing published files', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'new-photo.png'))
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

    const { report } = await importAlbum(
      importOptions(fixture, { dryRun: true })
    )

    assert.deepEqual(report.added, ['new-photo'])
    assert.equal(report.target, 'current/events')
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
  })
})

test('new album creation requires explicit editorial metadata and appends the album', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'opening.png'))

    await assert.rejects(
      importAlbum(
        importOptions(fixture, {
          albumId: 'new-album',
          createAlbum: true,
        })
      ),
      /requires non-empty --album-title and --source-path/
    )

    await importAlbum(
      importOptions(fixture, {
        albumId: 'new-album',
        createAlbum: true,
        albumTitle: 'New Album',
        sourcePath: 'New Album',
      })
    )
    const section = (await readManifest(fixture.dataFile)).sections.find(
      (item) => item.id === 'current'
    )
    assert.deepEqual(
      section.albums.map((album) => album.id),
      ['events', 'other', 'new-album']
    )
    assert.equal(section.albums.at(-1).sourcePath, 'New Album')
  })
})

test('new non-year section creation is explicit and appends authored structure', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'favorite.png'))

    await importAlbum(
      importOptions(fixture, {
        sectionId: 'favorites',
        albumId: 'portraits',
        createSection: true,
        createAlbum: true,
        sectionTitle: 'Favorites',
        albumTitle: 'Portraits',
        sourcePath: 'Portraits',
      })
    )
    const manifest = await readManifest(fixture.dataFile)
    const layout = JSON.parse(await fs.readFile(fixture.layoutFile, 'utf8'))
    assert.deepEqual(
      manifest.sections.map((section) => section.id),
      ['current', 'archive', 'favorites']
    )
    assert.deepEqual(
      layout.sections.map((section) => section.id),
      ['current', 'archive', 'favorites']
    )
    assert.equal(manifest.sections.at(-1).title, 'Favorites')
    assert.equal(manifest.sections.at(-1).albums[0].id, 'portraits')
  })
})

test('album import rejects unsupported files, corrupt images, and nesting before writes', async () => {
  const cases = [
    {
      name: 'unsupported file',
      setup: async (directory) => {
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(path.join(directory, 'notes.txt'), 'not an image')
      },
      message: /Unsupported file/,
    },
    {
      name: 'corrupt image',
      setup: async (directory) => {
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(path.join(directory, 'broken.png'), 'not a png')
      },
      message: /Unreadable image/,
    },
    {
      name: 'nested album',
      setup: async (directory) => {
        await makeImage(path.join(directory, 'another-album', 'photo.png'))
      },
      message: /Unexpected nested directory/,
    },
  ]

  for (const item of cases) {
    await withFixture(async (fixture) => {
      await writePublishedFixture(fixture)
      await item.setup(path.join(fixture.sourceDir, 'selected'))
      const beforeManifest = await snapshotPath(fixture.dataFile)
      const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

      await assert.rejects(importAlbum(importOptions(fixture)), item.message)
      assert.deepEqual(
        await snapshotPath(fixture.dataFile),
        beforeManifest,
        item.name
      )
      assert.deepEqual(
        await snapshotPath(fixture.publicPhotosDir),
        beforeAssets,
        item.name
      )
    })
  }
})

test('album import rejects source slug collisions before writes', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'same-name.png'))
    await makeImage(path.join(fixture.sourceDir, 'selected', 'same_name.jpg'))
    const before = await snapshotPath(fixture.publicPhotosDir)

    await assert.rejects(
      importAlbum(importOptions(fixture)),
      /Photo .* ID collision/
    )
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), before)
  })
})

test('album import rejects duplicate manifest IDs and output-path collisions', async () => {
  for (const mutation of [
    (manifest) => {
      manifest.sections[0].albums[0].photos.push({
        ...manifest.sections[0].albums[0].photos[0],
      })
    },
    (manifest) => {
      manifest.sections[0].albums[1].outputPath = 'CURRENT/EVENTS'
    },
    (manifest) => {
      manifest.sections[0].albums[1].sourcePath = 'events'
    },
  ]) {
    await withFixture(async (fixture) => {
      const manifest = await writePublishedFixture(fixture)
      mutation(manifest)
      await fs.writeFile(fixture.dataFile, JSON.stringify(manifest))
      await makeImage(path.join(fixture.sourceDir, 'selected', 'photo.png'))
      const before = await snapshotPath(fixture.publicPhotosDir)

      await assert.rejects(
        importAlbum(importOptions(fixture)),
        /duplicate|colliding|ambiguous/i
      )
      assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), before)
    })
  }
})

test('new album import rejects an output-path collision before staging', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'photo.png'))
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

    await assert.rejects(
      importAlbum(
        importOptions(fixture, {
          albumId: 'collision',
          createAlbum: true,
          albumTitle: 'Collision',
          sourcePath: 'Collision',
          outputPath: 'CURRENT/EVENTS',
        })
      ),
      /colliding album output paths/
    )
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
    assert.deepEqual(
      (await fs.readdir(path.dirname(fixture.publicPhotosDir))).filter((name) =>
        name.startsWith('.photos-stage-')
      ),
      []
    )
  })
})

test('generation failure preserves the prior manifest, assets, and uncommitted candidate files', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'new-photo.png'))
    await fs.writeFile(
      path.join(fixture.publicPhotosDir, 'candidate.txt'),
      'keep candidate'
    )
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeLayout = await snapshotPath(fixture.layoutFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

    await assert.rejects(
      importAlbum(
        importOptions(fixture, {
          onGeneratePhoto: () => {
            throw new Error('injected generation failure')
          },
        })
      ),
      /injected generation failure/
    )
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.layoutFile), beforeLayout)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
    assert.deepEqual(
      (await fs.readdir(path.dirname(fixture.publicPhotosDir))).filter((name) =>
        name.startsWith('.photos-stage-')
      ),
      []
    )
  })
})

test('failure during the final switch rolls back manifest and assets without deleting candidates', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await makeImage(path.join(fixture.sourceDir, 'selected', 'new-photo.png'))
    await fs.writeFile(
      path.join(fixture.publicPhotosDir, 'candidate.txt'),
      'keep candidate'
    )
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeLayout = await snapshotPath(fixture.layoutFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

    await assert.rejects(
      importAlbum(
        importOptions(fixture, {
          onSwitchStep: (step) => {
            if (step === 'install-manifest') {
              throw new Error('injected final switch failure')
            }
          },
        })
      ),
      /injected final switch failure/
    )
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.layoutFile), beforeLayout)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
    assert.deepEqual(
      (await fs.readdir(path.dirname(fixture.publicPhotosDir))).filter(
        (name) => name.startsWith('.photos-stage-') || name.includes('.backup-')
      ),
      []
    )
  })
})

test('prune dry run reports exact removals without changing published files', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

    const { report } = await pruneAlbum({
      sectionId: 'current',
      albumId: 'events',
      photoIds: ['replace-me'],
      dryRun: true,
      publicPhotosDir: fixture.publicPhotosDir,
      dataFile: fixture.dataFile,
      layoutFile: fixture.layoutFile,
    })

    assert.deepEqual(report.removals, ['replace-me'])
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
  })
})

test('prune requires confirmation and removes only explicit photos in the selected album', async () => {
  await withFixture(async (fixture) => {
    const original = await writePublishedFixture(fixture)
    const unrelatedBefore = albumFrom(original, 'current', 'other')
    const unrelatedAsset = path.join(
      fixture.publicPhotosDir,
      unrelatedBefore.photos[0].src.slice('/photos/'.length)
    )
    const unrelatedBytes = await fs.readFile(unrelatedAsset)
    const options = {
      sectionId: 'current',
      albumId: 'events',
      photoIds: ['replace-me'],
      publicPhotosDir: fixture.publicPhotosDir,
      dataFile: fixture.dataFile,
      layoutFile: fixture.layoutFile,
    }

    await assert.rejects(pruneAlbum(options), /--confirm-prune/)
    await pruneAlbum({ ...options, confirm: true })

    const manifest = await readManifest(fixture.dataFile)
    const layout = JSON.parse(await fs.readFile(fixture.layoutFile, 'utf8'))
    assert.deepEqual(
      albumFrom(manifest, 'current', 'events').photos.map((photo) => photo.id),
      ['keep-first', 'keep-last']
    )
    assert.deepEqual(
      albumFrom(layout, 'current', 'events').photos.map((photo) => photo.id),
      ['keep-first', 'keep-last']
    )
    assert.deepEqual(albumFrom(manifest, 'current', 'other'), unrelatedBefore)
    assert.deepEqual(await fs.readFile(unrelatedAsset), unrelatedBytes)
    await assert.rejects(
      fs.access(
        path.join(
          fixture.publicPhotosDir,
          'thumbs/current/events/replace-me.webp'
        )
      )
    )
  })
})

test('prune rejects ambiguous or missing targets without affecting output', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    const before = await snapshotPath(fixture.publicPhotosDir)

    await assert.rejects(
      pruneAlbum({
        sectionId: 'current',
        albumId: 'events',
        photoIds: ['missing'],
        confirm: true,
        publicPhotosDir: fixture.publicPhotosDir,
        dataFile: fixture.dataFile,
        layoutFile: fixture.layoutFile,
      }),
      /does not exist/
    )
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), before)
  })
})

test('prune switch failure rolls back the selected removal and preserves unrelated output', async () => {
  await withFixture(async (fixture) => {
    await writePublishedFixture(fixture)
    await fs.writeFile(
      path.join(fixture.publicPhotosDir, 'candidate.txt'),
      'keep candidate'
    )
    const beforeManifest = await snapshotPath(fixture.dataFile)
    const beforeLayout = await snapshotPath(fixture.layoutFile)
    const beforeAssets = await snapshotPath(fixture.publicPhotosDir)

    await assert.rejects(
      pruneAlbum({
        sectionId: 'current',
        albumId: 'events',
        photoIds: ['replace-me'],
        confirm: true,
        publicPhotosDir: fixture.publicPhotosDir,
        dataFile: fixture.dataFile,
        layoutFile: fixture.layoutFile,
        onSwitchStep: (step) => {
          if (step === 'install-manifest') {
            throw new Error('injected prune switch failure')
          }
        },
      }),
      /injected prune switch failure/
    )
    assert.deepEqual(await snapshotPath(fixture.dataFile), beforeManifest)
    assert.deepEqual(await snapshotPath(fixture.layoutFile), beforeLayout)
    assert.deepEqual(await snapshotPath(fixture.publicPhotosDir), beforeAssets)
  })
})
