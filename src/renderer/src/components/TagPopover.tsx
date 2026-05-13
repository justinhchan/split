import { useEffect, useMemo, useRef, useState } from 'react'
import { Users, Tag } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Checkbox } from './ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import type { Person, PersonId } from '../store/types'

export interface TagPopoverProps {
  people: Person[]
  selected: PersonId[]
  onChange: (next: PersonId[]) => void
  trigger?: React.ReactNode
  /** For the bulk bar: selection may be mixed across rows. */
  indeterminate?: Set<PersonId>
}

export function TagPopover({
  people,
  selected,
  onChange,
  trigger,
  indeterminate
}: TagPopoverProps): JSX.Element {
  const selSet = useMemo(() => new Set(selected), [selected])
  const everyoneState = useMemo(() => {
    if (people.length === 0) return 'empty'
    const count = people.filter((p) => selSet.has(p.id)).length
    if (count === 0) return 'none'
    if (count === people.length) return 'all'
    return 'some'
  }, [people, selSet])

  const toggle = (id: PersonId): void => {
    if (selSet.has(id)) onChange(selected.filter((x) => x !== id))
    else onChange([...selected, id])
  }

  const toggleEveryone = (): void => {
    if (everyoneState === 'all') onChange([])
    else onChange(people.map((p) => p.id))
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Tag people"
          >
            <Tag className="h-3.5 w-3.5" />
            Tag
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        {people.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-pretty">
            Add a person in the sidebar to start tagging.
          </div>
        ) : (
          <ul className="flex flex-col">
            <li>
              <button
                type="button"
                onClick={toggleEveryone}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Checkbox
                  checked={everyoneState === 'all'}
                  indeterminate={everyoneState === 'some'}
                  onCheckedChange={toggleEveryone}
                  aria-label="Toggle everyone"
                  onClick={(e) => e.stopPropagation()}
                />
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Everyone</span>
              </button>
            </li>
            <li className="my-1 h-px bg-border" />
            {people.map((p) => {
              const checked = selSet.has(p.id)
              const mixed = indeterminate?.has(p.id) && !checked
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Checkbox
                      checked={checked}
                      indeterminate={!!mixed}
                      onCheckedChange={() => toggle(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Tag ${p.name}`}
                    />
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.color }}
                      aria-hidden
                    />
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function PersonChip({ person }: { person: Person }): JSX.Element {
  // Bespoke span rather than <Badge variant="outline">. The Badge variant
  // renders its edge via `ring-1 ring-inset ring-border` (a CSS box-shadow),
  // so inline `borderColor` has no effect and the ring stays default grey.
  // We need the ring itself to pick up person.color — a direct inset
  // box-shadow does that without needing a new variant.
  //
  // Tooltip wraps the chip so hovering reveals the full name when `truncate`
  // actually ellipsises it. TooltipContent only renders when the name span's
  // scrollWidth exceeds its clientWidth — so short, fully-visible names don't
  // get a redundant tooltip. A ResizeObserver on the name span keeps the flag
  // in sync as the chip area resizes (column width, sibling chip count, etc.).
  const nameRef = useRef<HTMLSpanElement | null>(null)
  const [isTruncated, setIsTruncated] = useState(false)
  useEffect(() => {
    const el = nameRef.current
    if (!el) return
    const measure = (): void => {
      // 1 px tolerance dodges subpixel-rounding false positives at boundaries.
      setIsTruncated(el.scrollWidth - el.clientWidth > 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [person.name])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="inline-flex min-w-0 items-center gap-1 rounded-full bg-transparent px-2 py-0.5 text-xs font-medium transition-colors"
          style={{
            color: person.color,
            boxShadow: `inset 0 0 0 1px ${person.color}`
          }}
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: person.color }}
            aria-hidden
          />
          <span ref={nameRef} className="truncate">
            {person.name}
          </span>
        </span>
      </TooltipTrigger>
      {isTruncated && <TooltipContent>{person.name}</TooltipContent>}
    </Tooltip>
  )
}
