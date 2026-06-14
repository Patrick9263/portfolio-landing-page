import React from 'react'
import './App.css'
import Home from './components/home/Home'
import About from './components/about/About'
import Experience from './components/experience/Experience'
import Projects from './components/projects/Projects'
import Contact from './components/contact/Contact'
import Footer from './components/footer/Footer'
import TopButton from './components/topButton/TopButton'
import PhotosPage from './components/photos-page/PhotosPage'
import Photos from './components/photos-page/Photos'
import { useState } from 'react'
import { useEffect } from 'react'

function App() {
  const queryParameters = new URLSearchParams(window.location.search)
  const [photosParam, setPhotosParam] = useState(queryParameters.get('photos'))

  useEffect(() => {
    const queryParameters = new URLSearchParams(window.location.search)
    const photosParam = queryParameters.get('photos')
    setPhotosParam(photosParam)
  }, [])

  return (
    <div className="App">
      {photosParam?.toLowerCase() === 'true' ? (
        <PhotosPage />
      ) : (
        <>
          <Home />
          <About />
          <Experience />
          <Projects />
          <Contact />
          <Photos />
          <Footer />
          <TopButton />
        </>
      )}
    </div>
  )
}

export default App
