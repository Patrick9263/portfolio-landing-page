import { useEffect, useState } from 'react'
import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import PhotoAlbum from 'react-photo-album'
import photoAlbums from '../../data/photos.json'
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
  const albums = photoAlbums.filter((album) => getAlbumPhotoCount(album) > 0)

  return (
    <div className="photos-page">
      <Navbar top />

      <Fade duration={1000}>
        <div className="photos-intro">
          <h2>Photos</h2>
          <p>Photography is one of my hobbies. Enjoy some that I've taken!</p>
          <p>Currently I'm using a Sony A7R V.</p>
          <p>Click on a photo to open a larger version.</p>
        </div>
      </Fade>

      <div className="photo-container">
        {albums.length > 0 ? (
          albums.map((album) => (
            <section className="photo-album-section" key={album.id}>
              <div className="photo-album-header">
                <h3>{album.title}</h3>
                <p>
                  {getAlbumPhotoCount(album)}{' '}
                  {getAlbumPhotoCount(album) === 1 ? 'photo' : 'photos'}
                </p>
              </div>

              <div className="photo-album-grid">
                <PhotoAlbum
                  {...gallerySettings}
                  photos={album.photos}
                  onClick={({ photo }) => {
                    window.open(photo.fullSrc, '_blank', 'noopener,noreferrer')
                  }}
                />
              </div>
            </section>
          ))
        ) : (
          <p>No photos available yet.</p>
        )}
      </div>
    </div>
  )
}
