import { useEffect, useRef, useState } from 'react'
import useReducedMotion from '../../../hooks/useReducedMotion'

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
  const prefersReducedMotion = useReducedMotion()
  const shouldShow = isVisible || prefersReducedMotion

  useEffect(() => {
    const node = ref.current

    if (!node || isVisible || prefersReducedMotion) {
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
  }, [fraction, isVisible, prefersReducedMotion])

  return (
    <div
      ref={ref}
      className="reveal"
      style={{
        width: '100%',
        opacity: shouldShow ? 1 : 0,
        transform: shouldShow
          ? 'none'
          : getTransform({ bottom, top, left, right, distance }),
        transition: prefersReducedMotion
          ? 'none'
          : `opacity ${duration}ms ease ${delay}ms, transform ${duration}ms ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

export default Fade
