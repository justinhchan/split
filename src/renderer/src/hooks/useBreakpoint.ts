import { useEffect, useState } from 'react'

/**
 * Reports whether the viewport is below the given max-width breakpoint.
 * Defaults to Tailwind's `lg` breakpoint (1024px).
 */
export function useBreakpoint(maxWidthPx = 1023.98): boolean {
  const query = `(max-width: ${maxWidthPx}px)`
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent): void => setMatches(e.matches)
    // Safari < 14 uses addListener.
    if (mq.addEventListener) mq.addEventListener('change', handler)
    else mq.addListener(handler)
    setMatches(mq.matches)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler)
      else mq.removeListener(handler)
    }
  }, [query])

  return matches
}
