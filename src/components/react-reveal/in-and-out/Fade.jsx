import { useEffect, useRef, useState } from 'react'

const getTransform = ({ bottom, top, left, right, distance }) => {
  if (bottom) return `translateY(${distance})`
  if (top) return `translateY(-${distance})`
  if (left) return `translateX(-${distance})`
  if (right) return `translateX(${distance})`
  return 'none'
}

const Fade = ({
  children,
  duration = 1000,
  delay = 0,
  distance = '20px',
  fraction = 0.2,
  bottom = false,
  top = false,
  left = false,
  right = false,
}) => {
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const node = ref.current

    if (!node || isVisible) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      {
        threshold: fraction,
      }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [fraction, isVisible])

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'none'
          : getTransform({ bottom, top, left, right, distance }),
        transition: `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export default Fade
