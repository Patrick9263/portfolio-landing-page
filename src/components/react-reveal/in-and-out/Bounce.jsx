import React, { useEffect, useRef, useState } from 'react'

const Bounce = ({
  children,
  duration = 1000,
  delay = 0,
  fraction = 0.2,
  cascade = false,
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

  const childArray = React.Children.toArray(children)

  return (
    <div ref={ref}>
      {childArray.map((child, index) => {
        const itemDelay = cascade ? delay + index * 120 : delay

        return (
          <div
            key={child.key || index}
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'none' : 'scale(0.92)',
              transition: `opacity ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${itemDelay}ms, transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1) ${itemDelay}ms`,
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
