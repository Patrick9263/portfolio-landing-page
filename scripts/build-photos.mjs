import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import console from 'node:console'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'

const DEFAULT_SOURCE_DIR = 'photos-source'
const DEFAULT_PUBLIC_PHOTOS_DIR = 'public/photos'
const DEFAULT_DATA_FILE = 'src/data/photos.json'
const DEFAULT_LAYOUT_FILE = 'src/data/photo-layout.json'
const SCHEMA_VERSION = 2
const LAYOUT_VERSION = 1
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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

const canonicalCollisionKey = (value) => value.normalize('NFC').toLowerCase()

const assertUniqueCanonicalValues = (items, context) => {
  const values = new Map()

  for (const item of items) {
    const key = canonicalCollisionKey(item)
    if (values.has(key)) {
      throw new Error(
        `${context} collision: "${values.get(key)}" and "${item}" differ only by case or Unicode normalization.`
      )
    }
    values.set(key, item)
  }
}

const assertSafeId = (id, context) => {
  if (!ID_PATTERN.test(id)) {
    throw new Error(
      `${context} "${id}" must be a lowercase slug containing only letters, numbers, and single hyphens.`
    )
  }
}

const assertSafeOutputPath = (outputPath, context) => {
  if (
    typeof outputPath !== 'string' ||
    !outputPath ||
    path.posix.isAbsolute(outputPath) ||
    path.posix.normalize(outputPath) !== outputPath ||
    outputPath === '.' ||
    outputPath.split('/').some((part) => !part || part === '..')
  ) {
    throw new Error(`${context} has unsafe outputPath "${outputPath}".`)
  }
}

const validateManifest = (
  manifest,
  dataFile,
  { requirePublishedRecords = true } = {}
) => {
  if (
    manifest?.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(manifest.sections)
  ) {
    throw new Error(
      `${dataFile} must use gallery schema version ${SCHEMA_VERSION} before it can guide a photo operation.`
    )
  }

  const sectionIds = new Set()
  const canonicalSectionIds = new Map()
  const assetPaths = new Map()
  const albumOutputPaths = new Map()

  for (const section of manifest.sections) {
    if (
      !section ||
      typeof section.id !== 'string' ||
      !Array.isArray(section.albums)
    ) {
      throw new Error(`${dataFile} contains an invalid section record.`)
    }
    if (sectionIds.has(section.id)) {
      throw new Error(
        `${dataFile} contains duplicate section ID "${section.id}".`
      )
    }
    sectionIds.add(section.id)
    const canonicalSectionId = canonicalCollisionKey(section.id)
    if (canonicalSectionIds.has(canonicalSectionId)) {
      throw new Error(
        `${dataFile} contains colliding section IDs "${canonicalSectionIds.get(canonicalSectionId)}" and "${section.id}".`
      )
    }
    canonicalSectionIds.set(canonicalSectionId, section.id)

    const albumIds = new Set()
    const canonicalAlbumIds = new Map()
    const canonicalSourcePaths = new Map()
    for (const album of section.albums) {
      if (
        !album ||
        typeof album.id !== 'string' ||
        !Array.isArray(album.photos)
      ) {
        throw new Error(
          `${dataFile} contains an invalid album record in section "${section.id}".`
        )
      }
      if (albumIds.has(album.id)) {
        throw new Error(
          `${dataFile} contains duplicate album ID "${album.id}" in section "${section.id}".`
        )
      }
      albumIds.add(album.id)
      const canonicalAlbumId = canonicalCollisionKey(album.id)
      if (canonicalAlbumIds.has(canonicalAlbumId)) {
        throw new Error(
          `${dataFile} contains colliding album IDs "${canonicalAlbumIds.get(canonicalAlbumId)}" and "${album.id}" in section "${section.id}".`
        )
      }
      canonicalAlbumIds.set(canonicalAlbumId, album.id)
      if (album.sourcePath !== undefined) {
        if (
          typeof album.sourcePath !== 'string' ||
          !album.sourcePath ||
          path.posix.isAbsolute(album.sourcePath) ||
          path.posix.normalize(album.sourcePath) !== album.sourcePath ||
          album.sourcePath.split('/').includes('..')
        ) {
          throw new Error(
            `Album "${section.id}/${album.id}" in ${dataFile} has unsafe sourcePath "${album.sourcePath}".`
          )
        }
        const canonicalSourcePath = canonicalCollisionKey(album.sourcePath)
        if (canonicalSourcePaths.has(canonicalSourcePath)) {
          throw new Error(
            `${dataFile} contains ambiguous album source paths "${canonicalSourcePaths.get(canonicalSourcePath)}" and "${album.sourcePath}" in section "${section.id}".`
          )
        }
        canonicalSourcePaths.set(canonicalSourcePath, album.sourcePath)
      }
      assertSafeOutputPath(
        album.outputPath,
        `Album "${section.id}/${album.id}" in ${dataFile}`
      )

      const outputKey = canonicalCollisionKey(album.outputPath)
      const priorAlbum = albumOutputPaths.get(outputKey)
      if (priorAlbum) {
        throw new Error(
          `${dataFile} contains colliding album output paths "${priorAlbum}" and "${album.outputPath}".`
        )
      }
      albumOutputPaths.set(outputKey, album.outputPath)

      const photoIds = new Set()
      const canonicalPhotoIds = new Map()
      for (const photo of album.photos) {
        if (!photo || typeof photo.id !== 'string') {
          throw new Error(
            `${dataFile} contains an invalid photo in album "${section.id}/${album.id}".`
          )
        }
        if (photoIds.has(photo.id)) {
          throw new Error(
            `${dataFile} contains duplicate photo ID "${photo.id}" in album "${section.id}/${album.id}".`
          )
        }
        photoIds.add(photo.id)
        const canonicalPhotoId = canonicalCollisionKey(photo.id)
        if (canonicalPhotoIds.has(canonicalPhotoId)) {
          throw new Error(
            `${dataFile} contains colliding photo IDs "${canonicalPhotoIds.get(canonicalPhotoId)}" and "${photo.id}" in album "${section.id}/${album.id}".`
          )
        }
        canonicalPhotoIds.set(canonicalPhotoId, photo.id)

        for (const field of ['src', 'fullSrc']) {
          const assetPath = photo[field]
          if (!requirePublishedRecords && assetPath === undefined) continue
          if (
            typeof assetPath !== 'string' ||
            !assetPath.startsWith('/photos/') ||
            path.posix.normalize(assetPath) !== assetPath
          ) {
            throw new Error(
              `Photo "${section.id}/${album.id}/${photo.id}" has unsafe ${field} "${assetPath}".`
            )
          }
          const assetKey = canonicalCollisionKey(assetPath)
          const priorPhoto = assetPaths.get(assetKey)
          if (priorPhoto) {
            throw new Error(
              `${dataFile} contains output-path collision between "${priorPhoto}" and "${section.id}/${album.id}/${photo.id}" at "${assetPath}".`
            )
          }
          assetPaths.set(assetKey, `${section.id}/${album.id}/${photo.id}`)
        }
        if (
          requirePublishedRecords &&
          (!Number.isInteger(photo.width) ||
            photo.width <= 0 ||
            !Number.isInteger(photo.height) ||
            photo.height <= 0)
        ) {
          throw new Error(
            `Photo "${section.id}/${album.id}/${photo.id}" in ${dataFile} must have positive integer dimensions.`
          )
        }
      }
    }
  }
}

const validateLayout = (layout, layoutFile) => {
  if (
    layout?.layoutVersion !== LAYOUT_VERSION ||
    !Array.isArray(layout.sections)
  ) {
    throw new Error(
      `${layoutFile} must use gallery layout version ${LAYOUT_VERSION}.`
    )
  }

  const shape = {
    schemaVersion: SCHEMA_VERSION,
    sections: layout.sections.map((section) => ({
      ...section,
      albums: Array.isArray(section?.albums)
        ? section.albums.map((album) => ({
            ...album,
            photos: Array.isArray(album?.photos)
              ? album.photos.map((photo) => ({
                  ...photo,
                  src: `/photos/layout-validation/${section.id}/${album.id}/${photo.id}-thumb.webp`,
                  fullSrc: `/photos/layout-validation/${section.id}/${album.id}/${photo.id}-full.webp`,
                  width: 1,
                  height: 1,
                }))
              : album?.photos,
          }))
        : section?.albums,
    })),
  }
  validateManifest(shape, layoutFile, { requirePublishedRecords: true })

  for (const section of layout.sections) {
    assertSafeId(section.id, `Section ID in ${layoutFile}`)
    if (typeof section.title !== 'string' || !section.title.trim()) {
      throw new Error(`Section "${section.id}" in ${layoutFile} needs a title.`)
    }
    for (const album of section.albums) {
      assertSafeId(album.id, `Album ID in ${layoutFile}`)
      if (
        album.title !== null &&
        (typeof album.title !== 'string' || !album.title.trim())
      ) {
        throw new Error(
          `Album "${section.id}/${album.id}" in ${layoutFile} has an invalid title.`
        )
      }
      for (const photo of album.photos) {
        assertSafeId(photo.id, `Photo ID in ${layoutFile}`)
        for (const field of ['src', 'fullSrc', 'width', 'height']) {
          if (Object.hasOwn(photo, field)) {
            throw new Error(
              `Photo "${section.id}/${album.id}/${photo.id}" in ${layoutFile} must not contain generated field "${field}".`
            )
          }
        }
        for (const field of ['title', 'alt']) {
          if (typeof photo[field] !== 'string') {
            throw new Error(
              `Photo "${section.id}/${album.id}/${photo.id}" in ${layoutFile} needs a string ${field}.`
            )
          }
        }
      }
    }
  }
}

const authoredLayoutFromManifest = (manifest) => ({
  layoutVersion: LAYOUT_VERSION,
  sections: manifest.sections.map((section) => ({
    id: section.id,
    title: section.title,
    albums: section.albums.map((album) => ({
      id: album.id,
      title: album.title,
      sourcePath: album.sourcePath,
      outputPath: album.outputPath,
      photos: album.photos.map((photo) => ({
        id: photo.id,
        title: photo.title,
        alt: photo.alt,
      })),
    })),
  })),
})

export const resolveLayout = (
  layout,
  generatedManifest,
  { layoutFile = DEFAULT_LAYOUT_FILE, dataFile = DEFAULT_DATA_FILE } = {}
) => {
  validateLayout(layout, layoutFile)
  validateManifest(generatedManifest, dataFile, {
    requirePublishedRecords: true,
  })

  const generatedSections = new Map(
    generatedManifest.sections.map((section) => [section.id, section])
  )
  const resolvedSections = layout.sections.map((section) => {
    const generatedSection = generatedSections.get(section.id)
    if (!generatedSection) {
      throw new Error(
        `${layoutFile} references section "${section.id}", but ${dataFile} has no generated record for it.`
      )
    }
    generatedSections.delete(section.id)
    const generatedAlbums = new Map(
      generatedSection.albums.map((album) => [album.id, album])
    )
    const albums = section.albums.map((album) => {
      const generatedAlbum = generatedAlbums.get(album.id)
      if (!generatedAlbum) {
        throw new Error(
          `${layoutFile} references album "${section.id}/${album.id}", but ${dataFile} has no generated record for it.`
        )
      }
      generatedAlbums.delete(album.id)
      const generatedPhotos = new Map(
        generatedAlbum.photos.map((photo) => [photo.id, photo])
      )
      const photos = album.photos.map((photo) => {
        const generatedPhoto = generatedPhotos.get(photo.id)
        if (!generatedPhoto) {
          throw new Error(
            `${layoutFile} references photo "${section.id}/${album.id}/${photo.id}", but ${dataFile} has no generated record for it.`
          )
        }
        generatedPhotos.delete(photo.id)
        return {
          id: photo.id,
          src: generatedPhoto.src,
          fullSrc: generatedPhoto.fullSrc,
          width: generatedPhoto.width,
          height: generatedPhoto.height,
          title: photo.title,
          alt: photo.alt,
        }
      })
      if (generatedPhotos.size > 0) {
        throw new Error(
          `${dataFile} contains photo "${section.id}/${album.id}/${generatedPhotos.keys().next().value}" that is missing from ${layoutFile}.`
        )
      }
      return {
        id: album.id,
        title: album.title,
        sourcePath: album.sourcePath,
        outputPath: album.outputPath,
        photos,
      }
    })
    if (generatedAlbums.size > 0) {
      throw new Error(
        `${dataFile} contains album "${section.id}/${generatedAlbums.keys().next().value}" that is missing from ${layoutFile}.`
      )
    }
    return { id: section.id, title: section.title, albums }
  })
  if (generatedSections.size > 0) {
    throw new Error(
      `${dataFile} contains section "${generatedSections.keys().next().value}" that is missing from ${layoutFile}.`
    )
  }
  return { schemaVersion: SCHEMA_VERSION, sections: resolvedSections }
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

const readExistingManifest = async (
  dataFile,
  { requirePublishedRecords = false } = {}
) => {
  if (!(await pathExists(dataFile))) return null

  const manifest = JSON.parse(await fs.readFile(dataFile, 'utf8'))
  validateManifest(manifest, dataFile, { requirePublishedRecords })
  return manifest
}

const readExistingLayout = async (layoutFile) => {
  if (!(await pathExists(layoutFile))) return null
  const layout = JSON.parse(await fs.readFile(layoutFile, 'utf8'))
  validateLayout(layout, layoutFile)
  return layout
}

const jsonEqual = (left, right) =>
  JSON.stringify(left) === JSON.stringify(right)

const readPublishedState = async ({
  dataFile,
  layoutFile,
  requireExisting = true,
}) => {
  const [manifest, layout] = await Promise.all([
    readExistingManifest(dataFile, { requirePublishedRecords: true }),
    readExistingLayout(layoutFile),
  ])
  if (!manifest && !layout && !requireExisting) return { manifest, layout }
  if (!manifest) throw new Error(`${dataFile} does not exist.`)
  if (!layout) {
    throw new Error(
      `${layoutFile} does not exist. The authored layout is required for gallery operations.`
    )
  }
  const resolved = resolveLayout(layout, manifest, { layoutFile, dataFile })
  if (!jsonEqual(resolved, manifest)) {
    throw new Error(
      `${layoutFile} and ${dataFile} are out of sync. Run npm run photos:sync before importing, pruning, or replacing assets.`
    )
  }
  return { manifest, layout }
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
  stageLayoutFile,
  publicPhotosDir,
  dataFile,
  layoutFile,
  onSwitchStep = () => {},
}) => {
  const suffix = randomUUID()
  const resources = [
    stagePhotosDir && {
      name: 'photos',
      stage: stagePhotosDir,
      target: publicPhotosDir,
      directory: true,
    },
    stageLayoutFile && {
      name: 'layout',
      stage: stageLayoutFile,
      target: layoutFile,
      directory: false,
    },
    stageDataFile && {
      name: 'manifest',
      stage: stageDataFile,
      target: dataFile,
      directory: false,
    },
  ].filter(Boolean)

  for (const resource of resources) {
    resource.backup = `${resource.target}.backup-${suffix}`
    resource.hadTarget = await pathExists(resource.target)
    resource.backedUp = false
    resource.installed = false
    await fs.mkdir(path.dirname(resource.target), { recursive: true })
  }

  try {
    for (const resource of resources) {
      if (resource.hadTarget) {
        await onSwitchStep(`backup-${resource.name}`)
        await fs.rename(resource.target, resource.backup)
        resource.backedUp = true
      }
    }
    for (const resource of resources) {
      await onSwitchStep(`install-${resource.name}`)
      await fs.rename(resource.stage, resource.target)
      resource.installed = true
    }
  } catch (error) {
    for (const resource of [...resources].reverse()) {
      if (resource.installed && (await pathExists(resource.target))) {
        await fs.rm(resource.target, {
          recursive: resource.directory,
          force: true,
        })
      }
      if (resource.backedUp) {
        await fs.rename(resource.backup, resource.target)
      }
    }
    throw error
  }

  for (const resource of resources) {
    if (resource.backedUp) {
      await fs.rm(resource.backup, {
        recursive: resource.directory,
        force: true,
      })
    }
  }
}

const findAlbum = (manifest, sectionId, albumId) => {
  const section = manifest.sections.find((item) => item.id === sectionId)
  const album = section?.albums.find((item) => item.id === albumId)
  return { section, album }
}

const inspectAlbumSource = async (sourceAlbumDir) => {
  if (!(await pathExists(sourceAlbumDir))) {
    throw new Error(
      `Source directory "${sourceAlbumDir}" does not exist. Published output was not changed.`
    )
  }

  const entries = await getEntries(sourceAlbumDir)
  const nested = entries.filter((entry) => entry.isDirectory())
  if (nested.length > 0) {
    throw new Error(
      `Unexpected nested directory "${path.join(sourceAlbumDir, nested[0].name)}". An album import must target exactly one flat directory.`
    )
  }

  const nonFiles = entries.filter(
    (entry) => !entry.isFile() && !entry.isDirectory()
  )
  if (nonFiles.length > 0) {
    throw new Error(
      `Unsupported source entry "${path.join(sourceAlbumDir, nonFiles[0].name)}". Use regular image files only.`
    )
  }

  const unsupported = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (file) => !SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase())
    )
  if (unsupported.length > 0) {
    throw new Error(
      `Unsupported file "${path.join(sourceAlbumDir, unsupported[0])}". Supported extensions: ${[...SUPPORTED_EXTENSIONS].join(', ')}.`
    )
  }

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort(stableNaturalCompare)
  if (files.length === 0) {
    throw new Error(
      `No supported images found in "${sourceAlbumDir}". Published output was not changed.`
    )
  }

  assertUniqueCanonicalValues(files, `Source filename in ${sourceAlbumDir}`)
  assertUniqueSlugs(files, `Photo in ${sourceAlbumDir}`)

  const photos = []
  for (const file of files) {
    const sourceFile = path.join(sourceAlbumDir, file)
    try {
      const metadata = await sharp(sourceFile).metadata()
      if (!metadata.width || !metadata.height)
        throw new Error('missing dimensions')
    } catch (error) {
      throw new Error(`Unreadable image ${sourceFile}: ${error.message}`)
    }
    photos.push({ id: slugify(file), file, sourceFile })
  }

  return photos
}

const assetRelativePath = (assetPath, context) => {
  if (
    typeof assetPath !== 'string' ||
    !assetPath.startsWith('/photos/') ||
    path.posix.normalize(assetPath) !== assetPath
  ) {
    throw new Error(`${context} has unsafe asset path "${assetPath}".`)
  }
  return assetPath.slice('/photos/'.length)
}

const filesEqual = async (left, right) => {
  try {
    const [leftBytes, rightBytes] = await Promise.all([
      fs.readFile(left),
      fs.readFile(right),
    ])
    return leftBytes.equals(rightBytes)
  } catch {
    return false
  }
}

const cloneManifest = (manifest) => JSON.parse(JSON.stringify(manifest))

const stagePublishedGallery = async (publicPhotosDir, stagePhotosDir) => {
  if (await pathExists(publicPhotosDir)) {
    await fs.cp(publicPhotosDir, stagePhotosDir, {
      recursive: true,
      errorOnExist: true,
    })
  } else {
    await fs.mkdir(stagePhotosDir, { recursive: true })
  }
}

const makeNewPhotoRecord = (album, sourcePhoto) => {
  const outputFile = `${sourcePhoto.id}.webp`
  const title = toTitle(sourcePhoto.file)
  return {
    id: sourcePhoto.id,
    src: `/photos/thumbs/${album.outputPath}/${outputFile}`,
    fullSrc: `/photos/full/${album.outputPath}/${outputFile}`,
    title,
    alt: title,
  }
}

const generateImportedPhoto = async ({
  sourcePhoto,
  photoRecord,
  stagePhotosDir,
}) => {
  const fullOutputPath = path.join(
    stagePhotosDir,
    assetRelativePath(photoRecord.fullSrc, `Photo "${photoRecord.id}"`)
  )
  const thumbOutputPath = path.join(
    stagePhotosDir,
    assetRelativePath(photoRecord.src, `Photo "${photoRecord.id}"`)
  )
  await fs.mkdir(path.dirname(fullOutputPath), { recursive: true })
  await fs.mkdir(path.dirname(thumbOutputPath), { recursive: true })

  await sharp(sourcePhoto.sourceFile)
    .rotate()
    .resize({
      width: 2800,
      height: 2800,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toFile(fullOutputPath)

  await sharp(sourcePhoto.sourceFile)
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
  if (!metadata.width || !metadata.height) {
    throw new Error(
      `Generated image for "${photoRecord.id}" is missing dimensions.`
    )
  }

  return {
    ...photoRecord,
    width: metadata.width,
    height: metadata.height,
  }
}

const writeStagedManifest = async (manifest, stageDataFile) => {
  await fs.writeFile(stageDataFile, `${JSON.stringify(manifest, null, 2)}\n`)
}

export const syncPhotos = async ({
  dataFile = DEFAULT_DATA_FILE,
  layoutFile = DEFAULT_LAYOUT_FILE,
  onSwitchStep,
} = {}) => {
  const [manifest, layout] = await Promise.all([
    readExistingManifest(dataFile, { requirePublishedRecords: true }),
    readExistingLayout(layoutFile),
  ])
  if (!manifest)
    throw new Error(`${dataFile} does not exist; nothing can be synced.`)
  if (!layout)
    throw new Error(`${layoutFile} does not exist; nothing can be synced.`)

  const resolved = resolveLayout(layout, manifest, { layoutFile, dataFile })
  if (jsonEqual(resolved, manifest)) return { manifest, changed: false }

  await fs.mkdir(path.dirname(dataFile), { recursive: true })
  const stageRoot = await fs.mkdtemp(
    path.join(path.dirname(dataFile), '.photo-sync-stage-')
  )
  const stageDataFile = path.join(stageRoot, 'photos.json')
  try {
    await writeStagedManifest(resolved, stageDataFile)
    await replaceGeneratedOutput({
      stageDataFile,
      dataFile,
      onSwitchStep,
    })
    return { manifest: resolved, changed: true }
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true })
  }
}

export const importAlbum = async ({
  sectionId,
  albumId,
  sourceAlbumDir,
  createSection = false,
  createAlbum = false,
  sectionTitle,
  albumTitle,
  sourcePath,
  outputPath,
  dryRun = false,
  publicPhotosDir = DEFAULT_PUBLIC_PHOTOS_DIR,
  dataFile = DEFAULT_DATA_FILE,
  layoutFile = DEFAULT_LAYOUT_FILE,
  onGeneratePhoto = () => {},
  onPlan = () => {},
  onSwitchStep,
} = {}) => {
  if (!sectionId || !albumId || !sourceAlbumDir) {
    throw new Error('Album import requires --section, --album, and --source.')
  }
  assertSafeId(sectionId, 'Section ID')
  assertSafeId(albumId, 'Album ID')

  const { manifest: existingManifest, layout: existingLayout } =
    await readPublishedState({ dataFile, layoutFile })

  const { section: existingSection, album: existingAlbum } = findAlbum(
    existingLayout,
    sectionId,
    albumId
  )

  if (!existingSection && !createSection) {
    throw new Error(
      `Section "${sectionId}" does not exist. Pass --create-section with --section-title to create it explicitly.`
    )
  }
  if (existingSection && createSection) {
    throw new Error(
      `Section "${sectionId}" already exists; remove --create-section.`
    )
  }
  if (!existingAlbum && !createAlbum) {
    throw new Error(
      `Album "${sectionId}/${albumId}" does not exist. Pass --create-album with --album-title and --source-path to create it explicitly.`
    )
  }
  if (existingAlbum && createAlbum) {
    throw new Error(
      `Album "${sectionId}/${albumId}" already exists; remove --create-album.`
    )
  }
  if (existingSection && sectionTitle) {
    throw new Error(
      '--section-title is only valid together with --create-section.'
    )
  }
  if (existingAlbum && (albumTitle || sourcePath || outputPath)) {
    throw new Error(
      '--album-title, --source-path, and --output-path are only valid together with --create-album.'
    )
  }
  if (createSection && (!createAlbum || !sectionTitle)) {
    throw new Error(
      'Creating a section requires --create-album and a non-empty --section-title.'
    )
  }
  if (createAlbum && (!albumTitle || !sourcePath)) {
    throw new Error(
      'Creating an album requires non-empty --album-title and --source-path values.'
    )
  }
  if (
    sourcePath &&
    (path.posix.isAbsolute(sourcePath) ||
      path.posix.normalize(sourcePath) !== sourcePath ||
      sourcePath === '..')
  ) {
    throw new Error(
      `Album sourcePath "${sourcePath}" must be a safe relative path.`
    )
  }

  const sourcePhotos = await inspectAlbumSource(sourceAlbumDir)
  const candidateLayout = cloneManifest(existingLayout)
  const candidateGenerated = cloneManifest(existingManifest)
  let { section, album } = findAlbum(candidateLayout, sectionId, albumId)
  let { section: generatedSection, album: generatedAlbum } = findAlbum(
    candidateGenerated,
    sectionId,
    albumId
  )

  if (!section) {
    section = { id: sectionId, title: sectionTitle, albums: [] }
    candidateLayout.sections.push(section)
    generatedSection = { id: sectionId, title: sectionTitle, albums: [] }
    candidateGenerated.sections.push(generatedSection)
  }
  if (!album) {
    album = {
      id: albumId,
      title: albumTitle,
      sourcePath,
      outputPath: outputPath || path.posix.join(sectionId, albumId),
      photos: [],
    }
    section.albums.push(album)
    generatedAlbum = { ...album, photos: [] }
    generatedSection.albums.push(generatedAlbum)
  }

  const existingPhotos = new Map(
    generatedAlbum.photos.map((photo) => [photo.id, photo])
  )
  const plannedRecords = sourcePhotos.map((sourcePhoto) => ({
    sourcePhoto,
    photoRecord:
      existingPhotos.get(sourcePhoto.id) ||
      makeNewPhotoRecord(album, sourcePhoto),
  }))
  const newIds = new Set(
    plannedRecords
      .filter(({ photoRecord }) => !existingPhotos.has(photoRecord.id))
      .map(({ photoRecord }) => photoRecord.id)
  )
  const newRecords = plannedRecords
    .filter(({ photoRecord }) => newIds.has(photoRecord.id))
    .map(({ photoRecord }) => photoRecord)
  album.photos = [
    ...album.photos,
    ...newRecords.map(({ id, title, alt }) => ({ id, title, alt })),
  ]
  generatedAlbum.photos = [...generatedAlbum.photos, ...newRecords]
  validateLayout(candidateLayout, layoutFile)
  validateManifest(candidateGenerated, dataFile, {
    requirePublishedRecords: false,
  })

  const stageParent = path.dirname(publicPhotosDir)
  await fs.mkdir(stageParent, { recursive: true })
  const stageRoot = await fs.mkdtemp(path.join(stageParent, '.photos-stage-'))
  const stagePhotosDir = path.join(stageRoot, 'photos')
  const stageDataFile = path.join(stageRoot, 'photos.json')
  const stageLayoutFile = path.join(stageRoot, 'photo-layout.json')

  try {
    await stagePublishedGallery(publicPhotosDir, stagePhotosDir)
    const generated = new Map()
    const updated = []
    const unchangedImported = []

    for (const plan of plannedRecords) {
      const prior = existingPhotos.get(plan.photoRecord.id)
      await onGeneratePhoto(plan.sourcePhoto)
      const generatedPhoto = await generateImportedPhoto({
        ...plan,
        stagePhotosDir,
      })
      generated.set(generatedPhoto.id, generatedPhoto)

      if (prior) {
        const [sameThumb, sameFull] = await Promise.all([
          filesEqual(
            path.join(
              publicPhotosDir,
              assetRelativePath(prior.src, `Photo "${prior.id}"`)
            ),
            path.join(
              stagePhotosDir,
              assetRelativePath(prior.src, `Photo "${prior.id}"`)
            )
          ),
          filesEqual(
            path.join(
              publicPhotosDir,
              assetRelativePath(prior.fullSrc, `Photo "${prior.id}"`)
            ),
            path.join(
              stagePhotosDir,
              assetRelativePath(prior.fullSrc, `Photo "${prior.id}"`)
            )
          ),
        ])
        if (
          sameThumb &&
          sameFull &&
          prior.width === generatedPhoto.width &&
          prior.height === generatedPhoto.height
        ) {
          unchangedImported.push(prior.id)
        } else {
          updated.push(prior.id)
        }
      }
    }

    generatedAlbum.photos = generatedAlbum.photos.map(
      (photo) => generated.get(photo.id) || photo
    )
    const candidateManifest = resolveLayout(
      candidateLayout,
      candidateGenerated,
      {
        layoutFile,
        dataFile,
      }
    )

    const retained = album.photos
      .map((photo) => photo.id)
      .filter((id) => !newIds.has(id) && !updated.includes(id))
    const affectedOutputPaths = plannedRecords.flatMap(({ photoRecord }) => [
      photoRecord.src,
      photoRecord.fullSrc,
    ])
    const report = {
      operation: 'import',
      target: `${sectionId}/${albumId}`,
      added: [...newIds],
      updated,
      retained,
      unchangedImported,
      removals: [],
      conflicts: [],
      affectedOutputPaths,
      dryRun,
    }

    await onPlan(report)
    await writeStagedManifest(candidateManifest, stageDataFile)
    await writeStagedManifest(candidateLayout, stageLayoutFile)
    if (dryRun || (newIds.size === 0 && updated.length === 0)) {
      return { manifest: candidateManifest, layout: candidateLayout, report }
    }

    await replaceGeneratedOutput({
      stagePhotosDir,
      stageDataFile,
      stageLayoutFile,
      publicPhotosDir,
      dataFile,
      layoutFile,
      onSwitchStep,
    })
    return { manifest: candidateManifest, layout: candidateLayout, report }
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true })
  }
}

export const pruneAlbum = async ({
  sectionId,
  albumId,
  photoIds,
  confirm = false,
  dryRun = false,
  publicPhotosDir = DEFAULT_PUBLIC_PHOTOS_DIR,
  dataFile = DEFAULT_DATA_FILE,
  layoutFile = DEFAULT_LAYOUT_FILE,
  onPlan = () => {},
  onSwitchStep,
} = {}) => {
  if (
    !sectionId ||
    !albumId ||
    !Array.isArray(photoIds) ||
    photoIds.length === 0
  ) {
    throw new Error(
      'Album prune requires --section, --album, and at least one --photo ID.'
    )
  }
  if (!dryRun && !confirm) {
    throw new Error(
      'Refusing to prune without --confirm-prune. Run with --dry-run first to review exact removals.'
    )
  }
  if (new Set(photoIds).size !== photoIds.length) {
    throw new Error('Each --photo ID may be specified only once.')
  }

  const { manifest: existingManifest, layout: existingLayout } =
    await readPublishedState({ dataFile, layoutFile })
  const { album: existingAlbum } = findAlbum(
    existingManifest,
    sectionId,
    albumId
  )
  if (!existingAlbum) {
    throw new Error(`Album "${sectionId}/${albumId}" does not exist.`)
  }

  const photosById = new Map(
    existingAlbum.photos.map((photo) => [photo.id, photo])
  )
  for (const photoId of photoIds) {
    if (!photosById.has(photoId)) {
      throw new Error(
        `Photo "${sectionId}/${albumId}/${photoId}" does not exist; nothing was removed.`
      )
    }
  }

  const removedPhotos = photoIds.map((photoId) => photosById.get(photoId))
  const report = {
    operation: 'prune',
    target: `${sectionId}/${albumId}`,
    added: [],
    updated: [],
    retained: existingAlbum.photos
      .map((photo) => photo.id)
      .filter((id) => !photoIds.includes(id)),
    removals: [...photoIds],
    conflicts: [],
    affectedOutputPaths: removedPhotos.flatMap((photo) => [
      photo.src,
      photo.fullSrc,
    ]),
    dryRun,
  }
  await onPlan(report)
  if (dryRun)
    return { manifest: existingManifest, layout: existingLayout, report }

  const candidateLayout = cloneManifest(existingLayout)
  const candidateGenerated = cloneManifest(existingManifest)
  const { album: layoutAlbum } = findAlbum(candidateLayout, sectionId, albumId)
  const { album: generatedAlbum } = findAlbum(
    candidateGenerated,
    sectionId,
    albumId
  )
  layoutAlbum.photos = layoutAlbum.photos.filter(
    (photo) => !photoIds.includes(photo.id)
  )
  generatedAlbum.photos = generatedAlbum.photos.filter(
    (photo) => !photoIds.includes(photo.id)
  )
  const candidateManifest = resolveLayout(candidateLayout, candidateGenerated, {
    layoutFile,
    dataFile,
  })

  const stageParent = path.dirname(publicPhotosDir)
  await fs.mkdir(stageParent, { recursive: true })
  const stageRoot = await fs.mkdtemp(path.join(stageParent, '.photos-stage-'))
  const stagePhotosDir = path.join(stageRoot, 'photos')
  const stageDataFile = path.join(stageRoot, 'photos.json')
  const stageLayoutFile = path.join(stageRoot, 'photo-layout.json')

  try {
    await stagePublishedGallery(publicPhotosDir, stagePhotosDir)
    for (const photo of removedPhotos) {
      await fs.rm(
        path.join(
          stagePhotosDir,
          assetRelativePath(photo.src, `Photo "${photo.id}"`)
        ),
        { force: true }
      )
      await fs.rm(
        path.join(
          stagePhotosDir,
          assetRelativePath(photo.fullSrc, `Photo "${photo.id}"`)
        ),
        { force: true }
      )
    }
    await writeStagedManifest(candidateManifest, stageDataFile)
    await writeStagedManifest(candidateLayout, stageLayoutFile)
    await replaceGeneratedOutput({
      stagePhotosDir,
      stageDataFile,
      stageLayoutFile,
      publicPhotosDir,
      dataFile,
      layoutFile,
      onSwitchStep,
    })
    return { manifest: candidateManifest, layout: candidateLayout, report }
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true })
  }
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
  layoutFile = DEFAULT_LAYOUT_FILE,
  onPlan = () => {},
  onSwitchStep,
} = {}) => {
  const [existingManifest, existingLayout] = await Promise.all([
    readExistingManifest(dataFile, { requirePublishedRecords: true }),
    readExistingLayout(layoutFile),
  ])
  if (existingManifest && !existingLayout) {
    throw new Error(
      `${layoutFile} does not exist. Refusing to replace a published manifest without its authored layout.`
    )
  }
  if (existingManifest && existingLayout) {
    const resolved = resolveLayout(existingLayout, existingManifest, {
      layoutFile,
      dataFile,
    })
    if (!jsonEqual(resolved, existingManifest)) {
      throw new Error(
        `${layoutFile} and ${dataFile} are out of sync. Run npm run photos:sync before replacing assets.`
      )
    }
  }
  const sections = await collectPlan(sourceDir, existingLayout)
  await fs.mkdir(path.dirname(publicPhotosDir), { recursive: true })
  const stageRoot = await fs.mkdtemp(
    path.join(path.dirname(publicPhotosDir), '.photos-stage-')
  )
  const stagePhotosDir = path.join(stageRoot, 'photos')
  const stageDataFile = path.join(stageRoot, 'photos.json')
  const stageLayoutFile = path.join(stageRoot, 'photo-layout.json')

  try {
    const generatedManifest = await generateCandidate(sections, stagePhotosDir)
    const layout = authoredLayoutFromManifest(generatedManifest)
    const manifest = resolveLayout(layout, generatedManifest, {
      layoutFile,
      dataFile,
    })
    await writeStagedManifest(manifest, stageDataFile)
    await writeStagedManifest(layout, stageLayoutFile)
    const oldKeys = photoKeys(existingManifest)
    const newKeys = photoKeys(manifest)
    const additions = [...newKeys].filter((key) => !oldKeys.has(key)).length
    const removals = [...oldKeys].filter((key) => !newKeys.has(key)).length
    onPlan({ additions, removals })

    await replaceGeneratedOutput({
      stagePhotosDir,
      stageDataFile,
      stageLayoutFile,
      publicPhotosDir,
      dataFile,
      layoutFile,
      onSwitchStep,
    })

    return { manifest, layout, additions, removals }
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true })
  }
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

const HELP = `Photo gallery operations:

  npm run photos:sync
  npm run photos:import -- --section <id> --album <id> --source <directory> [--dry-run]
  npm run photos:prune -- --section <id> --album <id> --photo <id> [--photo <id> ...] --confirm-prune
  npm run photos:build -- --replace-all

New albums also require:
  --create-album --album-title <title> --source-path <relative-path> [--output-path <relative-path>]

New sections also require:
  --create-section --section-title <title> --create-album ...

Use --dry-run with import or prune to review the exact target, additions, updates,
retained IDs, removals, and output paths without changing published files.`

const parseOptions = (args) => {
  const valueOptions = new Set([
    '--section',
    '--album',
    '--source',
    '--section-title',
    '--album-title',
    '--source-path',
    '--output-path',
    '--photo',
  ])
  const booleanOptions = new Set([
    '--dry-run',
    '--create-section',
    '--create-album',
    '--confirm-prune',
    '--replace-all',
    '--help',
  ])
  const options = { photos: [] }

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (booleanOptions.has(argument)) {
      options[argument.slice(2)] = true
      continue
    }
    if (!valueOptions.has(argument)) {
      throw new Error(`Unknown argument "${argument}".\n\n${HELP}`)
    }
    const value = args[index + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}.`)
    }
    index += 1
    if (argument === '--photo') options.photos.push(value)
    else options[argument.slice(2)] = value
  }
  return options
}

const printReport = (report, status) => {
  const show = (label, values) =>
    console.log(`${label}: ${values.length > 0 ? values.join(', ') : 'none'}`)

  console.log(
    `${status || (report.dryRun ? 'Dry run' : 'Planned')} ${report.operation}`
  )
  console.log(`Target: ${report.target}`)
  show('Added', report.added)
  show('Updated', report.updated)
  show('Retained', report.retained)
  show('Removed', report.removals)
  show('Conflicts', report.conflicts)
  show('Output paths', report.affectedOutputPaths)
}

if (isDirectRun) {
  const [command, ...rawArgs] = process.argv.slice(2)

  Promise.resolve()
    .then(async () => {
      if (!command) {
        throw new Error(
          `Refusing to replace the committed gallery without --replace-all. Use photos:import for routine album work.\n\n${HELP}`
        )
      }
      if (command === '--help' || command === 'help') {
        console.log(HELP)
        return
      }

      if (command === 'sync') {
        if (rawArgs.length > 0) throw new Error(HELP)
        const { changed } = await syncPhotos()
        console.log(
          changed
            ? `Resolved ${DEFAULT_DATA_FILE} from ${DEFAULT_LAYOUT_FILE}.`
            : `${DEFAULT_DATA_FILE} is already synchronized with ${DEFAULT_LAYOUT_FILE}.`
        )
        return
      }

      if (command === 'import-album') {
        const options = parseOptions(rawArgs)
        if (options.help) {
          console.log(HELP)
          return
        }
        const { report } = await importAlbum({
          sectionId: options.section,
          albumId: options.album,
          sourceAlbumDir: options.source && path.resolve(options.source),
          createSection: options['create-section'],
          createAlbum: options['create-album'],
          sectionTitle: options['section-title'],
          albumTitle: options['album-title'],
          sourcePath: options['source-path'],
          outputPath: options['output-path'],
          dryRun: options['dry-run'],
          onPlan: (plan) => {
            if (!plan.dryRun) printReport(plan)
          },
        })
        if (report.dryRun) printReport(report)
        else console.log(`Completed import for ${report.target}.`)
        return
      }

      if (command === 'prune-album') {
        const options = parseOptions(rawArgs)
        if (options.help) {
          console.log(HELP)
          return
        }
        const { report } = await pruneAlbum({
          sectionId: options.section,
          albumId: options.album,
          photoIds: options.photos,
          confirm: options['confirm-prune'],
          dryRun: options['dry-run'],
          onPlan: (plan) => {
            if (!plan.dryRun) printReport(plan)
          },
        })
        if (report.dryRun) printReport(report)
        else console.log(`Completed prune for ${report.target}.`)
        return
      }

      if (command === '--replace-all') {
        const options = parseOptions([command, ...rawArgs])
        if (!options['replace-all'] || rawArgs.length > 0) {
          throw new Error(HELP)
        }
        const { additions, removals } = await buildPhotos({
          onPlan: (plan) => {
            console.log(
              `Replacing the full gallery: ${plan.additions} additions, ${plan.removals} removals.`
            )
          },
        })
        console.log(
          `Generated ${DEFAULT_DATA_FILE} (${additions} additions, ${removals} removals).`
        )
        return
      }

      throw new Error(
        `Unknown photo operation "${command}". Full replacement still requires --replace-all.\n\n${HELP}`
      )
    })
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}
