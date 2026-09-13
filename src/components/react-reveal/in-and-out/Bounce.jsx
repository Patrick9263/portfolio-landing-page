import React, { useEffect, useRef, useState } from 'react'
import useReducedMotion from '../../../hooks/useReducedMotion'

const Bounce = ({
  children,
  duration = 1000,
  delay = 0,
  fraction = 0.2,
  cascade = false,
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

  const childArray = React.Children.toArray(children)

  return (
    <div className="reveal-bounce" ref={ref}>
      {childArray.map((child, index) => {
        const itemDelay = cascade ? delay + index * 120 : delay

        return (
          <div
            key={child.key || index}
            style={{
              opacity: shouldShow ? 1 : 0,
              transform: shouldShow ? 'none' : 'scale(0.92)',
              transition: prefersReducedMotion
                ? 'none'
                : `opacity ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${itemDelay}ms, transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${itemDelay}ms`,
            }}
          >
            {child}
          </div>
        )
      })}
    </div>
  )
}

export default Bounce
