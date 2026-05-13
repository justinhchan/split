import { useMemo } from 'react'
import { AlertTriangle, Check, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { useAppStore } from '../store/useAppStore'
import { perPersonTotals } from '../lib/split'
import { formatCurrency, formatCurrencyAbs } from '../lib/format'

export function SummaryPanel(): JSX.Element {
  const people = useAppStore((s) => s.people)
  const transactions = useAppStore((s) => s.transactions)

  const result = useMemo(() => perPersonTotals(transactions, people), [transactions, people])
  const {
    owed,
    taggedCounts,
    grand,
    untagged,
    untaggedCount,
    excluded,
    excludedCount,
    mismatch
  } = result

  const showPerPerson = people.length > 0 && transactions.length > 0

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground">Summary</h2>

      <div className="rounded-md bg-accent/40 px-3 py-2 ring-1 ring-border">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">Statement total</span>
          <span className="text-base font-semibold tabular-nums">{formatCurrency(grand)}</span>
        </div>
        {excludedCount > 0 && (
          <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Excluded ({excludedCount})
            </span>
            <span className="tabular-nums">{formatCurrency(excluded)}</span>
          </div>
        )}
      </div>

      {showPerPerson && (
        <ul className="flex flex-col gap-1 rounded-md bg-accent/40 px-3 py-2 ring-1 ring-border">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                <span className="truncate">
                  {p.name}{' '}
                  <span className="tabular-nums text-muted-foreground">
                    ({taggedCounts[p.id] ?? 0})
                  </span>
                </span>
              </div>
              <span className="tabular-nums">{formatCurrency(owed[p.id] ?? 0)}</span>
            </li>
          ))}
        </ul>
      )}

      {transactions.length > 0 && (
        <>
          {untaggedCount === 0 && !mismatch ? (
            <Alert variant="success">
              <Check className="h-3.5 w-3.5" />
              <AlertTitle>All transactions tagged</AlertTitle>
            </Alert>
          ) : (
            <Alert variant="warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="space-y-0.5">
                  {untaggedCount > 0 && (
                    <li>
                      {untaggedCount === 1
                        ? '1 transaction untagged'
                        : `${untaggedCount} transactions untagged`}{' '}
                      (<span className="tabular-nums">{formatCurrencyAbs(untagged)}</span>)
                    </li>
                  )}
                  {mismatch && (
                    <li>
                      Per-person totals off by{' '}
                      <span className="tabular-nums">
                        {formatCurrencyAbs(Math.abs(result.sum + untagged - grand))}
                      </span>
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {transactions.length === 0 && (
        <Alert>
          <Info className="h-3.5 w-3.5" />
          <AlertTitle className="text-muted-foreground font-normal">
            Load a CSV to see totals per person.
          </AlertTitle>
        </Alert>
      )}
    </div>
  )
}
