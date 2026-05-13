import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Button } from './ui/button'
import { Checkbox } from './ui/checkbox'
import { TransactionRow } from './TransactionRow'
import { ColumnsMenu } from './ColumnsMenu'
import { BulkTagBar, BULK_TAG_BAR_TRANSITION } from './BulkTagBar'
import { ImportBanner } from './ImportBanner'
import { useAppStore, DEFAULT_COL_WIDTHS } from '../store/useAppStore'
import type { SortableKey } from '../store/types'
import { computeAutoVisibleCols, computeEffectiveVisibleCols } from '../lib/columns'
import { useContainerWidth } from '../hooks/useContainerWidth'
import { cn } from '../lib/utils'

export function TransactionsTable(): JSX.Element {
  const transactions = useAppStore((s) => s.transactions)
  const people = useAppStore((s) => s.people)
  const sort = useAppStore((s) => s.tableUI.sort)
  const userVisibleCols = useAppStore((s) => s.tableUI.visibleCols)
  const cycleSort = useAppStore((s) => s.cycleSort)

  // Measure the card-surface wrapper rather than the viewport. The sidebar
  // becomes a drawer below 1024 px, so the table reclaims that space — the
  // window-level breakpoint is the wrong signal for column shedding.
  const cardRef = useRef<HTMLDivElement | null>(null)
  const containerWidth = useContainerWidth(cardRef)

  const autoVisibleCols = useMemo(() => computeAutoVisibleCols(containerWidth), [containerWidth])
  const visibleCols = useMemo(
    () => computeEffectiveVisibleCols(userVisibleCols, autoVisibleCols),
    [userVisibleCols, autoVisibleCols]
  )
  // Columns the user wanted but the responsive layer hid. These get inlined
  // as a muted second line under Description so the data is never lost.
  // Category is permanently inlined and isn't tracked here.
  const shedCols = useMemo(
    () => ({
      date: userVisibleCols.date && !autoVisibleCols.date
    }),
    [userVisibleCols, autoVisibleCols]
  )

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // The BulkTagBar reports its measured height (0 while hidden) so the table
  // card can push itself up by that amount — without it the last row sits
  // beneath the floating bar, especially after the bar wraps at narrow
  // widths. Padding lives on the outer flex container so the whole card
  // (header + scroll body) shrinks in lockstep with the bar's slide rather
  // than only padding the scroll area's internal whitespace.
  const [barHeight, setBarHeight] = useState(0)
  // 24px breathing room between the card's bottom edge and the bar's top —
  // a touch more than the page's `p-4` (16px) rhythm so the floating pill
  // reads as its own region rather than sitting flush against the table.
  const BAR_GAP_PX = 24
  const cardPushUpPx = barHeight > 0 ? barHeight + BAR_GAP_PX : 0

  const peopleById = useMemo<Record<string, (typeof people)[number]>>(
    () => Object.fromEntries(people.map((p) => [p.id, p])),
    [people]
  )

  const sortedTransactions = useMemo(() => {
    if (!sort.key) return transactions
    const key = sort.key
    const dir = sort.dir === 'asc' ? 1 : -1
    const copy = [...transactions]
    copy.sort((a, b) => {
      if (key === 'amount') return (a.amount - b.amount) * dir
      if (key === 'date') return (Date.parse(a.date) - Date.parse(b.date)) * dir
      const av = (a[key] ?? '').toString().toLowerCase()
      const bv = (b[key] ?? '').toString().toLowerCase()
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
      return 0
    })
    return copy
  }, [transactions, sort])

  // Reconcile the selection if rows get removed.
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(transactions.map((t) => t.id))
      const next = new Set<string>()
      for (const id of prev) if (valid.has(id)) next.add(id)
      if (next.size === prev.size) return prev
      return next
    })
  }, [transactions])

  const allChecked = transactions.length > 0 && selectedIds.size === transactions.length
  const someChecked = selectedIds.size > 0 && selectedIds.size < transactions.length

  const toggleAll = (): void => {
    if (allChecked) setSelectedIds(new Set())
    else setSelectedIds(new Set(transactions.map((t) => t.id)))
  }

  const toggleOne = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Colgroup shared by header + body so columns line up across the two tables.
  // Description is intentionally the only column without an explicit width:
  // under `table-fixed` it becomes the flex column that absorbs slack when
  // the window grows and shrinks last when it narrows. The responsive layer
  // (see `lib/columns.ts`) auto-sheds Date before Description gets narrow
  // enough to clip badly. Category is permanently inlined under Description
  // and never appears as a column. Include/exclude (formerly a trailing
  // 40-px column with an Eye/EyeOff button) is now handled via the row
  // right-click menu — row dim + strikethrough still signal excluded state.
  const renderCols = (): JSX.Element => (
    <colgroup>
      <col style={{ width: 40 }} />
      {visibleCols.date && <col style={{ width: DEFAULT_COL_WIDTHS.date }} />}
      {visibleCols.description && <col />}
      {visibleCols.amount && <col style={{ width: DEFAULT_COL_WIDTHS.amount }} />}
      {visibleCols.tags && <col style={{ width: DEFAULT_COL_WIDTHS.tags }} />}
    </colgroup>
  )

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-3 motion-reduce:transition-none"
      style={{
        paddingBottom: `${cardPushUpPx}px`,
        transitionProperty: 'padding-bottom',
        transitionDuration: `${BULK_TAG_BAR_TRANSITION.durationMs}ms`,
        transitionTimingFunction: BULK_TAG_BAR_TRANSITION.easing
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground">
          Transactions <span className="ml-1">({transactions.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <ColumnsMenu autoVisibleCols={autoVisibleCols} />
        </div>
      </div>

      <ImportBanner />

      <div ref={cardRef} className="card-surface flex min-h-0 flex-1 flex-col overflow-hidden">
        {transactions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground text-pretty">
            Upload a CSV to get started. Columns are detected automatically.
          </div>
        ) : (
          <>
            {/* Header — non-scrolling. `scrollbar-gutter: stable` keeps columns
                aligned with the body table when it scrolls. The wrapper carries
                the bottom border (rather than each <th>) so the line crosses the
                gutter strip too — otherwise there's a 1-cell gap on the right
                between the rightmost cell and the card edge. */}
            <div
              className="overflow-hidden border-b border-border"
              style={{ scrollbarGutter: 'stable' }}
            >
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                {renderCols()}
                <thead className="bg-card">
                  <tr>
                    <th className="px-3 py-2 bg-card">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onCheckedChange={() => toggleAll()}
                        aria-label="Select all"
                        className="checkbox-sm"
                      />
                    </th>
                    {visibleCols.date && (
                      <HeaderCell label="Date" sortKey="date" sort={sort} onSort={cycleSort} />
                    )}
                    {visibleCols.description && (
                      <HeaderCell
                        label="Description"
                        sortKey="description"
                        sort={sort}
                        onSort={cycleSort}
                      />
                    )}
                    {visibleCols.amount && (
                      <HeaderCell
                        label="Amount"
                        sortKey="amount"
                        sort={sort}
                        onSort={cycleSort}
                        alignRight
                      />
                    )}
                    {visibleCols.tags && <HeaderCell label="Tags" />}
                  </tr>
                </thead>
              </table>
            </div>

            {/* Body — scrolls. Same table-fixed + colgroup → columns stay aligned.
                rounded-b-lg matches the parent card-surface radius so the WebKit
                scrollbar track doesn't render into the clipped corner area. */}
            <div
              className="table-scroll flex-1 overflow-auto pb-3"
              style={{ scrollbarGutter: 'stable' }}
            >
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm">
                {renderCols()}
                <tbody>
                  {sortedTransactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      peopleById={peopleById}
                      selected={selectedIds.has(tx.id)}
                      onToggleSelect={() => toggleOne(tx.id)}
                      selectedIds={selectedIds}
                      visibleCols={visibleCols}
                      shedCols={shedCols}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <BulkTagBar
        selectedIds={[...selectedIds]}
        onClear={() => setSelectedIds(new Set())}
        onHeightChange={setBarHeight}
      />
    </div>
  )
}

interface HeaderCellProps {
  label: string
  sortKey?: SortableKey
  sort?: { key: SortableKey | null; dir: 'asc' | 'desc' }
  onSort?: (key: SortableKey) => void
  alignRight?: boolean
}

function HeaderCell({ label, sortKey, sort, onSort, alignRight }: HeaderCellProps): JSX.Element {
  const ariaSort =
    sort && sortKey && sort.key === sortKey
      ? sort.dir === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'

  return (
    <th
      aria-sort={ariaSort}
      className={cn(
        'group relative select-none bg-card px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground',
        alignRight && 'text-right'
      )}
    >
      <div className={cn('flex items-center gap-1', alignRight && 'justify-end')}>
        {sortKey && onSort ? (
          <Button
            variant="ghost"
            size="sm"
            static
            onClick={() => onSort(sortKey)}
            className="-mx-1.5 gap-1 px-1.5 font-medium tracking-wide"
          >
            <span>{label}</span>
            <SortIcon active={sort?.key === sortKey} dir={sort?.dir ?? 'asc'} />
          </Button>
        ) : (
          <span>{label}</span>
        )}
      </div>
    </th>
  )
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }): JSX.Element {
  // Cross-fade all three icon states (inactive/asc/desc) so the header never
  // "pops" when the sort flips. Values per the make-interfaces-feel-better
  // skill: scale 0.25→1, opacity 0→1, blur 4px→0, cubic-bezier(0.2, 0, 0, 1).
  const showUp = active && dir === 'asc'
  const showDown = active && dir === 'desc'
  const inactive = !active
  const base = 'absolute inset-0 h-3 w-3 transition-[opacity,filter,scale] duration-300'
  const timing = { transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)' }
  return (
    <span className="relative inline-flex h-3 w-3 items-center justify-center">
      <ArrowUp
        className={cn(
          base,
          showUp ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]'
        )}
        style={timing}
      />
      <ArrowDown
        className={cn(
          base,
          showDown ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]'
        )}
        style={timing}
      />
      <ArrowUpDown
        className={cn(
          base,
          inactive
            ? 'scale-100 blur-0 opacity-0 group-hover:opacity-60'
            : 'scale-[0.25] opacity-0 blur-[4px]'
        )}
        style={timing}
      />
    </span>
  )
}
