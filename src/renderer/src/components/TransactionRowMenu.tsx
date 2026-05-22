import { useMemo, useRef } from 'react'
import {
  Check,
  DollarSign,
  Eraser,
  Eye,
  EyeOff,
  Minus,
  MoreHorizontal,
  Pencil,
  Receipt,
  Trash2,
  UserPlus,
  Users
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger
} from './ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { useAppStore } from '../store/useAppStore'
import { useUndoToast } from '../store/useUndoToast'
import { deriveSelectionState, type TriState } from '../lib/selection'
import type { Person, PersonId, Transaction } from '../store/types'

/** Component set used by `RowMenuItems` so the same item tree renders inside
 *  either a `ContextMenuContent` (right-click) or a `DropdownMenuContent`
 *  (... button click). The Radix primitives behind both menus share the
 *  same props surface — `React.ElementType` keeps the kit shape loose
 *  enough to accept both without parametric type gymnastics. */
interface MenuKit {
  Item: React.ElementType
  Label: React.ElementType
  Separator: React.ElementType
}

const ContextMenuKit: MenuKit = {
  Item: ContextMenuItem,
  Label: ContextMenuLabel,
  Separator: ContextMenuSeparator
}

const DropdownMenuKit: MenuKit = {
  Item: DropdownMenuItem,
  Label: DropdownMenuLabel,
  Separator: DropdownMenuSeparator
}

export interface RowMenuProps {
  tx: Transaction
  /** Current row selection. Bulk mode kicks in when this set contains `tx.id`
   *  and has more than one entry — same convention Linear and Finder use. */
  selectedIds: Set<string>
  /** Called when the user picks "Edit description". Parent owns the editing
   *  state because the inline editor lives on the row, not in this menu. */
  onStartEditDescription: () => void
  /** Called when the user picks "Edit amount". */
  onStartEditAmount: () => void
}

interface RowMenuLogic {
  bulk: boolean
  count: number
  people: ReadonlyArray<Person>
  targetIds: string[]
  tagStates: Record<PersonId, TriState>
  everyoneState: TriState
  willExclude: boolean
  willMarkPayment: boolean
  anyExcluded: boolean
  handlePersonClick: (personId: PersonId, state: TriState) => void
  handleEveryoneClick: () => void
  handleClearTags: () => void
  handleSetPayment: () => void
  handleSetExcluded: () => void
  handleDelete: () => void
  /** Empty-state shortcut: creates the next auto-named person ("Player 1",
   *  "Player 2", …) and tags them on the target rows in a single click. */
  handleAddPersonAndTag: () => void
}

/** All the derivations + bound handlers the items need. Lifting these into a
 *  hook keeps the two trigger wrappers (`TransactionRowMenu` and
 *  `TransactionRowActionsButton`) thin and ensures both surfaces produce
 *  identical behaviour from identical inputs. */
function useRowMenuLogic(tx: Transaction, selectedIds: Set<string>): RowMenuLogic {
  const transactions = useAppStore((s) => s.transactions)
  const people = useAppStore((s) => s.people)
  const addTag = useAppStore((s) => s.addTagToSelection)
  const removeTag = useAppStore((s) => s.removeTagFromSelection)
  const setTags = useAppStore((s) => s.setTagsForSelection)
  const clearTags = useAppStore((s) => s.clearTagsForSelection)
  const setExcluded = useAppStore((s) => s.setExcludedForSelection)
  const setPayment = useAppStore((s) => s.setPaymentForSelection)
  const deleteRows = useAppStore((s) => s.deleteTransactionsForSelection)
  const restoreRows = useAppStore((s) => s.restoreTransactions)
  const addPerson = useAppStore((s) => s.addPerson)
  const showToast = useUndoToast((s) => s.show)

  // Single-row when the right-clicked row isn't in the current selection, or
  // the selection only has this one row. Don't disturb the selection on
  // right-click — surprising behaviour.
  const bulk = selectedIds.has(tx.id) && selectedIds.size > 1
  const targetIds = useMemo(() => (bulk ? [...selectedIds] : [tx.id]), [bulk, selectedIds, tx.id])
  const count = targetIds.length

  // Tag tri-state across the targets. Reusing `deriveSelectionState` keeps
  // the rules identical to BulkTagBar so a partial selection looks and
  // behaves the same in both surfaces.
  const { tagStates, everyoneState, anyIncluded, anyExcluded } = useMemo(
    () => deriveSelectionState(targetIds, transactions, people),
    [targetIds, transactions, people]
  )

  // Aggregate payment + exclusion state. Mirrors `ExcludeToggle`'s any-vs-all
  // rule: "Exclude" if ANY included; "Include" only when ALL are excluded.
  // "Unmark payment" only when ALL targets are marked.
  const { allPayment } = useMemo(() => {
    let allPay = true
    let hit = 0
    for (const t of transactions) {
      if (!selectedIdsOrSingle(targetIds).has(t.id)) continue
      hit += 1
      if (!t.isPayment) allPay = false
    }
    if (hit === 0) allPay = false
    return { allPayment: allPay }
  }, [transactions, targetIds])

  const willExclude = anyIncluded
  const willMarkPayment = !allPayment

  // Phrase that ties bulk-vs-single feedback messages together so the toast
  // copy stays consistent without each handler reinventing the suffix.
  const rowsLabel = bulk ? `${count} rows` : '1 row'

  // Tag-click semantics: tri-state aware so a single click always funnels the
  // selection toward a consistent state instead of inverting per-row.
  //   all     → remove the person from every target
  //   partial → add the person to every target the person is missing from
  //   none    → add the person to every target
  const handlePersonClick = (personId: PersonId, state: TriState): void => {
    const name = people.find((p) => p.id === personId)?.name ?? 'person'
    if (state === 'all') {
      removeTag(targetIds, personId)
      showToast(bulk ? `Untagged ${name} from ${rowsLabel}` : `Untagged ${name}`)
    } else {
      addTag(targetIds, personId)
      showToast(bulk ? `Tagged ${rowsLabel} with ${name}` : `Tagged with ${name}`)
    }
  }
  const handleEveryoneClick = (): void => {
    if (everyoneState === 'all') {
      clearTags(targetIds)
      showToast(bulk ? `Cleared tags on ${rowsLabel}` : 'Cleared tags')
    } else {
      setTags(
        targetIds,
        people.map((p) => p.id)
      )
      showToast(bulk ? `Tagged ${rowsLabel} with everyone` : 'Tagged with everyone')
    }
  }
  const handleClearTags = (): void => {
    clearTags(targetIds)
    showToast(bulk ? `Cleared tags on ${rowsLabel}` : 'Cleared tags')
  }
  const handleSetPayment = (): void => {
    setPayment(targetIds, willMarkPayment)
    const msg = willMarkPayment
      ? bulk
        ? `Marked ${count} as payment`
        : 'Marked as payment'
      : bulk
        ? `Unmarked ${count} as payment`
        : 'Unmarked payment'
    showToast(msg)
  }
  const handleSetExcluded = (): void => {
    setExcluded(targetIds, willExclude)
    const msg = willExclude
      ? bulk
        ? `Excluded ${count} from totals`
        : 'Excluded from totals'
      : bulk
        ? `Included ${count} in totals`
        : 'Included in totals'
    showToast(msg)
  }

  const handleDelete = (): void => {
    const entries = deleteRows(targetIds)
    if (entries.length === 0) return
    const message = entries.length === 1 ? 'Deleted 1 row' : `Deleted ${entries.length} rows`
    showToast(message, () => restoreRows(entries))
  }

  const handleAddPersonAndTag = (): void => {
    const person = addPerson()
    addTag(targetIds, person.id)
    showToast(bulk ? `Tagged ${rowsLabel} with ${person.name}` : `Tagged with ${person.name}`)
  }

  return {
    bulk,
    count,
    people,
    targetIds,
    tagStates,
    everyoneState,
    willExclude,
    willMarkPayment,
    anyExcluded,
    handlePersonClick,
    handleEveryoneClick,
    handleClearTags,
    handleSetPayment,
    handleSetExcluded,
    handleDelete,
    handleAddPersonAndTag
  }
}

function selectedIdsOrSingle(ids: ReadonlyArray<string>): Set<string> {
  return new Set(ids)
}

interface RowMenuItemsProps extends RowMenuLogic {
  M: MenuKit
  onStartEditDescription: () => void
  onStartEditAmount: () => void
}

/** Shared item tree. Renders into either a ContextMenu's or a DropdownMenu's
 *  content. The two Radix surfaces use distinct context providers, so the
 *  primitives themselves can't be swapped at runtime — but they share an API
 *  surface, so a kit prop is enough to keep this DRY. */
function RowMenuItems({
  M,
  bulk,
  count,
  people,
  tagStates,
  everyoneState,
  willExclude,
  willMarkPayment,
  handlePersonClick,
  handleEveryoneClick,
  handleClearTags,
  handleSetPayment,
  handleSetExcluded,
  handleDelete,
  handleAddPersonAndTag,
  onStartEditDescription,
  onStartEditAmount
}: RowMenuItemsProps): JSX.Element {
  // Per-person row inside the Tag submenu. Tri-state indicator on the left
  // (Check / Minus / blank) so partial coverage is legible without nesting
  // a real Checkbox. The colour dot reinforces which person each line is.
  const renderPersonItem = (p: Person, state: TriState): JSX.Element => (
    <M.Item
      key={p.id}
      onSelect={(event: Event) => {
        // Keep the menu open so the user can toggle several people in a row
        // before dismissing. Same affordance the old TagPopover had.
        event.preventDefault()
        handlePersonClick(p.id, state)
      }}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center">
        {state === 'all' && <Check className="h-3.5 w-3.5" />}
        {state === 'partial' && <Minus className="h-3.5 w-3.5" />}
      </span>
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: p.color }}
        aria-hidden
      />
      <span className="truncate">{p.name}</span>
    </M.Item>
  )

  return (
    <>
      {/* Edit-single-value items only make sense for one row at a time.
          Disabled (not hidden) in bulk so the menu shape stays consistent
          and the user can see what's not available. */}
      <M.Item onSelect={onStartEditDescription} disabled={bulk}>
        <Pencil />
        <span>Edit description</span>
      </M.Item>
      <M.Item onSelect={onStartEditAmount} disabled={bulk}>
        <DollarSign />
        <span>Edit amount</span>
      </M.Item>

      <M.Separator />

      {/* Tag options inline (no submenu). Submenus open on hover or
          pointermove — neither is reliable on touch, where a fast tap-and-
          release never opens them. Flattening makes every tag option a direct
          tap; tri-state indicator on the left still shows partial coverage. */}
      {people.length > 0 ? (
        <>
          <M.Label>{bulk ? `Tag ${count} rows` : 'Tag people'}</M.Label>
          {people.map((p) => renderPersonItem(p, tagStates[p.id] ?? 'none'))}
          {people.length >= 2 && (
            <M.Item
              onSelect={(event: Event) => {
                event.preventDefault()
                handleEveryoneClick()
              }}
            >
              <span className="flex h-3.5 w-3.5 items-center justify-center">
                {everyoneState === 'all' && <Check className="h-3.5 w-3.5" />}
                {everyoneState === 'partial' && <Minus className="h-3.5 w-3.5" />}
              </span>
              <Users />
              <span>Everyone</span>
            </M.Item>
          )}
          <M.Item onSelect={handleClearTags} disabled={everyoneState === 'none'}>
            <span className="flex h-3.5 w-3.5 items-center justify-center" />
            <Eraser />
            <span>Clear tags</span>
          </M.Item>
          <M.Separator />
        </>
      ) : (
        <>
          <M.Label>Tag people</M.Label>
          {/* No people yet — collapse the empty hint + "open sidebar, add a
              person, come back" detour into a single action. Creates the next
              auto-named "Player N" and tags them on the target rows. The user
              can still rename in the sidebar afterwards. */}
          <M.Item onSelect={handleAddPersonAndTag}>
            <UserPlus />
            <span>{bulk ? `Add a person and tag ${count} rows` : 'Add a person and tag'}</span>
          </M.Item>
          <M.Separator />
        </>
      )}

      <M.Item onSelect={handleSetPayment}>
        <Receipt />
        <span>
          {willMarkPayment
            ? bulk
              ? `Mark ${count} as payment`
              : 'Mark as payment'
            : bulk
              ? `Unmark ${count} as payment`
              : 'Unmark payment'}
        </span>
      </M.Item>
      <M.Item onSelect={handleSetExcluded}>
        {willExclude ? <EyeOff /> : <Eye />}
        <span>
          {willExclude
            ? bulk
              ? `Exclude ${count} from totals`
              : 'Exclude from totals'
            : bulk
              ? `Include ${count} in totals`
              : 'Include in totals'}
        </span>
      </M.Item>

      <M.Separator />

      <M.Item destructive onSelect={handleDelete}>
        <Trash2 />
        <span>{bulk ? `Delete ${count} rows` : 'Delete row'}</span>
      </M.Item>
    </>
  )
}

export interface TransactionRowMenuProps extends RowMenuProps {
  /** Trigger area. Typically the row's `<tr>` so right-click anywhere on the
   *  row opens the menu. */
  children: React.ReactNode
}

interface EditFocusGate {
  onStartEditDescription: () => void
  onStartEditAmount: () => void
  onCloseAutoFocus: (event: Event) => void
}

/**
 * Suppresses Radix's auto-focus-restore on close *only* when the user just
 * picked an Edit action. Without this, the row's `useEffect` focuses the
 * newly mounted Input — and Radix's own `requestAnimationFrame` callback
 * fires afterwards and yanks focus back to the menu trigger. For non-Edit
 * actions we let the default restoration run so keyboard users return to
 * where they were.
 */
function useEditFocusGate(
  onStartEditDescription: () => void,
  onStartEditAmount: () => void
): EditFocusGate {
  // Ref instead of state so toggling it doesn't trigger a render. The flag
  // lives only for the (sync) span between `onSelect` and the matching
  // `onCloseAutoFocus`, then resets.
  const pending = useRef(false)
  return {
    onStartEditDescription: () => {
      pending.current = true
      onStartEditDescription()
    },
    onStartEditAmount: () => {
      pending.current = true
      onStartEditAmount()
    },
    onCloseAutoFocus: (event) => {
      if (pending.current) {
        event.preventDefault()
        pending.current = false
      }
    }
  }
}

/** Right-click wrapper. Identical content to the "..." button's dropdown. */
export function TransactionRowMenu({
  tx,
  selectedIds,
  onStartEditDescription,
  onStartEditAmount,
  children
}: TransactionRowMenuProps): JSX.Element {
  const logic = useRowMenuLogic(tx, selectedIds)
  const gate = useEditFocusGate(onStartEditDescription, onStartEditAmount)
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent onCloseAutoFocus={gate.onCloseAutoFocus}>
        <RowMenuItems
          M={ContextMenuKit}
          {...logic}
          onStartEditDescription={gate.onStartEditDescription}
          onStartEditAmount={gate.onStartEditAmount}
        />
      </ContextMenuContent>
    </ContextMenu>
  )
}

/** "..." button trigger. Anchors a DropdownMenu with the same items as the
 *  right-click menu — click affordance for users who don't think to
 *  right-click, and a Linear-style permanent action surface for keyboard
 *  navigation (tabbing onto the button + Enter opens it). Hover-reveal
 *  styling matches the old Tag button so the row's resting state stays
 *  clean.
 *
 *  Pass `alwaysVisible` on touch surfaces (card layout, mobile) where there's
 *  no hover state to reveal the button — otherwise the kebab is permanently
 *  invisible and the row has no obvious affordance. */
export function TransactionRowActionsButton({
  tx,
  selectedIds,
  onStartEditDescription,
  onStartEditAmount,
  alwaysVisible = false
}: RowMenuProps & { alwaysVisible?: boolean }): JSX.Element {
  const logic = useRowMenuLogic(tx, selectedIds)
  const gate = useEditFocusGate(onStartEditDescription, onStartEditAmount)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            alwaysVisible
              ? 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              : 'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity duration-150 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 data-[state=open]:opacity-100'
          }
          aria-label="Row actions"
        >
          <MoreHorizontal className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} onCloseAutoFocus={gate.onCloseAutoFocus}>
        <RowMenuItems
          M={DropdownMenuKit}
          {...logic}
          onStartEditDescription={gate.onStartEditDescription}
          onStartEditAmount={gate.onStartEditAmount}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
