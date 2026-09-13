import { useEffect, useState } from 'react'
import './TopButton.css'

const TopButton = () => {
  const [topButtonVisible, setTopButtonVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      const scrollTop = Math.max(
        document.body.scrollTop,
        document.documentElement.scrollTop
      )

      setTopButtonVisible(scrollTop > window.innerHeight + 63)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)

    return () => {
      window.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
    }
  }, [])

  return (
    <a
      className={`topButton ${topButtonVisible ? 'on' : 'off'}`}
      href="#home"
      aria-label="Go to top"
      aria-hidden={!topButtonVisible}
      tabIndex={topButtonVisible ? undefined : -1}
      title="Go to top"
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
    </a>
  )
}

export default TopButton
