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

const getImageFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) =>
      SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase())
    )
}

const buildPhotos = async () => {
  await ensureDir(PUBLIC_PHOTOS_DIR)
  await ensureDir(path.dirname(DATA_FILE))

  const albums = await fs.readdir(SOURCE_DIR, { withFileTypes: true })
  const photoAlbums = []

  for (const album of albums) {
    if (!album.isDirectory()) continue

    const albumId = slugify(album.name)
    const albumTitle = toTitle(album.name)
    const sourceAlbumDir = path.join(SOURCE_DIR, album.name)
    const fullAlbumDir = path.join(PUBLIC_PHOTOS_DIR, 'full', albumId)
    const thumbAlbumDir = path.join(PUBLIC_PHOTOS_DIR, 'thumbs', albumId)

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

      const fullImage = sharp(sourcePath)
        .rotate()
        .resize({
          width: 2800,
          height: 2800,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })

      await fullImage.toFile(fullOutputPath)

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
        id: photoId,
        src: `/photos/thumbs/${albumId}/${outputFile}`,
        fullSrc: `/photos/full/${albumId}/${outputFile}`,
        width: metadata.width,
        height: metadata.height,
        title: toTitle(file),
        alt: toTitle(file),
      })
    }

    if (photos.length > 0) {
      photoAlbums.push({
        id: albumId,
        title: albumTitle,
        photos,
      })
    }
  }

  await fs.writeFile(DATA_FILE, `${JSON.stringify(photoAlbums, null, 2)}\n`)
  console.log(`Generated ${DATA_FILE}`)
}

buildPhotos().catch((error) => {
  console.error(error)
  process.exit(1)
})
