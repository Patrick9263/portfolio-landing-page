import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import PhotoAlbum from 'react-photo-album'
import photoDimensions from '../../images/downscaled-photos/output.json'
import './PhotosPage.css'

export default function PhotosPage() {
  return (
    <Fade bottom duration={1000} distance="20px">
      <div className="photos">
        <Navbar top />
        <Fade duration={1000}>
          <div className="about-text">
            <h2>Photos</h2>
            <p>Photography is one of my hobbies, enjoy some that I've taken!</p>
            <p>Currently I'm using a Sony A7R V with a 24mm lens.</p>
            <p>Click on a photo to see the full resolution.</p>
          </div>
        </Fade>
        <div className="photo-container">
          <PhotoAlbum
            layout="rows"
            photos={photoDimensions}
            onClick={({ index }) => {
              window.open(
                photoDimensions[index].src
                  .replace('downscaled/', '')
                  .replace('.jpeg', '.png'),
                '_blank'
              )
            }}
          />
        </div>
      </div>
    </Fade>
  )
}
