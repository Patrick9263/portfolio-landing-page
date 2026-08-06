import { useCallback, useEffect, useMemo, useState } from 'react'
import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import PhotoAlbum from 'react-photo-album'
import photoYears from '../../data/photos.json'
import './PhotosPage.css'

const getAlbumPhotoCount = (album) => album.photos?.length || 0

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

export default function PhotosPage() {
  const viewportWidth = useViewportWidth()
  const gallerySettings = getGallerySettings(viewportWidth)

  const yearSections = photoYears.filter(
    (year) => year.albums?.some((album) => getAlbumPhotoCount(album) > 0)
  )

  const allAlbums = useMemo(
    () =>
      yearSections.flatMap((year) =>
        year.albums
          .filter((album) => getAlbumPhotoCount(album) > 0)
          .map((album) => ({
            ...album,
            yearId: year.id,
            yearTitle: year.title,
          }))
      ),
    [yearSections]
  )

  const [lightbox, setLightbox] = useState(null)

  const selectedAlbum =
    lightbox !== null
      ? allAlbums.find((album) => album.id === lightbox.albumId) || null
      : null

  const selectedPhoto =
    selectedAlbum && selectedAlbum.photos[lightbox.index]
      ? selectedAlbum.photos[lightbox.index]
      : null

  const closeLightbox = useCallback(() => {
    setLightbox(null)
  }, [])

  const showPreviousPhoto = useCallback(() => {
    if (!selectedAlbum || lightbox === null) return

    setLightbox({
      albumId: selectedAlbum.id,
      index:
        lightbox.index === 0
          ? selectedAlbum.photos.length - 1
          : lightbox.index - 1,
    })
  }, [lightbox, selectedAlbum])

  const showNextPhoto = useCallback(() => {
    if (!selectedAlbum || lightbox === null) return

    setLightbox({
      albumId: selectedAlbum.id,
      index:
        lightbox.index === selectedAlbum.photos.length - 1
          ? 0
          : lightbox.index + 1,
    })
  }, [lightbox, selectedAlbum])

  useEffect(() => {
    if (!selectedPhoto) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeLightbox()
      }

      if (event.key === 'ArrowLeft') {
        showPreviousPhoto()
      }

      if (event.key === 'ArrowRight') {
        showNextPhoto()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeLightbox, selectedPhoto, showNextPhoto, showPreviousPhoto])

  return (
    <div className="photos-page">
      <Navbar top />

      <Fade duration={1000}>
        <div className="photos-intro">
          <h2>Photos</h2>
          <p>Photography is one of my hobbies. Enjoy some that I&apos;ve taken!</p>
          <p>Currently I&apos;m using a Sony A7R V.</p>
          <p>Browse by year and album, then click a photo to enlarge it.</p>
        </div>
      </Fade>

      <div className="photo-container">
        {yearSections.length > 0 ? (
          yearSections.map((year) => (
            <section className="photo-year-section" key={year.id}>
              <div className="photo-year-header">
                <h3>{year.title}</h3>
              </div>

              <div className="photo-year-albums">
                {year.albums
                  .filter((album) => getAlbumPhotoCount(album) > 0)
                  .map((album) => (
                    <section className="photo-album-section" key={album.id}>
                      <div className="photo-album-header">
                        <h4>{album.title}</h4>
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
                          onClick={({ index }) => {
                            setLightbox({
                              albumId: album.id,
                              index,
                            })
                          }}
                        />
                      </div>
                    </section>
                  ))}
              </div>
            </section>
          ))
        ) : (
          <p>No photos available yet.</p>
        )}
      </div>

      {selectedPhoto ? (
        <div
          className="photo-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={selectedPhoto.alt || selectedPhoto.title || 'Photo'}
        >
          <button
            className="photo-lightbox-backdrop"
            type="button"
            aria-label="Close photo"
            onClick={closeLightbox}
          />

          <button
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
              alt={selectedPhoto.alt || selectedPhoto.title || 'Selected photo'}
            />

            {selectedPhoto.title ? (
              <p className="photo-lightbox-caption">{selectedPhoto.title}</p>
            ) : null}
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
    </div>
  )
}