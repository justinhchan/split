import { useMemo } from 'react'
import { Columns3 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from './ui/dropdown-menu'
import { Button } from './ui/button'
import { useAppStore } from '../store/useAppStore'
import type { ColumnKey } from '../store/types'

const LABELS: Record<ColumnKey, string> = {
  date: 'Date',
  description: 'Description',
  amount: 'Amount',
  tags: 'Tags'
}

const ORDER: ColumnKey[] = ['date', 'description', 'amount', 'tags']

export interface ColumnsMenuProps {
  /** What the responsive layer would show at the current container width.
   *  When the user's preference is on but `autoVisibleCols[k]` is false, the
   *  column is "auto-hidden" — we still show the checkbox as ticked (so the
   *  user's preference is preserved) but annotate it so the dropdown isn't
   *  silently lying about what's actually rendered. */
  autoVisibleCols?: Record<ColumnKey, boolean>
}

export function ColumnsMenu({ autoVisibleCols }: ColumnsMenuProps = {}): JSX.Element {
  const visibleCols = useAppStore((s) => s.tableUI.visibleCols)
  const setColumnVisible = useAppStore((s) => s.setColumnVisible)
  const hasTransactions = useAppStore((s) => s.transactions.length > 0)

  const visibleCount = useMemo(
    () => Object.values(visibleCols).filter(Boolean).length,
    [visibleCols]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!hasTransactions}>
          <Columns3 />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ORDER.map((k) => {
          const checked = visibleCols[k]
          const isLast = checked && visibleCount === 1
          const autoHidden = checked && autoVisibleCols && !autoVisibleCols[k]
          return (
            <DropdownMenuCheckboxItem
              key={k}
              checked={checked}
              disabled={isLast}
              onCheckedChange={(v) => setColumnVisible(k, !!v)}
              onSelect={(e) => e.preventDefault()}
            >
              {LABELS[k]}
              {isLast && <span className="ml-2 text-xs text-muted-foreground">(locked)</span>}
              {autoHidden && !isLast && (
                <span
                  className="ml-2 text-xs text-muted-foreground"
                  title="The window is too narrow to show this column. Its data appears inline under Description."
                >
                  (auto-hidden)
                </span>
              )}
            </DropdownMenuCheckboxItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
