import { useEffect } from 'react'
import { Undo2, X } from 'lucide-react'
import { Button } from './ui/button'
import { useUndoToast } from '../store/useUndoToast'

/** Auto-dismiss window for the undo toast. Long enough to be reachable after
 *  the user notices the deletion, short enough that the next action can take
 *  over without feeling laggy. */
const AUTO_DISMISS_MS = 5000

/** Floating "Deleted N rows · Undo" toast. Renders above `BulkTagBar` (which
 *  lives at `bottom-4`) so it never overlaps. The host is intentionally a
 *  single-slot — see `useUndoToast.ts` for why. */
export function UndoToastHost(): JSX.Element | null {
  const current = useUndoToast((s) => s.current)
  const dismiss = useUndoToast((s) => s.dismiss)

  // Re-arm the auto-dismiss timer every time a new toast replaces the current.
  // Zustand returns a stable object reference until `show()` mints a new one,
  // so depending on `current` directly only re-arms on real toast changes —
  // and satisfies react-hooks/exhaustive-deps without a disable comment.
  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => dismiss(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [current, dismiss])

  if (!current) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-2">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex items-center gap-2 rounded-2xl bg-popover px-3 py-2 text-sm shadow-lg ring-1 ring-border animate-enter"
      >
        <span className="text-popover-foreground">{current.message}</span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => {
            current.undo()
            dismiss()
          }}
          aria-label="Undo"
        >
          <Undo2 />
          <span>Undo</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={dismiss}
          aria-label="Dismiss"
        >
          <X />
        </Button>
      </div>
    </div>
  )
}
