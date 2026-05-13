import { Info, X } from 'lucide-react'
import { Button } from './ui/button'
import { Alert } from './ui/alert'
import { useAppStore } from '../store/useAppStore'
import { formatCurrencyAbs } from '../lib/format'

export function ImportBanner(): JSX.Element | null {
  const banner = useAppStore((s) => s.importBanner)
  const dismiss = useAppStore((s) => s.dismissImportBanner)
  const transactions = useAppStore((s) => s.transactions)
  const setExcluded = useAppStore((s) => s.setExcludedForSelection)

  if (!banner || banner.dismissed || banner.excludedCount === 0) return null

  const includeAll = (): void => {
    const ids = transactions.filter((t) => t.excluded && t.isPayment).map((t) => t.id)
    setExcluded(ids, false)
    dismiss()
  }

  const label = banner.excludedCount === 1 ? '1 payment row' : `${banner.excludedCount} payment rows`

  return (
    // Use Alert for the visual shell (bg, border, padding, radius) but
    // override the grid with flex so the action buttons stay visually
    // separate from the text rather than sitting in an adjacent grid cell.
    <Alert className="flex items-start gap-3 animate-enter">
      <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <p className="flex-1 leading-snug text-pretty">
        Excluded{' '}
        <strong className="font-semibold">{label}</strong>{' '}
        (<span className="tabular-nums">{formatCurrencyAbs(banner.excludedTotal)}</span>) so they
        don't inflate the totals.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="outline" size="xs" onClick={includeAll}>
          Include
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dismiss"
          className="h-7 w-7"
        >
          <X />
        </Button>
      </div>
    </Alert>
  )
}
