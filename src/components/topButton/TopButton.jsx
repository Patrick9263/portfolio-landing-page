import { useState } from 'react'
import './TopButton.css'
import { Link } from 'react-scroll'

const TopButton = () => {
  const [topButtonVisible, setTopButtonVisible] = useState(false)

  const scrollFunction = () => {
    if (
      document.body.scrollTop > window.innerHeight + 63 ||
      document.documentElement.scrollTop > window.innerHeight + 63
    ) {
      setTopButtonVisible(true)
    } else {
      setTopButtonVisible(false)
    }
  }

  window.onscroll = function () {
    scrollFunction()
  }

  window.onload = function () {
    scrollFunction()
  }

  return (
    <Link
      activeClass="active"
      to="about"
      spy={true}
      smooth={true}
      duration={500}
      offset={-63}
    >
      <button
        className={'topButton ' + (topButtonVisible ? 'on' : 'off')}
        title="Go to top"
        type="button"
      >
        <svg
          className="topButton-icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          focusable="false"
        >
          <path d="M4 12l1.4 1.4L11 7.8V20h2V7.8l5.6 5.6L20 12 12 4l-8 8Z" />
        </svg>
      </button>
    </Link>
  )
}

export default TopButton
