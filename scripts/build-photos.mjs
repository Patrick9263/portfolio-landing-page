import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const DEFAULT_SOURCE_DIR = 'photos-source'
const DEFAULT_PUBLIC_PHOTOS_DIR = 'public/photos'
const DEFAULT_DATA_FILE = 'src/data/photos.json'
const SCHEMA_VERSION = 2

const SUPPORTED_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.tif',
  '.tiff',
])

const toTitle = (value) =>
  value
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const compareCodePoints = (left, right) => {
  const leftPoints = [...left]
  const rightPoints = [...right]
  const length = Math.min(leftPoints.length, rightPoints.length)

  for (let index = 0; index < length; index += 1) {
    const difference =
      leftPoints[index].codePointAt(0) - rightPoints[index].codePointAt(0)
    if (difference !== 0) return difference
  }

  return leftPoints.length - rightPoints.length
}

const naturalParts = (value) =>
  value
    .normalize('NFC')
    .toLowerCase()
    .match(/\d+|\D+/g) || []

export const stableNaturalCompare = (left, right) => {
  const leftParts = naturalParts(left)
  const rightParts = naturalParts(right)
  const length = Math.min(leftParts.length, rightParts.length)

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    const leftIsNumber = /^\d+$/.test(leftPart)
    const rightIsNumber = /^\d+$/.test(rightPart)

    if (leftIsNumber && rightIsNumber) {
      const leftNumber = BigInt(leftPart)
      const rightNumber = BigInt(rightPart)
      if (leftNumber !== rightNumber) return leftNumber < rightNumber ? -1 : 1
      if (leftPart.length !== rightPart.length) {
        return leftPart.length - rightPart.length
      }
      continue
    }

    const difference = compareCodePoints(leftPart, rightPart)
    if (difference !== 0) return difference
  }

  if (leftParts.length !== rightParts.length) {
    return leftParts.length - rightParts.length
  }

  return compareCodePoints(left.normalize('NFC'), right.normalize('NFC'))
}

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const getEntries = async (dir) => fs.readdir(dir, { withFileTypes: true })

const getDirectories = async (dir) =>
  (await getEntries(dir))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort(stableNaturalCompare)

const getImageFiles = async (dir) =>
  (await getEntries(dir))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) =>
      SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase())
    )
    .sort(stableNaturalCompare)

const assertUniqueSlugs = (items, context) => {
  const slugs = new Map()

  for (const item of items) {
    const slug = slugify(item)
    if (!slug) throw new Error(`${context} "${item}" produces an empty ID.`)
    if (slugs.has(slug)) {
      throw new Error(
        `${context} ID collision: "${slugs.get(slug)}" and "${item}" both produce "${slug}".`
      )
    }
    slugs.set(slug, item)
  }
}

const readExistingManifest = async (dataFile) => {
  if (!(await pathExists(dataFile))) return null

  const manifest = JSON.parse(await fs.readFile(dataFile, 'utf8'))
  if (
    manifest?.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(manifest.sections)
  ) {
    throw new Error(
      `${dataFile} must use gallery schema version ${SCHEMA_VERSION} before it can guide a rebuild.`
    )
  }
  return manifest
}

const orderFromExisting = (items, existingItems = []) => {
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = []

  for (const existingItem of existingItems) {
    const item = byId.get(existingItem.id)
    if (item) {
      ordered.push(item)
      byId.delete(existingItem.id)
    }
  }

  return [...ordered, ...byId.values()]
}

const collectAlbum = async ({
  sectionId,
  albumFolder,
  sourcePath,
  sourceAlbumDir,
  existingAlbum,
}) => {
  const albumId = existingAlbum?.id || slugify(albumFolder)
  const files = await getImageFiles(sourceAlbumDir)
  assertUniqueSlugs(files, `Photo in ${sourceAlbumDir}`)

  const existingPhotos = new Map(
    (existingAlbum?.photos || []).map((photo) => [photo.id, photo])
  )
  const photos = files.map((file) => {
    const id = slugify(file)
    return { id, file, existing: existingPhotos.get(id) }
  })

  for (const photo of photos) {
    try {
      const metadata = await sharp(
        path.join(sourceAlbumDir, photo.file)
      ).metadata()
      if (!metadata.width || !metadata.height)
        throw new Error('missing dimensions')
    } catch (error) {
      throw new Error(
        `Unreadable image ${path.join(sourceAlbumDir, photo.file)}: ${error.message}`
      )
    }
  }

  return {
    id: albumId,
    title: existingAlbum ? existingAlbum.title : toTitle(albumFolder),
    sourcePath,
    outputPath:
      existingAlbum?.outputPath || path.posix.join(sectionId, albumId),
    photos: orderFromExisting(photos, existingAlbum?.photos),
  }
}

const collectPlan = async (sourceDir, existingManifest) => {
  if (!(await pathExists(sourceDir))) {
    throw new Error(
      `No ${sourceDir} directory found. Published output was not changed.`
    )
  }

  const sectionFolders = await getDirectories(sourceDir)
  if (sectionFolders.length === 0) {
    throw new Error(
      `No sections found in ${sourceDir}. Published output was not changed.`
    )
  }
  assertUniqueSlugs(sectionFolders, `Section in ${sourceDir}`)

  const existingSections = new Map(
    (existingManifest?.sections || []).map((section) => [section.id, section])
  )
  const sections = []

  for (const sectionFolder of sectionFolders) {
    const sectionId = slugify(sectionFolder)
    const sourceSectionDir = path.join(sourceDir, sectionFolder)
    const existingSection = existingSections.get(sectionId)
    const existingAlbums = existingSection?.albums || []
    const nestedAlbumFolders = await getDirectories(sourceSectionDir)
    assertUniqueSlugs(nestedAlbumFolders, `Album in ${sourceSectionDir}`)

    const directImages = await getImageFiles(sourceSectionDir)
    const albumPlans = []

    if (directImages.length > 0) {
      const configuredAlbum = existingAlbums.find(
        (album) => album.sourcePath === '.'
      )
      if (!configuredAlbum) {
        throw new Error(
          `Images found directly in ${sourceSectionDir}. Put them in an explicitly named album or configure an album with sourcePath "."; no automatic Highlights album is created.`
        )
      }
      albumPlans.push(
        await collectAlbum({
          sectionId,
          albumFolder: configuredAlbum.id,
          sourcePath: '.',
          sourceAlbumDir: sourceSectionDir,
          existingAlbum: configuredAlbum,
        })
      )
    }

    for (const albumFolder of nestedAlbumFolders) {
      const albumId = slugify(albumFolder)
      const existingAlbum = existingAlbums.find(
        (album) =>
          album.sourcePath === albumFolder ||
          (!album.sourcePath && album.id === albumId)
      )
      albumPlans.push(
        await collectAlbum({
          sectionId,
          albumFolder,
          sourcePath: albumFolder,
          sourceAlbumDir: path.join(sourceSectionDir, albumFolder),
          existingAlbum,
        })
      )
    }

    const populatedAlbums = albumPlans.filter(
      (album) => album.photos.length > 0
    )
    const albumIds = populatedAlbums.map((album) => album.id)
    if (new Set(albumIds).size !== albumIds.length) {
      throw new Error(`Album ID collision in section "${sectionId}".`)
    }

    const orderedAlbums = orderFromExisting(populatedAlbums, existingAlbums)
    if (orderedAlbums.length > 0) {
      sections.push({
        id: sectionId,
        title: existingSection?.title || toTitle(sectionFolder),
        sourceDir: sourceSectionDir,
        albums: orderedAlbums,
      })
    }
  }

  const orderedSections = orderFromExisting(
    sections,
    existingManifest?.sections
  )
  if (orderedSections.length === 0) {
    throw new Error(
      `No supported images found in ${sourceDir}. Published output was not changed.`
    )
  }

  const outputPaths = new Set()
  for (const section of orderedSections) {
    for (const album of section.albums) {
      if (outputPaths.has(album.outputPath)) {
        throw new Error(`Output path collision at "${album.outputPath}".`)
      }
      outputPaths.add(album.outputPath)
    }
  }
  return orderedSections
}

const generateCandidate = async (sections, stagePhotosDir) => {
  const generatedSections = []

  for (const section of sections) {
    const albums = []
    for (const album of section.albums) {
      const fullAlbumDir = path.join(stagePhotosDir, 'full', album.outputPath)
      const thumbAlbumDir = path.join(
        stagePhotosDir,
        'thumbs',
        album.outputPath
      )
      await fs.mkdir(fullAlbumDir, { recursive: true })
      await fs.mkdir(thumbAlbumDir, { recursive: true })

      const photos = []
      for (const photo of album.photos) {
        const sourcePath = path.join(
          section.sourceDir,
          album.sourcePath,
          photo.file
        )
        const outputFile = `${photo.id}.webp`
        const fullOutputPath = path.join(fullAlbumDir, outputFile)
        const thumbOutputPath = path.join(thumbAlbumDir, outputFile)

        await sharp(sourcePath)
          .rotate()
          .resize({
            width: 2800,
            height: 2800,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toFile(fullOutputPath)

        await sharp(sourcePath)
          .rotate()
          .resize({
            width: 900,
            height: 900,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: 76 })
          .toFile(thumbOutputPath)

        const metadata = await sharp(fullOutputPath).metadata()
        const title = photo.existing?.title || toTitle(photo.file)
        photos.push({
          id: photo.id,
          src: `/photos/thumbs/${album.outputPath}/${outputFile}`,
          fullSrc: `/photos/full/${album.outputPath}/${outputFile}`,
          width: metadata.width,
          height: metadata.height,
          title,
          alt: photo.existing?.alt || title,
        })
      }

      albums.push({
        id: album.id,
        title: album.title,
        sourcePath: album.sourcePath,
        outputPath: album.outputPath,
        photos,
      })
    }
    generatedSections.push({ id: section.id, title: section.title, albums })
  }

  return { schemaVersion: SCHEMA_VERSION, sections: generatedSections }
}

const replaceGeneratedOutput = async ({
  stagePhotosDir,
  stageDataFile,
  publicPhotosDir,
  dataFile,
}) => {
  const suffix = randomUUID()
  const photosBackup = `${publicPhotosDir}.backup-${suffix}`
  const dataBackup = `${dataFile}.backup-${suffix}`
  const hadPhotos = await pathExists(publicPhotosDir)
  const hadData = await pathExists(dataFile)
  let photosBackedUp = false
  let dataBackedUp = false

  await fs.mkdir(path.dirname(publicPhotosDir), { recursive: true })
  await fs.mkdir(path.dirname(dataFile), { recursive: true })

  try {
    if (hadPhotos) {
      await fs.rename(publicPhotosDir, photosBackup)
      photosBackedUp = true
    }
    if (hadData) {
      await fs.rename(dataFile, dataBackup)
      dataBackedUp = true
    }
    await fs.rename(stagePhotosDir, publicPhotosDir)
    await fs.rename(stageDataFile, dataFile)
  } catch (error) {
    if (await pathExists(publicPhotosDir)) {
      await fs.rm(publicPhotosDir, { recursive: true })
    }
    if (await pathExists(dataFile)) await fs.rm(dataFile)
    if (photosBackedUp) await fs.rename(photosBackup, publicPhotosDir)
    if (dataBackedUp) await fs.rename(dataBackup, dataFile)
    throw error
  }

  if (photosBackedUp) {
    await fs.rm(photosBackup, { recursive: true, force: true })
  }
  if (dataBackedUp) await fs.rm(dataBackup, { force: true })
}

const photoKeys = (manifest) =>
  new Set(
    (manifest?.sections || []).flatMap((section) =>
      section.albums.flatMap((album) =>
        album.photos.map((photo) => `${section.id}/${album.id}/${photo.id}`)
      )
    )
  )

export const buildPhotos = async ({
  sourceDir = DEFAULT_SOURCE_DIR,
  publicPhotosDir = DEFAULT_PUBLIC_PHOTOS_DIR,
  dataFile = DEFAULT_DATA_FILE,
  onPlan = () => {},
} = {}) => {
  const existingManifest = await readExistingManifest(dataFile)
  const sections = await collectPlan(sourceDir, existingManifest)
  await fs.mkdir(path.dirname(publicPhotosDir), { recursive: true })
  const stageRoot = await fs.mkdtemp(
    path.join(path.dirname(publicPhotosDir), '.photos-stage-')
  )
  const stagePhotosDir = path.join(stageRoot, 'photos')
  const stageDataFile = path.join(stageRoot, 'photos.json')

  try {
    const manifest = await generateCandidate(sections, stagePhotosDir)
    await fs.writeFile(stageDataFile, `${JSON.stringify(manifest, null, 2)}\n`)
    const oldKeys = photoKeys(existingManifest)
    const newKeys = photoKeys(manifest)
    const additions = [...newKeys].filter((key) => !oldKeys.has(key)).length
    const removals = [...oldKeys].filter((key) => !newKeys.has(key)).length
    onPlan({ additions, removals })

    await replaceGeneratedOutput({
      stagePhotosDir,
      stageDataFile,
      publicPhotosDir,
      dataFile,
    })

    return { manifest, additions, removals }
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true })
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  if (!process.argv.includes('--replace-all')) {
    console.error(
      'Refusing to replace the committed gallery without --replace-all. Confirm that photos-source is a complete full-gallery inventory; partial imports and pruning belong to issue #25.'
    )
    process.exitCode = 1
  } else {
    buildPhotos({
      onPlan: ({ additions, removals }) => {
        console.log(
          `Replacing the full gallery: ${additions} additions, ${removals} removals.`
        )
      },
    })
      .then(({ additions, removals }) => {
        console.log(
          `Generated ${DEFAULT_DATA_FILE} (${additions} additions, ${removals} removals).`
        )
      })
      .catch((error) => {
        console.error(error.message)
        process.exitCode = 1
      })
  }
}
