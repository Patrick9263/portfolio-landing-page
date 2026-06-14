import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import PhotoAlbum from 'react-photo-album'
import photoDimensions from '../../images/downscaled-photos/output.json'
import './PhotosPage.css'

const photos = photoDimensions.map((photo) => ({
  ...photo,
  width: Number(photo.width),
  height: Number(photo.height),
}))

export default function PhotosPage() {
  return (
    <div className="photos-page">
      <Navbar top />

      <Fade duration={1000}>
        <div className="photos-intro">
          <h2>Photos</h2>
          <p>Photography is one of my hobbies. Enjoy some that I've taken!</p>
          <p>Currently I'm using a Sony A7R V with a 24mm lens.</p>
          <p>Click on a photo to see the full resolution.</p>
        </div>
      </Fade>

      <div className="photo-container">
        <PhotoAlbum
          layout="rows"
          photos={photos}
          targetRowHeight={320}
          spacing={10}
          onClick={({ index }) => {
            window.open(
              photos[index].src
                .replace('downscaled/', '')
                .replace('.jpeg', '.png'),
              '_blank',
              'noopener,noreferrer'
            )
          }}
        />
      </div>
    </div>
  )
}
