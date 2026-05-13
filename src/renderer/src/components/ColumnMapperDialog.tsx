import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './ui/dialog'
import { Button } from './ui/button'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import type { ColumnMap, Transaction } from '../store/types'
import { parseCSV, type DetectedColumns } from '../lib/csv'

export interface ColumnMapperDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  csvText: string
  headers: string[]
  initialDetected: DetectedColumns | null
  onConfirm: (
    transactions: Transaction[],
    map: ColumnMap,
    excluded: { count: number; total: number }
  ) => void
}

export function ColumnMapperDialog(props: ColumnMapperDialogProps): JSX.Element {
  const { open, onOpenChange, csvText, headers, initialDetected, onConfirm } = props

  const [mode, setMode] = useState<'single' | 'debit-credit'>('single')
  const [dateCol, setDateCol] = useState('')
  const [descCol, setDescCol] = useState('')
  const [catCol, setCatCol] = useState<string>('')
  const [amountCol, setAmountCol] = useState<string>('')
  const [debitCol, setDebitCol] = useState<string>('')
  const [creditCol, setCreditCol] = useState<string>('')

  useEffect(() => {
    if (!initialDetected) return
    setMode(initialDetected.mode)
    setDateCol(initialDetected.date || '')
    setDescCol(initialDetected.description || '')
    setCatCol(initialDetected.category || '')
    setAmountCol(initialDetected.amount || '')
    setDebitCol(initialDetected.debit || '')
    setCreditCol(initialDetected.credit || '')
  }, [initialDetected, open])

  const canSubmit = useMemo(() => {
    if (!dateCol || !descCol) return false
    if (mode === 'single') return !!amountCol
    return !!debitCol && !!creditCol && debitCol !== creditCol
  }, [dateCol, descCol, amountCol, debitCol, creditCol, mode])

  const submit = (): void => {
    const map: ColumnMap = {
      date: dateCol,
      description: descCol,
      category: catCol || undefined,
      amount: mode === 'single' ? amountCol : undefined,
      debit: mode === 'debit-credit' ? debitCol : undefined,
      credit: mode === 'debit-credit' ? creditCol : undefined
    }
    const { transactions, excludedCount, excludedTotal } = parseCSV(csvText, map)
    onConfirm(transactions, map, { count: excludedCount, total: excludedTotal })
    onOpenChange(false)
  }

  const Select = ({
    label,
    value,
    onChange,
    optional
  }: {
    label: string
    value: string
    onChange: (v: string) => void
    optional?: boolean
  }): JSX.Element => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      <select
        className="h-9 rounded-md bg-transparent px-3 py-1 text-sm ring-1 ring-input focus:outline-none focus:ring-2 focus:ring-ring"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {optional && <option value="">None</option>}
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm columns</DialogTitle>
          <DialogDescription>
            Some columns couldn&apos;t be detected automatically. Choose them below;
            your selection will be remembered for this CSV format.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            Mode
          </span>
          <ToggleGroup
            type="single"
            size="sm"
            value={mode}
            onValueChange={(v) => {
              // Radix emits an empty string when the user clicks the
              // already-selected item — this toggle is a mutually-exclusive
              // mode picker, so ignore that and keep the current value.
              if (v === 'single' || v === 'debit-credit') setMode(v)
            }}
            aria-label="Amount column layout"
          >
            <ToggleGroupItem value="single" className="px-3 text-xs">
              Single amount
            </ToggleGroupItem>
            <ToggleGroupItem value="debit-credit" className="px-3 text-xs">
              Debit + Credit
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Date" value={dateCol} onChange={setDateCol} />
          <Select label="Description" value={descCol} onChange={setDescCol} />
          {mode === 'single' ? (
            <Select label="Amount" value={amountCol} onChange={setAmountCol} />
          ) : (
            <>
              <Select label="Debit" value={debitCol} onChange={setDebitCol} />
              <Select label="Credit" value={creditCol} onChange={setCreditCol} />
            </>
          )}
          <Select label="Category (optional)" value={catCol} onChange={setCatCol} optional />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Confirm columns
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
