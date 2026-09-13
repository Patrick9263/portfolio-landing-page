import { useEffect, useRef, useState } from 'react'
import MobileNav from '../mobileNav/MobileNav'
import './Navbar.css'

const NAV_ITEMS = [
  { href: '#home', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#experience', label: 'Experience' },
  { href: '#projects', label: 'Projects' },
  { href: '#contact', label: 'Contact' },
]

const Navbar = ({ top = false }) => {
  const [mobileNavVisible, setMobileNavVisible] = useState(false)
  const menuButtonRef = useRef(null)

  useEffect(() => {
    if (!mobileNavVisible) return undefined

    const handleEscape = (event) => {
      if (event.key !== 'Escape') return

      setMobileNavVisible(false)
      menuButtonRef.current?.focus()
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [mobileNavVisible])

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 600px)')
    const closeMenuAtDesktopWidth = (event) => {
      if (event.matches) setMobileNavVisible(false)
    }

    desktopQuery.addEventListener('change', closeMenuAtDesktopWidth)
    return () =>
      desktopQuery.removeEventListener('change', closeMenuAtDesktopWidth)
  }, [])

  if (top) {
    return (
      <nav className="navbar-top" aria-label="Gallery navigation">
        <div className="gallery-nav-home">
          <a href="/">Home</a>
        </div>
      </nav>
    )
  }

  const closeMobileNav = () => setMobileNavVisible(false)

  return (
    <nav className="navbar" aria-label="Primary navigation">
      <ul className="navlinks">
        {NAV_ITEMS.map(({ href, label }) => (
          <li className="navlink-wrapper" key={href}>
            <a href={href}>{label}</a>
          </li>
        ))}
      </ul>

      <div className="hamburger">
        <button
          ref={menuButtonRef}
          id="hamburger-icon"
          className={mobileNavVisible ? 'open' : ''}
          type="button"
          aria-label={
            mobileNavVisible ? 'Close navigation menu' : 'Open navigation menu'
          }
          aria-expanded={mobileNavVisible}
          aria-controls="mobile-navigation"
          onClick={() => setMobileNavVisible((visible) => !visible)}
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </div>

      <MobileNav
        links={NAV_ITEMS}
        onNavigate={closeMobileNav}
        visible={mobileNavVisible}
      />
    </nav>
  )
}

export default Navbar
