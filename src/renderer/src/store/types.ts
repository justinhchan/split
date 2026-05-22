export type PersonId = string

export interface Person {
  id: PersonId
  name: string
  color: string
}

export interface Transaction {
  id: string
  date: string // ISO YYYY-MM-DD
  description: string
  category?: string
  amount: number
  tags: PersonId[]
  edited?: boolean
  excluded?: boolean
  isPayment?: boolean
}

/** Columns rendered as actual table columns. `category` is intentionally not
 *  here — it always appears inline under Description as muted text, not as
 *  its own column. */
export type ColumnKey = 'date' | 'description' | 'amount' | 'tags'
export type SortableKey = Exclude<ColumnKey, 'tags'>

export interface TableUIState {
  sort: { key: SortableKey | null; dir: 'asc' | 'desc' }
  visibleCols: Record<ColumnKey, boolean>
}

export type Theme = 'light' | 'dark' | 'system'

export interface ColumnMap {
  date: string
  description: string
  amount?: string // single-amount mode
  debit?: string // debit/credit mode
  credit?: string // debit/credit mode
  category?: string
  headerSignature?: string
}

export interface PersistedState {
  people: Person[]
  transactions: Transaction[]
  theme: Theme
  columnMap?: ColumnMap
  tableUI: TableUIState
  sidebarOpen: boolean
  /** Maps CSV header signature → column mapping to skip the mapper on re-upload. */
  columnMapCache: Record<string, ColumnMap>
  /** Latest import notice, if not yet dismissed. */
  importBanner?: {
    excludedCount: number
    excludedTotal: number
    dismissed: boolean
  }
  /** When false, every save flushes a minimal payload — theme + this flag —
   *  so session data (people, transactions, table UI) never lands on disk.
   *  The flag itself always persists so the user's choice survives a relaunch.
   *  Defaults to true to keep existing on-disk state behaving as before. */
  persistenceEnabled: boolean
}

/** Fixed widths for the colgroup shared by header + body tables. Columns are
 *  no longer user-resizable, but the `table-fixed` layout still needs concrete
 *  widths so header and body stay aligned with each other.
 *
 *  Only Date is static here. Description is the flex column (absorbs
 *  whatever's left); Amount and Tags both size dynamically in
 *  `lib/columns.ts` (`computeAmountColWidth`, `computeTagsColWidth`) so
 *  Description always gets the most horizontal space without those columns
 *  reserving dead width for small values or short rosters.
 */
export const DEFAULT_COL_WIDTHS: Record<'date', number> = {
  date: 80
}

export const DEFAULT_VISIBLE_COLS: Record<ColumnKey, boolean> = {
  date: true,
  description: true,
  amount: true,
  tags: true
}

export const INITIAL_STATE: PersistedState = {
  people: [],
  transactions: [],
  theme: 'system',
  tableUI: {
    sort: { key: null, dir: 'asc' },
    visibleCols: { ...DEFAULT_VISIBLE_COLS }
  },
  sidebarOpen: false,
  columnMapCache: {},
  persistenceEnabled: true
}
