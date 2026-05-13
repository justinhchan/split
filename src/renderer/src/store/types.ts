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
}

/** Fixed widths for the colgroup shared by header + body tables. Columns are
 *  no longer user-resizable, but the `table-fixed` layout still needs concrete
 *  widths so header and body stay aligned with each other.
 *
 *  Description has no entry here — it's the flex column that absorbs
 *  remaining horizontal space. The responsive layer in `lib/columns.ts`
 *  guarantees Description never falls below a usable width by auto-shedding
 *  Date first. */
export const DEFAULT_COL_WIDTHS: Record<'date' | 'amount' | 'tags', number> = {
  date: 80,
  amount: 110,
  // Tags is wide enough to comfortably fit 3 short chips on one line; the
  // typical bill-split has 2–4 taggees, so this is the common case. Description
  // remains the flex column and absorbs whatever's left after the fixed columns.
  tags: 240
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
  columnMapCache: {}
}
