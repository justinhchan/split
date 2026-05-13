import { useEffect, useRef, useState } from 'react'
import { Checkbox } from './ui/checkbox'
import { Input } from './ui/input'
import { PersonChip } from './TagPopover'
import { TransactionRowMenu, TransactionRowActionsButton } from './TransactionRowMenu'
import { useAppStore } from '../store/useAppStore'
import { formatCurrency, formatDate } from '../lib/format'
import { cn } from '../lib/utils'
import type { ColumnKey, Person, Transaction } from '../store/types'

export interface TransactionRowProps {
  tx: Transaction
  peopleById: Record<string, Person>
  selected: boolean
  onToggleSelect: () => void
  /** Full row selection. Threaded down so the right-click menu can switch
   *  between single-row and bulk modes without the row having to know which
   *  it is. */
  selectedIds: Set<string>
  visibleCols: Record<ColumnKey, boolean>
  /** Columns the user wanted on but the responsive layer hid because the
   *  window is too narrow. Their data inlines as a muted secondary line
   *  inside the Description cell so it isn't silently lost. Category isn't
   *  tracked here — it always inlines whether the window is wide or narrow. */
  shedCols?: { date?: boolean }
}

export function TransactionRow({
  tx,
  peopleById,
  selected,
  onToggleSelect,
  selectedIds,
  visibleCols,
  shedCols
}: TransactionRowProps): JSX.Element {
  const updateTransaction = useAppStore((s) => s.updateTransaction)

  const [editingAmount, setEditingAmount] = useState(false)
  const [draftAmount, setDraftAmount] = useState(String(tx.amount))
  const amountInput = useRef<HTMLInputElement | null>(null)

  // Description edit state mirrors amount: Enter commits, Esc reverts, blur
  // commits, empty reverts. Description has the extra rule that an empty
  // string is rejected (descriptions are user-facing — losing them silently
  // would be confusing).
  const [editingDescription, setEditingDescription] = useState(false)
  const [draftDescription, setDraftDescription] = useState(tx.description)
  const descriptionInput = useRef<HTMLInputElement | null>(null)

  // Both focus effects defer via setTimeout(0) so they run AFTER Radix's
  // menu-close focus restoration. Radix queues its restore on the macrotask
  // queue inside FocusScope's unmount cleanup; a synchronous `.focus()` here
  // would land first and get overridden a tick later — at which point the
  // input would also lose focus, fire onBlur, and commit-and-unmount itself
  // before the user could type anything. Queuing on the same task queue,
  // later in the commit cycle, makes ours the last write. The cleanup
  // returns a clearTimeout so a quick state flip (edit → cancel → edit)
  // never fires a stale focus call against a stale ref.
  useEffect(() => {
    if (!editingAmount) return
    const t = setTimeout(() => {
      amountInput.current?.focus()
      amountInput.current?.select()
    }, 0)
    return () => clearTimeout(t)
  }, [editingAmount])

  useEffect(() => {
    if (!editingDescription) return
    const t = setTimeout(() => {
      descriptionInput.current?.focus()
      descriptionInput.current?.select()
    }, 0)
    return () => clearTimeout(t)
  }, [editingDescription])

  useEffect(() => setDraftAmount(String(tx.amount)), [tx.amount])
  useEffect(() => setDraftDescription(tx.description), [tx.description])

  const commitAmount = (): void => {
    setEditingAmount(false)
    const v = parseFloat(draftAmount)
    if (Number.isFinite(v) && Math.abs(v - tx.amount) > 0.0001) {
      updateTransaction(tx.id, { amount: Math.round(v * 100) / 100 })
    } else {
      setDraftAmount(String(tx.amount))
    }
  }

  const commitDescription = (): void => {
    setEditingDescription(false)
    const v = draftDescription.trim()
    if (v && v !== tx.description) {
      updateTransaction(tx.id, { description: v })
    } else {
      // Empty or unchanged → revert so the next edit starts from the real value.
      setDraftDescription(tx.description)
    }
  }

  const dim = tx.excluded ? 'opacity-75' : ''

  return (
    <TransactionRowMenu
      tx={tx}
      selectedIds={selectedIds}
      onStartEditDescription={() => setEditingDescription(true)}
      onStartEditAmount={() => setEditingAmount(true)}
    >
      <tr
        className={cn(
          'group border-b border-border transition-colors hover:bg-accent/30',
          selected && 'bg-accent/40',
          dim
        )}
      >
        <td className="px-3 align-middle">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect()}
            aria-label={`Select ${tx.description}`}
            className="checkbox-sm"
          />
        </td>

        {visibleCols.date && (
          <td className="px-3 py-2 align-middle tabular-nums text-muted-foreground">
            {formatDate(tx.date)}
          </td>
        )}

        {visibleCols.description && (
          <td className="px-3 py-2 align-middle">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-2">
                {editingDescription ? (
                  <Input
                    ref={descriptionInput}
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    onBlur={commitDescription}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitDescription()
                      if (e.key === 'Escape') {
                        setDraftDescription(tx.description)
                        setEditingDescription(false)
                      }
                    }}
                    className="h-7 w-full text-sm"
                  />
                ) : (
                  <span className={cn('truncate', tx.excluded && 'line-through')}>
                    {tx.description}
                  </span>
                )}
                {tx.edited && (
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" title="Edited" />
                )}
              </div>
              {/* Secondary metadata line: Category always inlines here (no
                  column). Date inlines only when its column has been shed by
                  the responsive layer. Auto-detected payment rows surface a
                  "Payment" marker here too — the row is already dim + struck
                  through, so this just names the reason in muted text rather
                  than competing for attention with a chip.
                  Hidden while either inline editor is active so the
                  description cell collapses back to a single line and the
                  description + amount inputs line up vertically — otherwise
                  align-middle centres the (input + metadata) stack and the
                  input ends up ~metadata_height/2 above the amount input. */}
              {!editingDescription && !editingAmount && (shedCols?.date || tx.isPayment || tx.category) && (
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {shedCols?.date && (
                    <span className="tabular-nums">{formatDate(tx.date)}</span>
                  )}
                  {shedCols?.date && (tx.isPayment || tx.category) && (
                    <span aria-hidden="true">·</span>
                  )}
                  {tx.isPayment && (
                    <span title="Auto-detected payment row">Payment</span>
                  )}
                  {tx.isPayment && tx.category && <span aria-hidden="true">·</span>}
                  {tx.category && <span className="truncate">{tx.category}</span>}
                </div>
              )}
            </div>
          </td>
        )}

        {visibleCols.amount && (
          <td className="px-3 py-2 align-middle text-right tabular-nums">
            {editingAmount ? (
              <Input
                ref={amountInput}
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                onBlur={commitAmount}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitAmount()
                  if (e.key === 'Escape') {
                    setDraftAmount(String(tx.amount))
                    setEditingAmount(false)
                  }
                }}
                className="h-7 w-24 text-right text-sm"
                inputMode="decimal"
              />
            ) : (
              <button
                type="button"
                onDoubleClick={() => setEditingAmount(true)}
                className="-mx-1 rounded px-1 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Edit amount (double-click or right-click)"
              >
                {formatCurrency(tx.amount)}
              </button>
            )}
          </td>
        )}

        {visibleCols.tags && (
          <td className="relative overflow-hidden px-3 py-2 align-middle">
            {/* Chips sit in their own flow — they can wrap freely without
                affecting the actions trigger's position. justify-end pulls
                them against the right edge of the chip area so the gap to
                the kebab is a consistent ~12 px regardless of how many tags
                are applied; pr-10 keeps the rightmost chip clear of the
                absolutely-positioned button. min-w-0 lets the flex container
                shrink below its content size so chips truncate rather than
                overflow the cell. */}
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 pr-10">
              {tx.tags.map((id) => {
                const p = peopleById[id]
                if (!p) return null
                return <PersonChip key={id} person={p} />
              })}
            </div>

            {/* Row-actions trigger pinned to the right edge of the cell —
                never in the chip flow, so toggling tags never shifts it.
                Hidden until row hover or focus to keep the resting state
                clean; data-[state=open] keeps it visible while the dropdown
                is open even if the pointer leaves the row. Same surface
                that right-clicking the row opens. Always available — even
                on excluded rows, where Include / Delete / Edit are still
                relevant. */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <TransactionRowActionsButton
                tx={tx}
                selectedIds={selectedIds}
                onStartEditDescription={() => setEditingDescription(true)}
                onStartEditAmount={() => setEditingAmount(true)}
              />
            </div>
          </td>
        )}
      </tr>
    </TransactionRowMenu>
  )
}
