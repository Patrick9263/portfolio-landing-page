import { Component, lazy, Suspense } from 'react'
import './GalleryRoute.css'

const PhotosPage = lazy(() => import('./PhotosPage'))

class GalleryErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="gallery-route-state">
          <h1>Photos</h1>
          <p role="alert">The gallery could not load. Please try again.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload gallery
          </button>
          <a href="/">Return to portfolio</a>
        </main>
      )
    }
    return this.props.children
  }
}

export default function GalleryRoute() {
  return (
    <GalleryErrorBoundary>
      <Suspense
        fallback={
          <main className="gallery-route-state" aria-busy="true">
            <h1>Photos</h1>
            <p role="status">Loading gallery…</p>
            <a href="/">Return to portfolio</a>
          </main>
        }
      >
        <PhotosPage />
      </Suspense>
    </GalleryErrorBoundary>
  )
}
