import { useEffect, useRef } from 'react'
import { PanelLeft } from 'lucide-react'
import { Button } from './ui/button'
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from './ui/drawer'
import { PeopleManager } from './PeopleManager'
import { SummaryPanel } from './SummaryPanel'
import { useAppStore } from '../store/useAppStore'
import { useBreakpoint } from '../hooks/useBreakpoint'

/** Anything Tab would visit, minus disabled/programmatic-only nodes. */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The sidebar has two modes:
 * - lg+ → rendered inline as a static column (see SidebarPane)
 * - below lg → rendered behind a PanelLeft button inside a vaul drawer
 *
 * This component is the small-screen one. It short-circuits to null at lg+ so
 * the drawer internals (overlay, close, etc.) never mount on desktop.
 */
export function SidebarDrawer(): JSX.Element | null {
  const open = useAppStore((s) => s.sidebarOpen)
  const setOpen = useAppStore((s) => s.setSidebarOpen)
  const isNarrow = useBreakpoint()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const drawerRef = useRef<HTMLDivElement | null>(null)

  // Force-close the drawer whenever we cross into lg+, so re-narrowing doesn't
  // pop the drawer open with stale state.
  useEffect(() => {
    if (!isNarrow && open) setOpen(false)
  }, [isNarrow, open, setOpen])

  // Vaul leaves `transform: translate3d(0, 0, 0)` inline on the drawer panel
  // at rest, which keeps the panel on a GPU compositing layer. Chromium's GPU
  // text path uses different subpixel anti-aliasing than the CPU path, so
  // every text node inside the drawer (the People list, summary numbers, etc.)
  // renders slightly soft / fuzzy. Once the open animation has finished there
  // is no reason to hold the layer — clearing the inline transform drops the
  // panel back to CPU rendering and the text snaps crisp. On close vaul will
  // animate from `transform: none` (treated as identity) back to its closed
  // translate value, so the close animation is unaffected.
  useEffect(() => {
    if (!open) return
    const el = drawerRef.current
    if (!el) return
    const handler = (e: TransitionEvent): void => {
      if (e.propertyName !== 'transform' || e.target !== el) return
      el.style.transform = ''
    }
    el.addEventListener('transitionend', handler)
    return () => el.removeEventListener('transitionend', handler)
  }, [open])

  if (!isNarrow) return null

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          <PanelLeft />
        </Button>
      </DrawerTrigger>
      <DrawerContent
        ref={drawerRef}
        className="lg:hidden"
        // Vaul/Radix's default open-focus behavior leaves focus on the trigger
        // button (which sits outside the drawer), so the next Tab walks the
        // page behind the overlay instead of the drawer's contents. Override
        // it: pull focus to the first focusable child inside the drawer so
        // keyboard navigation continues where the user expects.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const target = contentRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
          target?.focus()
        }}
      >
        {/* Title is required by Radix/vaul for screen-reader labelling, but the
            visible header bar (and its X close button) was removed — the drawer
            still closes on Esc and on overlay click. */}
        <DrawerTitle className="sr-only">Split</DrawerTitle>
        <div
          ref={contentRef}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          {/* Extra top padding above the first section so it doesn't crowd the
              top edge of the drawer panel. */}
          <div className="pt-8">
            <PeopleManager />
          </div>
          <SummaryPanel />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The static sidebar column at lg+.
 *
 * `overflow-y-auto` clips on every axis (a scroll container's content box is
 * the clipping rectangle), so non-inset `ring-*` halos on children near any
 * edge get shaved. We pad inward on all four sides — `px-1 pr-2` for the
 * horizontal edges and `py-1` for the top/bottom — by the ring footprint
 * (ring-2 + ring-offset-2 = ~4px) so focus rings on the Add person button
 * (at the top) and any future near-bottom controls render in full.
 */
export function SidebarPane(): JSX.Element {
  return (
    <aside className="hidden h-full min-h-0 flex-col gap-4 overflow-y-auto px-1 py-1 pr-2 lg:flex">
      <PeopleManager />
      <SummaryPanel />
    </aside>
  )
}
