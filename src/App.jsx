import './App.css'
import Home from './components/home/Home'
import About from './components/about/About'
import Experience from './components/experience/Experience'
import Projects from './components/projects/Projects'
import Contact from './components/contact/Contact'
import Footer from './components/footer/Footer'
import TopButton from './components/topButton/TopButton'
import GalleryRoute from './components/photos-page/GalleryRoute'
import Photos from './components/photos-page/Photos'
import { useState } from 'react'
import { useEffect } from 'react'

function App() {
  const queryParameters = new URLSearchParams(window.location.search)
  const [photosParam, setPhotosParam] = useState(queryParameters.get('photos'))

  useEffect(() => {
    const updateRoute = () => {
      setPhotosParam(new URLSearchParams(window.location.search).get('photos'))
    }
    window.addEventListener('popstate', updateRoute)
    return () => window.removeEventListener('popstate', updateRoute)
  }, [])

  return (
    <div className="App">
      {photosParam?.toLowerCase() === 'true' ? (
        <GalleryRoute />
      ) : (
        <>
          <a className="skip-link" href="#main-content">
            Skip to main content
          </a>
          <Home />
          <main id="main-content" tabIndex={-1}>
            <About />
            <Experience />
            <Projects />
            <Contact />
            <Photos />
          </main>
          <Footer />
          <TopButton />
        </>
      )}
    </div>
  )
}

export default App
