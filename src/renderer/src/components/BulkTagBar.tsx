import { useEffect, useMemo, useRef, useState } from 'react'
import { Users, X } from 'lucide-react'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { ExcludeToggle } from './ExcludeToggle'
import { useAppStore } from '../store/useAppStore'
import type { PersonId } from '../store/types'
import { deriveSelectionState, type SelectionState, type TriState } from '../lib/selection'
import { cn } from '../lib/utils'

export interface BulkTagBarProps {
  selectedIds: string[]
  onClear: () => void
  /** Fires with the bar's measured height in px while visible, and `0` while
   *  hidden — so the parent scroll container can reserve (and animate)
   *  matching bottom padding. */
  onHeightChange?: (height: number) => void
}

/** Below this width (in px, measured on the bar's bounding box) the chip
 *  names + "Tag with:" hint hide and chips collapse to colored dots. The
 *  threshold lines up with where the full-label layout starts to wrap on a
 *  4-person palette. */
const COLLAPSE_BELOW_PX = 440

/** Slide/fade timing for entrance + exit. The padding transition on the
 *  scroll container should match these values so the table height adjusts in
 *  lockstep with the bar's slide. */
const TRANSITION_MS = 200
const TRANSITION_EASE = 'cubic-bezier(0.2, 0, 0, 1)'

const EMPTY_STATE: SelectionState = {
  tagStates: {},
  everyoneState: 'none',
  anyIncluded: false,
  anyExcluded: false
}

export function BulkTagBar({ selectedIds, onClear, onHeightChange }: BulkTagBarProps): JSX.Element {
  const people = useAppStore((s) => s.people)
  const transactions = useAppStore((s) => s.transactions)
  const addTag = useAppStore((s) => s.addTagToSelection)
  const removeTag = useAppStore((s) => s.removeTagFromSelection)
  const setTags = useAppStore((s) => s.setTagsForSelection)
  const clearTags = useAppStore((s) => s.clearTagsForSelection)
  const setExcluded = useAppStore((s) => s.setExcludedForSelection)

  const count = selectedIds.length
  const visible = count > 0

  const liveState = useMemo(
    () => deriveSelectionState(selectedIds, transactions, people),
    [selectedIds, transactions, people]
  )

  // Snapshot the rendered state while the selection is non-empty so the bar
  // keeps showing the previous content while it slides away. Without this,
  // dropping the selection visibly flips all chips to `none` mid-exit.
  const [snapshot, setSnapshot] = useState<{ count: number; state: SelectionState }>(() => ({
    count: 0,
    state: EMPTY_STATE
  }))
  useEffect(() => {
    if (visible) setSnapshot({ count, state: liveState })
  }, [visible, count, liveState])

  const displayCount = visible ? count : snapshot.count
  const { anyIncluded, anyExcluded, tagStates, everyoneState } = visible
    ? liveState
    : snapshot.state

  // Width observer drives the chip-name collapse threshold.
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth
      setCollapsed(w < COLLAPSE_BELOW_PX)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Height observer on the inner pill. Always measures the natural height
  // (the bar is always in the DOM); the reported value is conditional on
  // `visible` so the parent transitions back to zero on exit.
  const barRef = useRef<HTMLDivElement | null>(null)
  const [measuredHeight, setMeasuredHeight] = useState(0)
  useEffect(() => {
    const el = barRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? el.clientHeight
      setMeasuredHeight(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    onHeightChange?.(visible ? measuredHeight : 0)
  }, [visible, measuredHeight, onHeightChange])

  const allPersonIds = people.map((p) => p.id)
  const handlePersonClick = (personId: PersonId, state: TriState): void => {
    if (state === 'all') removeTag(selectedIds, personId)
    else addTag(selectedIds, personId)
  }
  const handleEveryoneClick = (): void => {
    if (everyoneState === 'all') clearTags(selectedIds)
    else setTags(selectedIds, allPersonIds)
  }

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4"
    >
      <div
        ref={barRef}
        role="toolbar"
        aria-label="Bulk actions"
        aria-hidden={!visible}
        className={cn(
          'flex w-max max-w-full flex-wrap content-center items-center justify-center gap-2 rounded-2xl bg-popover px-2 py-2 text-center shadow-lg ring-1 ring-border',
          'transition-[transform,opacity] motion-reduce:transition-none',
          visible
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-[calc(100%+1rem)] opacity-0'
        )}
        style={{
          transitionDuration: `${TRANSITION_MS}ms`,
          transitionTimingFunction: TRANSITION_EASE
        }}
      >
        {/* Leading region: × paired with the count so the close affordance
            can never be orphaned at narrow widths (Gmail / Things pattern). */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClear}
                aria-label="Clear selection"
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear selection</TooltipContent>
          </Tooltip>
          <span
            aria-live="polite"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground"
          >
            {displayCount} selected
          </span>
        </div>

        <span className="hidden h-4 w-px bg-border sm:inline-block" />

        {people.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {!collapsed && <span className="text-xs text-muted-foreground">Tag with:</span>}
            {/* "Everyone" tags every selected row with every person in one tap.
                Hidden when there's only one person, since it would just
                duplicate that person's chip. Tri-state semantics:
                  all     → click clears every tag from the selection
                  partial → click sets every selected row's tags to all people
                  none    → click sets every selected row's tags to all people */}
            {people.length >= 2 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={
                      everyoneState === 'all'
                        ? 'true'
                        : everyoneState === 'partial'
                          ? 'mixed'
                          : 'false'
                    }
                    onClick={handleEveryoneClick}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-foreground ring-1 ring-inset transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      everyoneState === 'all' && 'bg-accent ring-foreground/40',
                      everyoneState === 'partial' && 'bg-accent/40 ring-border',
                      everyoneState === 'none' && 'ring-border'
                    )}
                  >
                    <Users className="h-3 w-3 shrink-0" aria-hidden />
                    {!collapsed && <span>Everyone</span>}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {everyoneState === 'all'
                    ? 'Everyone is tagged on every row. Click to clear.'
                    : 'Tag every selected row with everyone.'}
                </TooltipContent>
              </Tooltip>
            )}
            {people.map((p) => {
              const state = tagStates[p.id] ?? 'none'
              // Person colour drives the chip's tone in all states; the
              // bg/ring opacity escalates with coverage so the user can read
              // the state at a glance: outlined (none) → soft fill (partial)
              // → strong fill (all).
              const bgAlpha = state === 'all' ? '33' : state === 'partial' ? '14' : '00'
              const ringAlpha = state === 'all' ? '' : state === 'partial' ? '99' : '33'
              const ariaChecked: 'true' | 'false' | 'mixed' =
                state === 'all' ? 'true' : state === 'partial' ? 'mixed' : 'false'
              const tip =
                state === 'all'
                  ? `${p.name}: tagged on all selected. Click to remove.`
                  : state === 'partial'
                    ? `${p.name}: tagged on some selected. Click to tag all.`
                    : `${p.name}: click to tag all selected.`
              return (
                <Tooltip key={p.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={ariaChecked}
                      aria-label={p.name}
                      onClick={() => handlePersonClick(p.id, state)}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      style={{
                        color: p.color,
                        backgroundColor: `${p.color}${bgAlpha}`,
                        boxShadow: `inset 0 0 0 1px ${p.color}${ringAlpha}`
                      }}
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                        aria-hidden
                      />
                      {!collapsed && <span>{p.name}</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{tip}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Add people to tag</span>
        )}

        <span className="hidden h-4 w-px bg-border sm:inline-block" />

        {/* Trailing actions wrap as a single unit so individual buttons can't
            be orphaned onto their own line at narrow widths. */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="xs" onClick={() => clearTags(selectedIds)}>
            Clear tags
          </Button>
          <ExcludeToggle
            anyIncluded={anyIncluded}
            anyExcluded={anyExcluded}
            onToggle={(excluded) => setExcluded(selectedIds, excluded)}
          />
        </div>
      </div>
    </div>
  )
}

/** Slide timing exported so parent layouts (scroll containers reserving
 *  bottom padding) can match the bar's enter/exit animation in lockstep. */
export const BULK_TAG_BAR_TRANSITION = {
  durationMs: TRANSITION_MS,
  easing: TRANSITION_EASE
} as const
