import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { colorForIndex } from '../lib/colors'
import { loadState, saveState } from '../lib/ipc'
import {
  DEFAULT_COL_WIDTHS,
  DEFAULT_VISIBLE_COLS,
  INITIAL_STATE,
  type ColumnKey,
  type ColumnMap,
  type PersistedState,
  type Person,
  type PersonId,
  type SortableKey,
  type Theme,
  type Transaction
} from './types'

interface AppActions {
  // Lifecycle
  hydrate: () => Promise<void>

  // People
  addPerson: (name?: string) => Person
  renamePerson: (id: PersonId, name: string) => void
  setPersonColor: (id: PersonId, color: string) => void
  removePerson: (id: PersonId) => void

  // Transactions
  setTransactions: (txs: Transaction[], columnMap?: ColumnMap) => void
  setImportBanner: (banner: PersistedState['importBanner']) => void
  dismissImportBanner: () => void
  updateTransaction: (id: string, patch: Partial<Transaction>) => void
  setTagsForSelection: (ids: string[], tags: PersonId[]) => void
  /** Adds `personId` to every selected row's tags (no-op for rows that already
   *  have it). Use this for bulk "tag with X" actions instead of a per-row
   *  toggle, which would invert state on mixed selections. */
  addTagToSelection: (ids: string[], personId: PersonId) => void
  /** Removes `personId` from every selected row's tags (no-op for rows that
   *  don't have it). */
  removeTagFromSelection: (ids: string[], personId: PersonId) => void
  clearTagsForSelection: (ids: string[]) => void
  setExcludedForSelection: (ids: string[], excluded: boolean) => void
  /** Sets `isPayment` on every selected row. When `isPayment` is true the
   *  rows are also auto-excluded (matches the CSV import heuristic). When it
   *  flips back to false, `excluded` is intentionally left alone — the user
   *  may have a separate reason to keep the row out of totals. */
  setPaymentForSelection: (ids: string[], isPayment: boolean) => void
  /** Removes the rows from `transactions` and returns the (tx, index) entries
   *  so the caller can offer undo. Indices are captured pre-deletion; pass them
   *  back to `restoreTransactions` to splice the rows back at their original
   *  positions. */
  deleteTransactionsForSelection: (ids: string[]) => Array<{ tx: Transaction; index: number }>
  /** Re-inserts entries returned by `deleteTransactionsForSelection`. Splices
   *  in ascending index order so each restore lines up with the array shape
   *  that existed before the delete. */
  restoreTransactions: (entries: Array<{ tx: Transaction; index: number }>) => void
  clearAllTransactions: () => void
  cacheColumnMap: (signature: string, map: ColumnMap) => void

  // Theme
  setTheme: (theme: Theme) => void

  // Sidebar
  setSidebarOpen: (open: boolean) => void

  // Table UI
  setSort: (key: SortableKey | null) => void
  cycleSort: (key: SortableKey) => void
  setColumnVisible: (key: ColumnKey, visible: boolean) => void
}

type Store = PersistedState & AppActions & { _hydrated: boolean }

/** Debounced sync of the persistent slice to electron-store. */
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave(state: PersistedState): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveState({ version: 1, data: state as unknown as Record<string, unknown> }).catch(() => {})
  }, 300)
}

function pickPersistent(s: Store): PersistedState {
  return {
    people: s.people,
    transactions: s.transactions,
    theme: s.theme,
    columnMap: s.columnMap,
    tableUI: s.tableUI,
    sidebarOpen: s.sidebarOpen,
    columnMapCache: s.columnMapCache,
    importBanner: s.importBanner
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
}

/**
 * Return a person name guaranteed not to collide with anyone in `people`
 * (other than the optional `excludeId`, useful when renaming in place).
 *
 * - If `base` matches the auto-generated "Player N" pattern, we bump N until
 *   it's free — so adding into `[Player 2]` yields `Player 3`, not `Player 2`.
 * - For anything else, we suffix with " (2)", " (3)", … on collision.
 */
function makeUniquePersonName(
  base: string,
  people: Person[],
  options: { excludeId?: PersonId } = {}
): string {
  const { excludeId } = options
  const taken = new Set(people.filter((p) => p.id !== excludeId).map((p) => p.name))
  if (!taken.has(base)) return base

  const playerMatch = /^Player (\d+)$/.exec(base)
  if (playerMatch) {
    let n = parseInt(playerMatch[1], 10) + 1
    while (taken.has(`Player ${n}`)) n++
    return `Player ${n}`
  }

  for (let i = 2; i < 10000; i++) {
    const candidate = `${base} (${i})`
    if (!taken.has(candidate)) return candidate
  }
  return `${base} (${Date.now()})`
}

export const useAppStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,
    _hydrated: false,

    hydrate: async () => {
      try {
        const payload = await loadState()
        const data = (payload.data ?? {}) as Partial<PersistedState>
        // Strip legacy keys before they leak back into the typed state.
        // Category used to be a real column — pre-existing on-disk state can
        // still carry `visibleCols.category` and `sort.key === 'category'`,
        // both of which violate the current ColumnKey/SortableKey unions.
        const storedVisible = (data.tableUI?.visibleCols ?? {}) as Record<string, boolean>
        const visibleCols = {
          date: storedVisible.date ?? DEFAULT_VISIBLE_COLS.date,
          description: storedVisible.description ?? DEFAULT_VISIBLE_COLS.description,
          amount: storedVisible.amount ?? DEFAULT_VISIBLE_COLS.amount,
          tags: storedVisible.tags ?? DEFAULT_VISIBLE_COLS.tags
        }
        const storedSort = data.tableUI?.sort
        const sortKeyValid =
          storedSort?.key === 'date' ||
          storedSort?.key === 'description' ||
          storedSort?.key === 'amount'
        const sort = sortKeyValid
          ? { key: storedSort!.key, dir: storedSort!.dir ?? 'asc' }
          : INITIAL_STATE.tableUI.sort

        set((s) => ({
          ...s,
          ...INITIAL_STATE,
          ...data,
          tableUI: { sort, visibleCols },
          // Mobile drawer should never hydrate open — avoid the "backdrop on load" trap.
          sidebarOpen: false,
          columnMapCache: data.columnMapCache ?? {},
          _hydrated: true
        }))
      } catch {
        set({ _hydrated: true })
      }
    },

    // People --------------------------------------------------------------
    addPerson: (name) => {
      const people = get().people
      const nextIndex = people.length
      const requested = name?.trim() || `Player ${nextIndex + 1}`
      const unique = makeUniquePersonName(requested, people)
      const person: Person = {
        id: uuid(),
        name: unique,
        color: colorForIndex(nextIndex)
      }
      set({ people: [...people, person] })
      return person
    },

    renamePerson: (id, name) => {
      const trimmed = name.trim()
      if (!trimmed) return
      const people = get().people
      // Prevent this rename from creating a duplicate with another person.
      const unique = makeUniquePersonName(trimmed, people, { excludeId: id })
      set({ people: people.map((p) => (p.id === id ? { ...p, name: unique } : p)) })
    },

    setPersonColor: (id, color) => {
      set({ people: get().people.map((p) => (p.id === id ? { ...p, color } : p)) })
    },

    removePerson: (id) => {
      // Strip this person's tag from every transaction.
      set({
        people: get().people.filter((p) => p.id !== id),
        transactions: get().transactions.map((t) =>
          t.tags.includes(id) ? { ...t, tags: t.tags.filter((x) => x !== id) } : t
        )
      })
    },

    // Transactions --------------------------------------------------------
    setTransactions: (txs, columnMap) => {
      set({ transactions: txs, columnMap: columnMap ?? get().columnMap })
    },

    setImportBanner: (banner) => set({ importBanner: banner }),

    dismissImportBanner: () => {
      const b = get().importBanner
      if (b) set({ importBanner: { ...b, dismissed: true } })
    },

    updateTransaction: (id, patch) => {
      set({
        transactions: get().transactions.map((t) =>
          t.id === id ? { ...t, ...patch, edited: patch.amount !== undefined ? true : t.edited } : t
        )
      })
    },

    setTagsForSelection: (ids, tags) => {
      const idSet = new Set(ids)
      const dedupe = Array.from(new Set(tags))
      set({
        transactions: get().transactions.map((t) => (idSet.has(t.id) ? { ...t, tags: dedupe } : t))
      })
    },

    addTagToSelection: (ids, personId) => {
      const idSet = new Set(ids)
      set({
        transactions: get().transactions.map((t) => {
          if (!idSet.has(t.id)) return t
          if (t.tags.includes(personId)) return t
          return { ...t, tags: [...t.tags, personId] }
        })
      })
    },

    removeTagFromSelection: (ids, personId) => {
      const idSet = new Set(ids)
      set({
        transactions: get().transactions.map((t) => {
          if (!idSet.has(t.id)) return t
          if (!t.tags.includes(personId)) return t
          return { ...t, tags: t.tags.filter((x) => x !== personId) }
        })
      })
    },

    clearTagsForSelection: (ids) => {
      const idSet = new Set(ids)
      set({
        transactions: get().transactions.map((t) => (idSet.has(t.id) ? { ...t, tags: [] } : t))
      })
    },

    setExcludedForSelection: (ids, excluded) => {
      const idSet = new Set(ids)
      set({
        transactions: get().transactions.map((t) => (idSet.has(t.id) ? { ...t, excluded } : t))
      })
    },

    setPaymentForSelection: (ids, isPayment) => {
      const idSet = new Set(ids)
      set({
        transactions: get().transactions.map((t) => {
          if (!idSet.has(t.id)) return t
          // Marking flips both flags so the row drops out of totals immediately
          // — matches what the CSV detector does on import. Unmarking only
          // clears `isPayment`; the user keeps any independent exclusion.
          if (isPayment) return { ...t, isPayment: true, excluded: true }
          return { ...t, isPayment: false }
        })
      })
    },

    deleteTransactionsForSelection: (ids) => {
      const idSet = new Set(ids)
      const txs = get().transactions
      const entries: Array<{ tx: Transaction; index: number }> = []
      const next: Transaction[] = []
      for (let i = 0; i < txs.length; i++) {
        const t = txs[i]
        if (idSet.has(t.id)) entries.push({ tx: t, index: i })
        else next.push(t)
      }
      if (entries.length === 0) return entries
      set({ transactions: next })
      return entries
    },

    restoreTransactions: (entries) => {
      if (entries.length === 0) return
      // Ascending so each splice lands at the index recorded pre-deletion.
      // Sorting also de-couples the caller from having to preserve order.
      const sorted = [...entries].sort((a, b) => a.index - b.index)
      const next = [...get().transactions]
      for (const { tx, index } of sorted) {
        // Clamp because the user may have added or imported new rows during
        // the undo window — the array can be longer or shorter than at delete
        // time. Clamping keeps the restore safe even if the original slot is
        // no longer addressable.
        const at = Math.min(Math.max(index, 0), next.length)
        next.splice(at, 0, tx)
      }
      set({ transactions: next })
    },

    clearAllTransactions: () => {
      set({ transactions: [], columnMap: undefined, importBanner: undefined })
    },

    cacheColumnMap: (signature, map) => {
      set({ columnMapCache: { ...get().columnMapCache, [signature]: { ...map, headerSignature: signature } } })
    },

    // Theme ---------------------------------------------------------------
    setTheme: (theme) => set({ theme }),

    // Sidebar -------------------------------------------------------------
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    // Table UI ------------------------------------------------------------
    setSort: (key) => {
      set({ tableUI: { ...get().tableUI, sort: { key, dir: 'asc' } } })
    },

    cycleSort: (key) => {
      const { sort } = get().tableUI
      let next: { key: SortableKey | null; dir: 'asc' | 'desc' }
      if (sort.key !== key) next = { key, dir: 'asc' }
      else if (sort.dir === 'asc') next = { key, dir: 'desc' }
      else next = { key: null, dir: 'asc' }
      set({ tableUI: { ...get().tableUI, sort: next } })
    },

    setColumnVisible: (key, visible) => {
      const current = get().tableUI.visibleCols
      // Lock the last visible column: you can't untick if it's the only one.
      const visibleCount = Object.values({ ...current, [key]: visible }).filter(Boolean).length
      if (visibleCount === 0) return
      set({ tableUI: { ...get().tableUI, visibleCols: { ...current, [key]: visible } } })
    }
  }))
)

// Subscribe to every state change and debounce-save the persistent slice.
// Debouncing in scheduleSave means we don't need to diff here.
useAppStore.subscribe((state) => {
  if (!state._hydrated) return
  scheduleSave(pickPersistent(state))
})

// Helper selector
export function selectPersonById(id: PersonId): (s: Store) => Person | undefined {
  return (s) => s.people.find((p) => p.id === id)
}

export { DEFAULT_COL_WIDTHS }
