import { useCallback, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { cn } from './lib/utils'
import { Button } from './components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from './components/ui/dialog'
import { TooltipProvider } from './components/ui/tooltip'
import { FileUpload } from './components/FileUpload'
import { TransactionsTable } from './components/TransactionsTable'
import { ColumnMapperDialog } from './components/ColumnMapperDialog'
import { SidebarDrawer, SidebarPane } from './components/SidebarDrawer'
import { ThemeToggle } from './components/ThemeToggle'
import { UndoToastHost } from './components/UndoToastHost'
import { useTheme } from './hooks/useTheme'
import { useAppStore } from './store/useAppStore'
import { parseCSV, type DetectedColumns } from './lib/csv'
import type { ColumnMap } from './store/types'

interface MapperState {
  open: boolean
  csvText: string
  headers: string[]
  detected: DetectedColumns | null
}

// Detected once at module load — safe since platform can't change at runtime.
// `window.electron` is populated by @electron-toolkit/preload in the preload
// script; falls back to `false` in non-Electron contexts (e.g. vitest/jsdom).
const IS_MAC = typeof window !== 'undefined' && window.electron?.process?.platform === 'darwin'

function App(): React.JSX.Element {
  // Keep the theme hook alive at the root so toggling cascades immediately.
  useTheme()

  const transactions = useAppStore((s) => s.transactions)
  const setTransactions = useAppStore((s) => s.setTransactions)
  const setImportBanner = useAppStore((s) => s.setImportBanner)
  const cacheColumnMap = useAppStore((s) => s.cacheColumnMap)
  const columnMapCache = useAppStore((s) => s.columnMapCache)
  const clearAllTransactions = useAppStore((s) => s.clearAllTransactions)

  const [mapper, setMapper] = useState<MapperState>({
    open: false,
    csvText: '',
    headers: [],
    detected: null
  })

  const [resetOpen, setResetOpen] = useState(false)

  const ingestCSV = useCallback(
    (text: string): void => {
      // Look at the cache first — if we've mapped this header shape before,
      // re-apply without bothering the user.
      const { transactions, detected, excludedCount, excludedTotal, ambiguous } = parseCSV(text)

      const cached = columnMapCache[detected.signature]
      if (cached) {
        const replay = parseCSV(text, cached)
        setTransactions(replay.transactions, cached)
        setImportBanner(
          replay.excludedCount > 0
            ? {
                excludedCount: replay.excludedCount,
                excludedTotal: replay.excludedTotal,
                dismissed: false
              }
            : undefined
        )
        return
      }

      if (ambiguous) {
        setMapper({
          open: true,
          csvText: text,
          headers: headersFromDetected(detected, text),
          detected
        })
        return
      }

      const map: ColumnMap = {
        date: detected.date,
        description: detected.description,
        amount: detected.amount,
        debit: detected.debit,
        credit: detected.credit,
        category: detected.category,
        headerSignature: detected.signature
      }
      setTransactions(transactions, map)
      cacheColumnMap(detected.signature, map)
      setImportBanner(
        excludedCount > 0 ? { excludedCount, excludedTotal, dismissed: false } : undefined
      )
    },
    [columnMapCache, setTransactions, setImportBanner, cacheColumnMap]
  )

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={150}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Edge-to-edge titlebar with a subtly different shade so it reads as a
          distinct chrome region (Linear/Slack pattern).

          `app-drag` makes the whole header a window drag handle. Interactive
          children opt out automatically via the rule in assets/index.css.
          On macOS we also pad the left edge so the traffic lights (which
          `hiddenInset` floats over our content) don't collide with the
          sidebar button. */}
        <header
          className={cn(
            'app-drag flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-4 py-2',
            // Traffic-light safe zone: ~80px from the window's left edge.
            IS_MAC && 'pl-20'
          )}
        >
          <div className="flex items-center gap-2">
            <SidebarDrawer />
          </div>

          <div className="flex items-center gap-2">
            {transactions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setResetOpen(true)}
                aria-label="Clear all transactions"
              >
                <RotateCcw />
                Clear
              </Button>
            )}

            <FileUpload compact onFile={(text) => ingestCSV(text)} />
            <ThemeToggle />
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-4 p-4 lg:grid-cols-[320px_1fr]">
          {/* Sidebar column — static at lg, drawer-driven below */}
          <SidebarPane />

          {/* Main content column */}
          <main className="flex min-h-0 flex-1 flex-col">
            {transactions.length === 0 ? (
              <FileUpload onFile={(text) => ingestCSV(text)} />
            ) : (
              <TransactionsTable />
            )}
          </main>
        </div>

        <ColumnMapperDialog
          open={mapper.open}
          onOpenChange={(o) => setMapper((prev) => ({ ...prev, open: o }))}
          csvText={mapper.csvText}
          headers={mapper.headers}
          initialDetected={mapper.detected}
          onConfirm={(txs, map, excluded) => {
            setTransactions(txs, map)
            cacheColumnMap(map.headerSignature ?? computeSignatureFromHeaders(mapper.headers), map)
            setImportBanner(
              excluded.count > 0
                ? { excludedCount: excluded.count, excludedTotal: excluded.total, dismissed: false }
                : undefined
            )
          }}
        />

        {/* Single-slot undo toast (currently only delete uses it). Sits above
            BulkTagBar at bottom-20 so the two never overlap. */}
        <UndoToastHost />

        {/* Reset confirmation. People are preserved (they're often reused
          across imports); only transactions, column map, and the import
          banner get cleared. */}
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Clear all transactions?</DialogTitle>
              <DialogDescription>
                This clears all transactions and tags, but keeps the people you&apos;ve added. This
                can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  clearAllTransactions()
                  setResetOpen(false)
                }}
              >
                Clear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

/** Pull the header list from the original parse. We don't expose the papa meta
 *  to the caller directly — the detector preserves it inside the signature, but
 *  we need the raw names for the mapper's dropdowns. A re-parse is cheap for a
 *  one-off dialog opening. */
function headersFromDetected(_detected: DetectedColumns, csvText: string): string[] {
  // Quick header extraction: read the first non-empty line and split on commas
  // respecting basic quoting. For robust cases we could re-run papa, but the
  // header row is simple enough to do by hand and avoids a second full parse.
  const firstLine = csvText.split(/\r?\n/).find((l) => l.trim().length > 0) ?? ''
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i]
    if (ch === '"') {
      if (quoted && firstLine[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur.trim())
  return out.filter(Boolean)
}

function computeSignatureFromHeaders(headers: string[]): string {
  return headers
    .map((h) => h.trim().toLowerCase())
    .sort()
    .join('|')
}

export default App
