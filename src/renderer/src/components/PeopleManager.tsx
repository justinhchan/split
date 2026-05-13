import { useEffect, useRef, useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Button } from './ui/button'
import { Input } from './ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { useAppStore } from '../store/useAppStore'
import type { Person } from '../store/types'
import { PERSON_PALETTE } from '../lib/colors'
import { cn } from '../lib/utils'

/** Keep in sync with the `row-exit` animation duration in tailwind.config.ts. */
const ROW_EXIT_MS = 180

interface PendingRemove {
  id: string
  name: string
  taggedCount: number
}

export function PeopleManager(): JSX.Element {
  const people = useAppStore((s) => s.people)
  const addPerson = useAppStore((s) => s.addPerson)
  const removePerson = useAppStore((s) => s.removePerson)

  // Person the user clicked the X on — shows the confirmation dialog.
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null)
  // Rows whose exit animation is running; we defer the store-level removal so
  // the row can play its exit before unmounting.
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(() => new Set())

  const requestRemove = (person: Person): void => {
    // Snapshot the tagged count at prompt time so the dialog copy is stable
    // while it's open.
    const taggedCount = useAppStore
      .getState()
      .transactions.filter((t) => t.tags.includes(person.id)).length
    setPendingRemove({ id: person.id, name: person.name, taggedCount })
  }

  const cancelRemove = (): void => setPendingRemove(null)

  const confirmRemove = (): void => {
    if (!pendingRemove) return
    const id = pendingRemove.id
    setPendingRemove(null)
    setPendingRemoval((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    window.setTimeout(() => {
      removePerson(id)
      setPendingRemoval((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, ROW_EXIT_MS)
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground">
            People
          </h2>
          <Button variant="ghost" size="xs" onClick={() => addPerson()} aria-label="Add person">
            <Plus />
            Add
          </Button>
        </div>
        <ul className="flex flex-col gap-1">
          {people.length === 0 ? (
            <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
              No people yet. Add one to start tagging transactions.
            </li>
          ) : (
            people.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                isRemoving={pendingRemoval.has(p.id)}
                onRemove={() => requestRemove(p)}
              />
            ))
          )}
        </ul>
      </div>

      <Dialog
        open={pendingRemove !== null}
        onOpenChange={(open) => {
          if (!open) cancelRemove()
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {pendingRemove?.name}?</DialogTitle>
            <DialogDescription>
              {pendingRemove && pendingRemove.taggedCount > 0
                ? `They're tagged on ${pendingRemove.taggedCount} transaction${
                    pendingRemove.taggedCount === 1 ? '' : 's'
                  }. Removing them will untag those transactions. This can't be undone.`
                : "Not tagged on anything yet. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelRemove}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface PersonRowProps {
  person: Person
  isRemoving: boolean
  onRemove: () => void
}

function PersonRow({ person, isRemoving, onRemove }: PersonRowProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [draft, setDraft] = useState(person.name)
  const renamePerson = useAppStore((s) => s.renamePerson)
  const setPersonColor = useAppStore((s) => s.setPersonColor)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Refs for keyboard navigation between the swatch row and the items above /
  // below it. Radix's roving tabindex would otherwise step through every
  // swatch when going Rename → Remove.
  const renameRef = useRef<HTMLDivElement | null>(null)
  const removeRef = useRef<HTMLDivElement | null>(null)
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  useEffect(() => setDraft(person.name), [person.name])

  const commit = (): void => {
    setEditing(false)
    if (draft.trim() && draft.trim() !== person.name) renamePerson(person.id, draft)
  }

  // Treat the swatches as a single horizontal "stop" within the menu:
  //   ArrowUp/Down on a swatch jumps over the rest of the row to Rename /
  //   Remove. ArrowLeft/Right cycles within the row (with wrap). We
  //   stopPropagation so Radix's Content-level keyboard handler doesn't fire
  //   its default per-item arrow navigation. Home/End fall through to Radix
  //   so the standard first/last shortcuts still work.
  const handleSwatchKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    switch (e.key) {
      case 'ArrowRight': {
        e.preventDefault()
        e.stopPropagation()
        const next = (index + 1) % PERSON_PALETTE.length
        swatchRefs.current[next]?.focus()
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        e.stopPropagation()
        const prev = (index - 1 + PERSON_PALETTE.length) % PERSON_PALETTE.length
        swatchRefs.current[prev]?.focus()
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        e.stopPropagation()
        removeRef.current?.focus()
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        e.stopPropagation()
        renameRef.current?.focus()
        break
      }
    }
  }

  const colorDot = (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: person.color }}
      aria-hidden
    />
  )

  return (
    // Fixed height keeps the row the same size whether we're showing static
    // text or the Input — otherwise entering/leaving edit mode jumps ~12px.
    // `overflow-hidden` lets the max-height entry/exit animations clip cleanly.
    // Hover bg lives on the li so it spans both view and edit modes; the
    // trigger button below stretches to the same footprint so the focus ring
    // and click target match the hover area.
    <li
      className={cn(
        'group h-9 overflow-hidden rounded-md hover:bg-accent/50',
        isRemoving ? 'animate-row-exit pointer-events-none' : 'animate-row-enter'
      )}
      aria-hidden={isRemoving || undefined}
    >
      {editing ? (
        <div className="flex h-full items-center gap-2 px-2">
          {colorDot}
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(person.name)
                setEditing(false)
              }
            }}
            onBlur={commit}
            // `Input` base styles include `px-3`; the view-mode trigger has no
            // horizontal padding on the name itself, so without the override
            // the text would jump 12px right when entering edit mode. Matching
            // at px-0 keeps the name in exactly the same spot — the
            // `ring-1 ring-input` outline sits outside the element, so the
            // text isn't cramped by it.
            className="h-7 px-0 text-sm"
            aria-label={`Rename ${person.name}`}
          />
        </div>
      ) : (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            {/* The button absorbs the entire row (h-full w-full + the row's
                px-2) so hover bg, focus ring, and click target all share the
                same rectangle. `ring-inset` keeps the focus ring inside the
                row's footprint instead of spilling outward. */}
            <button
              type="button"
              className="flex h-full w-full items-center gap-2 rounded-md px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              aria-label={`Open actions for ${person.name}`}
            >
              {colorDot}
              <span className="flex-1 truncate">{person.name}</span>
              <MoreHorizontal
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-opacity',
                  menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                )}
                aria-hidden
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[14rem]">
            <DropdownMenuItem
              ref={renameRef}
              onSelect={() => {
                // Defer so the menu's close animation doesn't steal focus from
                // the input we're about to render.
                setTimeout(() => setEditing(true), 0)
              }}
            >
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {/* Inline swatch row. Each swatch is a DropdownMenuPrimitive.Item
                so it joins the menu's roving tabindex (and gets data-highlighted
                styling for free). The arrow-key behaviour for the row is custom:
                Up/Down jump over the row to Rename / Remove, Left/Right cycle
                within. The styled DropdownMenuItem wrapper would force item
                padding/typography on us; the raw primitive lets us keep the
                inline circular layout. */}
            <div role="group" aria-label="Colour" className="flex items-center gap-1.5 px-2 py-1.5">
              {PERSON_PALETTE.map((swatch, index) => {
                const active = swatch.toLowerCase() === person.color.toLowerCase()
                return (
                  <DropdownMenuPrimitive.Item
                    key={swatch}
                    asChild
                    onSelect={() => {
                      if (!active) setPersonColor(person.id, swatch)
                      // Radix closes the menu after onSelect by default.
                    }}
                  >
                    <button
                      ref={(el) => {
                        swatchRefs.current[index] = el
                      }}
                      type="button"
                      aria-label={`Use ${swatch}`}
                      aria-pressed={active}
                      onKeyDown={(e) => handleSwatchKeyDown(e, index)}
                      className={cn(
                        'h-4 w-4 shrink-0 rounded-full outline-none ring-offset-popover transition-transform data-[highlighted]:scale-125',
                        active
                          ? 'ring-2 ring-foreground ring-offset-2'
                          : 'data-[highlighted]:ring-2 data-[highlighted]:ring-ring data-[highlighted]:ring-offset-2'
                      )}
                      style={{ backgroundColor: swatch }}
                    />
                  </DropdownMenuPrimitive.Item>
                )
              })}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              ref={removeRef}
              onSelect={() => onRemove()}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 />
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  )
}
