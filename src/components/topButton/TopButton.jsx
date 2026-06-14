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
          <path
            d="M12 19V5M6.5 10.5L12 5l5.5 5.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </Link>
  )
}

export default TopButton
