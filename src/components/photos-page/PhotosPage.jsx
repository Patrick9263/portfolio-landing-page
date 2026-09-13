import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import PhotoAlbum from 'react-photo-album'
import photoManifest from '../../data/photos.json'
import { getRenderablePhotoSections } from './galleryManifest'
import './PhotosPage.css'

const LOCAL_FIXTURE_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

const getPhotoManifest = () => {
  if (
    typeof window !== 'undefined' &&
    LOCAL_FIXTURE_HOSTS.has(window.location.hostname) &&
    Object.prototype.hasOwnProperty.call(
      window,
      '__PORTFOLIO_GALLERY_TEST_MANIFEST__'
    )
  ) {
    return window.__PORTFOLIO_GALLERY_TEST_MANIFEST__
  }

  return photoManifest
}

const getAlbumPhotoCount = (album) => album.photos.length

const getPhotoName = (photo, index) =>
  photo.alt?.trim() || photo.title?.trim() || `Photo ${index + 1}`

const renderPhotoOpener = ({
  photo,
  layout,
  imageProps,
  wrapperStyle,
  onOpen,
}) => {
  return (
    <button
      className="photo-opener"
      type="button"
      style={wrapperStyle}
      aria-label={`Open ${getPhotoName(photo, layout.index)}`}
      onClick={(event) => onOpen(layout.index, event.currentTarget)}
    >
      <img
        {...imageProps}
        alt=""
        aria-hidden="true"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </button>
  )
}

const getFocusableElements = (container) =>
  Array.from(
    container.querySelectorAll(
      'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hidden)

const getGallerySettings = (width) => {
  if (width < 1000) {
    return {
      layout: 'columns',
      columns: 1,
      spacing: 14,
    }
  }

  if (width < 1400) {
    return {
      layout: 'columns',
      columns: 3,
      spacing: 10,
    }
  }

  if (width >= 1500) {
    return {
      layout: 'rows',
      targetRowHeight: 320,
      spacing: 10,
    }
  }

  return {
    layout: 'rows',
    targetRowHeight: 300,
    spacing: 10,
  }
}

const useViewportWidth = () => {
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1440 : window.innerWidth
  )

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth)
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return width
}

export default function PhotosPage({ manifest = getPhotoManifest() }) {
  const viewportWidth = useViewportWidth()
  const gallerySettings = getGallerySettings(viewportWidth)

  const sections = useMemo(
    () => getRenderablePhotoSections(manifest),
    [manifest]
  )

  const allAlbums = useMemo(
    () =>
      sections.flatMap((section) =>
        section.albums.map((album) => ({
          ...album,
          albumKey: `${section.id}/${album.id}`,
        }))
      ),
    [sections]
  )

  const [lightbox, setLightbox] = useState(null)
  const dialogRef = useRef(null)
  const closeButtonRef = useRef(null)
  const lightboxOpenerRef = useRef(null)
  const shouldRestoreFocusRef = useRef(false)
  const lightboxStatusId = useId()

  const selectedAlbum =
    lightbox !== null
      ? allAlbums.find((album) => album.albumKey === lightbox.albumKey) || null
      : null

  const selectedPhoto =
    selectedAlbum && selectedAlbum.photos[lightbox.index]
      ? selectedAlbum.photos[lightbox.index]
      : null

  const isLightboxOpen = selectedPhoto !== null

  const openLightbox = useCallback((albumKey, index, opener) => {
    lightboxOpenerRef.current = opener
    shouldRestoreFocusRef.current = false
    setLightbox({ albumKey, index })
  }, [])

  const closeLightbox = useCallback(() => {
    shouldRestoreFocusRef.current = true
    setLightbox(null)
  }, [])

  const showPreviousPhoto = useCallback(() => {
    if (!selectedAlbum || lightbox === null) return

    setLightbox({
      albumKey: selectedAlbum.albumKey,
      index:
        lightbox.index === 0
          ? selectedAlbum.photos.length - 1
          : lightbox.index - 1,
    })
  }, [lightbox, selectedAlbum])

  const showNextPhoto = useCallback(() => {
    if (!selectedAlbum || lightbox === null) return

    setLightbox({
      albumKey: selectedAlbum.albumKey,
      index:
        lightbox.index === selectedAlbum.photos.length - 1
          ? 0
          : lightbox.index + 1,
    })
  }, [lightbox, selectedAlbum])

  useEffect(() => {
    if (!isLightboxOpen) return undefined

    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousBodyOverflow
    }
  }, [isLightboxOpen])

  useLayoutEffect(() => {
    if (!isLightboxOpen) return undefined

    closeButtonRef.current?.focus()
    return undefined
  }, [isLightboxOpen])

  useEffect(() => {
    if (isLightboxOpen || !shouldRestoreFocusRef.current) return undefined

    const opener = lightboxOpenerRef.current
    shouldRestoreFocusRef.current = false

    const focusFrame = window.requestAnimationFrame(() => {
      if (opener?.isConnected) {
        opener.focus()
      }
    })

    return () => {
      window.cancelAnimationFrame(focusFrame)
    }
  }, [isLightboxOpen])

  const handleLightboxKeyDown = useCallback(
    (event) => {
      if (!selectedPhoto || !selectedAlbum) return

      if (event.key === 'Escape') {
        event.preventDefault()
        closeLightbox()
        return
      }

      if (event.key === 'ArrowLeft' && selectedAlbum.photos.length > 1) {
        event.preventDefault()
        showPreviousPhoto()
        return
      }

      if (event.key === 'ArrowRight' && selectedAlbum.photos.length > 1) {
        event.preventDefault()
        showNextPhoto()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = getFocusableElements(dialogRef.current)
      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)
      const activeElement = document.activeElement

      if (
        event.shiftKey &&
        (activeElement === firstElement ||
          !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault()
        lastElement.focus()
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement ||
          !dialogRef.current.contains(activeElement))
      ) {
        event.preventDefault()
        firstElement.focus()
      }
    },
    [
      closeLightbox,
      selectedAlbum,
      selectedPhoto,
      showNextPhoto,
      showPreviousPhoto,
    ]
  )

  useLayoutEffect(() => {
    if (!isLightboxOpen) return undefined

    window.addEventListener('keydown', handleLightboxKeyDown)

    return () => {
      window.removeEventListener('keydown', handleLightboxKeyDown)
    }
  }, [handleLightboxKeyDown, isLightboxOpen])

  const lightboxStatus = selectedPhoto
    ? `Photo ${lightbox.index + 1} of ${selectedAlbum.photos.length}${
        selectedAlbum.title ? ` in ${selectedAlbum.title}` : ''
      }: ${getPhotoName(selectedPhoto, lightbox.index)}.`
    : ''

  return (
    <main className="photos-page" id="main-content" tabIndex={-1}>
      <div className="photos-page-background" inert={isLightboxOpen}>
        <Navbar top />

        <Fade duration={1000}>
          <div className="photos-intro">
            <h2>Photos</h2>
            <p>
              Photography is one of my hobbies. Enjoy some that I&apos;ve taken!
            </p>
            <p>Currently I&apos;m using a Sony A7R V.</p>
            <p>
              Browse by section and album, then choose a photo to enlarge it.
            </p>
          </div>
        </Fade>

        <div className="photo-container">
          {sections.length > 0 ? (
            sections.map((section) => (
              <section className="photo-section" key={section.id}>
                <div className="photo-section-header">
                  <h3>{section.title}</h3>
                </div>

                <div className="photo-section-albums">
                  {section.albums.map((album) => {
                    const albumKey = `${section.id}/${album.id}`

                    return (
                      <section className="photo-album-section" key={albumKey}>
                        <div className="photo-album-header">
                          {album.title ? <h4>{album.title}</h4> : null}
                          <p>
                            {getAlbumPhotoCount(album)}{' '}
                            {getAlbumPhotoCount(album) === 1
                              ? 'photo'
                              : 'photos'}
                          </p>
                        </div>

                        <div className="photo-album-grid">
                          <PhotoAlbum
                            {...gallerySettings}
                            photos={album.photos}
                            renderPhoto={(renderProps) =>
                              renderPhotoOpener({
                                ...renderProps,
                                onOpen: (index, opener) =>
                                  openLightbox(albumKey, index, opener),
                              })
                            }
                          />
                        </div>
                      </section>
                    )
                  })}
                </div>
              </section>
            ))
          ) : (
            <p>No photos available yet.</p>
          )}
        </div>
      </div>

      {selectedPhoto ? (
        <div
          ref={dialogRef}
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          aria-describedby={lightboxStatusId}
          tabIndex="-1"
        >
          <button
            className="photo-lightbox-backdrop"
            type="button"
            aria-hidden="true"
            tabIndex="-1"
            onClick={closeLightbox}
          />

          <button
            ref={closeButtonRef}
            className="photo-lightbox-close"
            type="button"
            aria-label="Close photo"
            onClick={closeLightbox}
          >
            ×
          </button>

          {selectedAlbum.photos.length > 1 ? (
            <button
              className="photo-lightbox-nav photo-lightbox-nav-previous"
              type="button"
              aria-label="Previous photo"
              onClick={showPreviousPhoto}
            >
              <svg
                className="photo-lightbox-nav-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path d="M15 5L8 12l7 7" />
              </svg>
            </button>
          ) : null}

          <div className="photo-lightbox-content">
            <img
              src={selectedPhoto.fullSrc}
              alt={getPhotoName(selectedPhoto, lightbox.index)}
            />

            {selectedPhoto.title ? (
              <p className="photo-lightbox-caption">{selectedPhoto.title}</p>
            ) : null}

            <p
              className="photo-lightbox-status"
              id={lightboxStatusId}
              aria-live="polite"
            >
              {lightboxStatus}
            </p>
          </div>

          {selectedAlbum.photos.length > 1 ? (
            <button
              className="photo-lightbox-nav photo-lightbox-nav-next"
              type="button"
              aria-label="Next photo"
              onClick={showNextPhoto}
            >
              <svg
                className="photo-lightbox-nav-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                focusable="false"
              >
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  )
}
