import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE_DIR = 'photos-source'
const PUBLIC_PHOTOS_DIR = 'public/photos'
const DATA_FILE = 'src/data/photos.json'

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

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true })
}

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const getImageFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) => SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

const getDirectories = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
}

const sortYears = (years) =>
  [...years].sort((a, b) => {
    const aNum = Number.parseInt(a, 10)
    const bNum = Number.parseInt(b, 10)

    const aIsYear = /^\d{4}$/.test(a)
    const bIsYear = /^\d{4}$/.test(b)

    if (aIsYear && bIsYear) {
      return bNum - aNum
    }

    return b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })
  })

const sortAlbums = (albums) =>
  [...albums].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  )

const buildAlbum = async ({
  yearId,
  albumId,
  albumTitle,
  sourceAlbumDir,
}) => {
  const fullAlbumDir = path.join(PUBLIC_PHOTOS_DIR, 'full', yearId, albumId)
  const thumbAlbumDir = path.join(PUBLIC_PHOTOS_DIR, 'thumbs', yearId, albumId)

  await ensureDir(fullAlbumDir)
  await ensureDir(thumbAlbumDir)

  const files = await getImageFiles(sourceAlbumDir)
  const photos = []

  for (const file of files) {
    const sourcePath = path.join(sourceAlbumDir, file)
    const photoId = slugify(file)
    const outputFile = `${photoId}.webp`

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

    photos.push({
      id: `${yearId}-${albumId}-${photoId}`,
      src: `/photos/thumbs/${yearId}/${albumId}/${outputFile}`,
      fullSrc: `/photos/full/${yearId}/${albumId}/${outputFile}`,
      width: metadata.width,
      height: metadata.height,
      title: toTitle(file),
      alt: toTitle(file),
    })
  }

  return {
    id: `${yearId}-${albumId}`,
    title: albumTitle,
    photos,
  }
}

const buildPhotos = async () => {
  if (!(await pathExists(SOURCE_DIR))) {
    console.log(`No ${SOURCE_DIR} directory found. Nothing to build.`)
    return
  }

  await ensureDir(PUBLIC_PHOTOS_DIR)
  await ensureDir(path.dirname(DATA_FILE))

  const yearFolders = sortYears(await getDirectories(SOURCE_DIR))
  const yearSections = []

  for (const yearFolder of yearFolders) {
    const yearSourceDir = path.join(SOURCE_DIR, yearFolder)
    const yearId = slugify(yearFolder)
    const yearTitle = yearFolder

    const albumFolders = sortAlbums(await getDirectories(yearSourceDir))
    const albums = []

    for (const albumFolder of albumFolders) {
      const sourceAlbumDir = path.join(yearSourceDir, albumFolder)
      const albumId = slugify(albumFolder)
      const albumTitle = toTitle(albumFolder)

      const album = await buildAlbum({
        yearId,
        albumId,
        albumTitle,
        sourceAlbumDir,
      })

      if (album.photos.length > 0) {
        albums.push(album)
      }
    }

    const directImageFiles = await getImageFiles(yearSourceDir)

    if (directImageFiles.length > 0) {
      const fallbackAlbum = await buildAlbum({
        yearId,
        albumId: 'highlights',
        albumTitle: 'Highlights',
        sourceAlbumDir: yearSourceDir,
      })

      if (fallbackAlbum.photos.length > 0) {
        albums.unshift(fallbackAlbum)
      }
    }

    if (albums.length > 0) {
      yearSections.push({
        id: yearId,
        title: yearTitle,
        albums,
      })
    }
  }

  await fs.writeFile(DATA_FILE, `${JSON.stringify(yearSections, null, 2)}\n`)
  console.log(`Generated ${DATA_FILE}`)
}

buildPhotos().catch((error) => {
  console.error(error)
  process.exit(1)
})