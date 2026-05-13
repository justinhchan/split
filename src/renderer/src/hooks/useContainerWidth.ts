import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Reports the live pixel width of the referenced element via `ResizeObserver`.
 *
 * Uses `el.clientWidth` for both the initial measurement and observer updates
 * — it's more reliable across the Electron + Vite mounting timing than
 * `getBoundingClientRect()`, which in our nested flex/grid chain can briefly
 * report 0 before layout fully propagates. `clientWidth` reads the post-layout
 * border-box minus borders, which is exactly what callers want.
 *
 * Initial measurement and observer setup live in the same `useLayoutEffect`
 * so the two can't race. The layout effect commits the real width before the
 * browser paints, so the user never sees the 0-width transient.
 *
 * Returns 0 if the ref isn't attached yet or in environments without
 * `ResizeObserver` (jsdom). At 0, the downstream responsive layer sheds every
 * auto-sheddable column — safer than assuming there's room there isn't.
 */
export function useContainerWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    // Synchronous initial measure. Layout is computed by the time a layout
    // effect fires, so clientWidth is the real on-screen width.
    setWidth(el.clientWidth)

    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return width
}
