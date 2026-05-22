import { create } from 'zustand'

/** Single ephemeral "undo" toast slot. Not persisted — purely UI state. A
 *  single slot is intentional: stacking toasts adds visual noise and makes
 *  "Undo" ambiguous when actions queue up. New shows replace the current.
 *
 *  The component (`UndoToastHost`) handles the auto-dismiss timer and click
 *  handlers; the store just holds the message + undo callback. */
export interface UndoToast {
  /** Monotonic id used by the host to (a) key React renders and (b) detect
   *  when a new toast replaced the current one mid-timer. */
  id: number
  message: string
  /** Called when the user clicks the "Undo" affordance. The host dismisses
   *  the toast immediately after. Optional — feedback-only toasts (e.g.
   *  "Tagged with Player 2") pass undefined and the Undo button is hidden. */
  undo?: () => void
}

interface UndoToastState {
  current: UndoToast | null
  show: (message: string, undo?: () => void) => void
  dismiss: () => void
}

let nextId = 1

export const useUndoToast = create<UndoToastState>((set) => ({
  current: null,
  show: (message, undo) => {
    set({ current: { id: nextId++, message, undo } })
  },
  dismiss: () => set({ current: null })
}))
