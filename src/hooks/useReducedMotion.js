import { useEffect, useState } from 'react'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const getInitialPreference = () =>
  typeof window !== 'undefined' &&
  window.matchMedia(REDUCED_MOTION_QUERY).matches

const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState(getInitialPreference)

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY)
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener('change', updatePreference)

    return () => mediaQuery.removeEventListener('change', updatePreference)
  }, [])

  return prefersReducedMotion
}

export default useReducedMotion
