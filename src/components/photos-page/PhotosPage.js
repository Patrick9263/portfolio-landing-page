import { getImageSize } from 'react-image-size'
import Fade from '../react-reveal/in-and-out/Fade'
import Navbar from '../navbar/Navbar'
import ClipLoader from 'react-spinners/ClipLoader'

import PhotoAlbum from 'react-photo-album' // https://github.com/igordanchenko/react-photo-album/
import photo1 from '../../images/photos/DSC01592.png'
import photo2 from '../../images/photos/DSC01593.png'
import photo3 from '../../images/photos/DSC01621.png'
import photo4 from '../../images/photos/DSC01645.png'
import photo5 from '../../images/photos/DSC01665.png'
import photo6 from '../../images/photos/DSC01693.png'
import photo7 from '../../images/photos/DSC01700.png'
import photo8 from '../../images/photos/DSC01720.png'
import photo9 from '../../images/photos/DSC01721.png'
import photo10 from '../../images/photos/DSC01726.png'
import photo11 from '../../images/photos/DSC01742.png'
import photo12 from '../../images/photos/DSC01749.png'
import photo13 from '../../images/photos/DSC01755.png'
import photo14 from '../../images/photos/DSC01795.png'
import photo15 from '../../images/photos/DSC01853_1.png'
import photo16 from '../../images/photos/DSC01856.png'
import photo17 from '../../images/photos/DSC01905.png'
import photo18 from '../../images/photos/DSC01965.png'
import photo19 from '../../images/photos/DSC01970.png'
import photo20 from '../../images/photos/DSC02089.png'
import photo21 from '../../images/photos/DSC02107.png'
import photo22 from '../../images/photos/DSC02113-1.png'
import photo23 from '../../images/photos/DSC02115.png'
import photo24 from '../../images/photos/DSC02142.png'
import photo25 from '../../images/photos/DSC02149.png'
import photo26 from '../../images/photos/DSC02154.png'
import photo27 from '../../images/photos/DSC02163.png'

import { useState } from 'react'
import { useEffect } from 'react'
import './PhotosPage.css'

const photoList = [
  photo1,
  photo2,
  photo3,
  photo4,
  photo5,
  photo6,
  photo7,
  photo8,
  photo9,
  photo10,
  photo11,
  photo12,
  photo13,
  photo14,
  photo15,
  photo16,
  photo17,
  photo18,
  photo19,
  photo20,
  photo21,
  photo22,
  photo23,
  photo24,
  photo25,
  photo26,
  photo27,
]

const Description = () => {
  return (
    <Fade duration={1000}>
      <div className="about-text">
        <h2>My Photo Gallery</h2>
        <p>
          Photography is one of my hobbies! I'm still learning, but enjoy some
          photos I've taken 😊
        </p>
        <p>Currently I'm using a Sony A7R V with a 24mm lens.</p>
        <p>Click on a photo to download the full resolution.</p>
      </div>
    </Fade>
  )
}

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
        <Description />
        <div className="photo-container">
          {isLoading ? (
            <ClipLoader
              color="#1bdbdb"
              loading={isLoading}
              size={75}
              aria-label="Loading Spinner"
            />
          ) : (
            <PhotoAlbum layout="rows" photos={photoAlbum} />
          )}
        </div>
      </div>
    </Fade>
  )
}
