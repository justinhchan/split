import { Eye, EyeOff } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

export interface ExcludeToggleProps {
  /** True if at least one selected row is currently included (not excluded). */
  anyIncluded: boolean
  /** True if at least one selected row is currently excluded. */
  anyExcluded: boolean
  /** Called with the next desired excluded value for the whole selection. */
  onToggle: (excluded: boolean) => void
}

/* Cross-fade transition values shared by both swaps in this component. Same
   recipe as ThemeToggle (per the make-interfaces-feel-better skill):
   scale 0.25→1, opacity 0→1, blur 4px→0, cubic-bezier(0.2, 0, 0, 1). */
const CROSSFADE = 'transition-[opacity,filter,scale] duration-300'
const CROSSFADE_OUT = 'scale-[0.25] opacity-0 blur-[4px]'
const CROSSFADE_IN = 'scale-100 opacity-100 blur-0'
const EASE = 'cubic-bezier(0.2, 0, 0, 1)'

function Crossfade({
  active,
  children
}: {
  active: boolean
  children: React.ReactNode
}): JSX.Element {
  return (
    <span
      aria-hidden={!active}
      className={cn('absolute inset-0', CROSSFADE, active ? CROSSFADE_IN : CROSSFADE_OUT)}
      style={{ transitionTimingFunction: EASE }}
    >
      {children}
    </span>
  )
}

/**
 * Tri-state exclusion toggle for the bulk action bar.
 *  - include (all rows counted) → click sets them aside
 *  - exclude (all rows set aside) → click brings them back
 *  - mixed (both present) → prefer the set-aside action so repeated clicks
 *    funnel the selection to a single state.
 *
 * Both the icon and the label cross-fade simultaneously so the enter AND exit
 * animate without framer-motion.
 */
export function ExcludeToggle({
  anyIncluded,
  anyExcluded,
  onToggle
}: ExcludeToggleProps): JSX.Element {
  const isExclude = anyExcluded && !anyIncluded
  const willExclude = !isExclude

  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={() => onToggle(willExclude)}
      aria-label={willExclude ? 'Exclude from totals' : 'Include in totals'}
    >
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <Crossfade active={willExclude}>
          <EyeOff className="h-4 w-4" />
        </Crossfade>
        <Crossfade active={!willExclude}>
          <Eye className="h-4 w-4" />
        </Crossfade>
      </span>
      <span className="relative inline-block">
        {/* Reserve width with the wider label so the surrounding layout
            doesn't shift when state flips. */}
        <span aria-hidden className="invisible">
          Exclude
        </span>
        <Crossfade active={willExclude}>Exclude</Crossfade>
        <Crossfade active={!willExclude}>Include</Crossfade>
      </span>
    </Button>
  )
}
