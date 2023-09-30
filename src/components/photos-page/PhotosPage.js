import { getImageSize } from 'react-image-size'
import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import ClipLoader from 'react-spinners/ClipLoader'
import PhotoAlbum from 'react-photo-album'
import { useState } from 'react'
import { useEffect } from 'react'
import './PhotosPage.css'

const bucket = 'https://patrick-portfolio-photos.s3.us-east-2.amazonaws.com'
const photoList = [
  `${bucket}/downscaled/DSC01592.jpeg`,
  `${bucket}/downscaled/DSC01593.jpeg`,
  `${bucket}/downscaled/DSC01621.jpeg`,
  `${bucket}/downscaled/DSC01645.jpeg`,
  `${bucket}/downscaled/DSC01665.jpeg`,
  `${bucket}/downscaled/DSC01693.jpeg`,
  `${bucket}/downscaled/DSC01700.jpeg`,
  `${bucket}/downscaled/DSC01720.jpeg`,
  `${bucket}/downscaled/DSC01721.jpeg`,
  `${bucket}/downscaled/DSC01726.jpeg`,
  `${bucket}/downscaled/DSC01742.jpeg`,
  `${bucket}/downscaled/DSC01749.jpeg`,
  `${bucket}/downscaled/DSC01755.jpeg`,
  `${bucket}/downscaled/DSC01795.jpeg`,
  `${bucket}/downscaled/DSC01853_1.jpeg`,
  `${bucket}/downscaled/DSC01856.jpeg`,
  `${bucket}/downscaled/DSC01905.jpeg`,
  `${bucket}/downscaled/DSC01965.jpeg`,
  `${bucket}/downscaled/DSC01970.jpeg`,
  `${bucket}/downscaled/DSC02089.jpeg`,
  `${bucket}/downscaled/DSC02107.jpeg`,
  `${bucket}/downscaled/DSC02113-1.jpeg`,
  `${bucket}/downscaled/DSC02115.jpeg`,
  `${bucket}/downscaled/DSC02142.jpeg`,
  `${bucket}/downscaled/DSC02149.jpeg`,
  `${bucket}/downscaled/DSC02154.jpeg`,
  `${bucket}/downscaled/DSC02163.jpeg`,
]

const setAllImages = async (setPhotoAlbum, setIsLoading) => {
  const data = []
  const loopThruPhotos = () => {
    photoList.forEach((photo) => {
      try {
        const dimensions = getImageSize(photo)
        data.push(dimensions)
      } catch (error) {
        console.error(error)
      }
    })
  }
  loopThruPhotos()
  let resolvedData = []
  const dimensions = await Promise.all(data)
  resolvedData = dimensions.map((dimension, index) => ({
    src: photoList[index],
    width: dimension?.width,
    height: dimension?.height,
  }))
  setIsLoading(false)
  setPhotoAlbum(resolvedData)
}

export default function PhotosPage() {
  const [photoAlbum, setPhotoAlbum] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setAllImages(setPhotoAlbum, setIsLoading)
  }, [])

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
          {isLoading ? (
            <ClipLoader
              color="#1bdbdb"
              loading={isLoading}
              size={75}
              aria-label="Loading Spinner"
            />
          ) : (
            <PhotoAlbum
              layout="rows"
              photos={photoAlbum}
              onClick={({ index }) => {
                window.open(
                  photoList[index]
                    .replace('downscaled/', '')
                    .replace('.jpeg', '.png'),
                  '_blank'
                )
              }}
            />
          )}
        </div>
      </div>
    </Fade>
  )
}
