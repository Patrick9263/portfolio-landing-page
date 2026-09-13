const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0

const isOptionalString = (value) =>
  value === undefined || value === null || typeof value === 'string'

const isRenderablePhoto = (photo) =>
  isObject(photo) &&
  isNonEmptyString(photo.id) &&
  isNonEmptyString(photo.src) &&
  isNonEmptyString(photo.fullSrc) &&
  Number.isFinite(photo.width) &&
  photo.width > 0 &&
  Number.isFinite(photo.height) &&
  photo.height > 0 &&
  isOptionalString(photo.title) &&
  isOptionalString(photo.alt)

export const getRenderablePhotoSections = (manifest) => {
  if (
    !isObject(manifest) ||
    manifest.schemaVersion !== 2 ||
    !Array.isArray(manifest.sections)
  ) {
    return []
  }

  const sectionIds = new Set()
  const renderableSections = []

  for (const section of manifest.sections) {
    if (
      !isObject(section) ||
      !isNonEmptyString(section.id) ||
      !isNonEmptyString(section.title) ||
      !Array.isArray(section.albums) ||
      sectionIds.has(section.id)
    ) {
      return []
    }

    sectionIds.add(section.id)
    const albumIds = new Set()
    const renderableAlbums = []

    for (const album of section.albums) {
      if (
        !isObject(album) ||
        !isNonEmptyString(album.id) ||
        !isOptionalString(album.title) ||
        !Array.isArray(album.photos) ||
        albumIds.has(album.id)
      ) {
        return []
      }

      albumIds.add(album.id)
      const photoIds = new Set()

      for (const photo of album.photos) {
        if (!isRenderablePhoto(photo) || photoIds.has(photo.id)) {
          return []
        }

        photoIds.add(photo.id)
      }

      if (album.photos.length > 0) {
        renderableAlbums.push(album)
      }
    }

    if (renderableAlbums.length > 0) {
      renderableSections.push({ ...section, albums: renderableAlbums })
    }
  }

  return renderableSections
}
