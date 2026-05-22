import * as v from 'valibot'
import type {
  ColumnMap,
  PersistedState,
  Person,
  TableUIState,
  Theme,
  Transaction
} from '../store/types'
import { DEFAULT_VISIBLE_COLS, INITIAL_STATE } from '../store/types'

/**
 * On-disk shape with short keys + falsy-stripped fields. The verbose
 * PersistedState shape is what the rest of the app reads; this packed shape
 * is only what crosses the IPC boundary to electron-store / localStorage.
 *
 * The savings come from:
 *   - 1-char keys on the hottest objects (Transaction, Person, ColumnMap)
 *   - omitting optional booleans when false (`excluded`, `isPayment`, `edited`)
 *   - omitting empty `tags` arrays
 *   - omitting `sidebarOpen` entirely (re-hydrates to false anyway) and
 *     `importBanner` once dismissed
 *
 * Key tables live below in `PERSON_KEYS`, `TX_KEYS`, etc. Adding a field to
 * any of these types means adding it to the corresponding table; the type
 * system won't catch a missing entry, which is the one fragility worth
 * calling out.
 */

interface PackedPerson {
  i: string // id
  n: string // name
  c: string // color
}

interface PackedTransaction {
  i: string // id
  d: string // date
  s: string // description (s for "string"; d is taken by date)
  a: number // amount
  t?: string[] // tags — omitted when empty
  c?: string // category
  e?: 1 // edited (true) — omitted when false/undefined
  x?: 1 // excluded — omitted when false/undefined
  p?: 1 // isPayment — omitted when false/undefined
}

interface PackedColumnMap {
  d: string // date
  s: string // description
  a?: string // amount
  D?: string // debit (capital D to avoid colliding with date)
  C?: string // credit
  c?: string // category
  h?: string // headerSignature
}

interface PackedSort {
  k: TableUIState['sort']['key']
  d: TableUIState['sort']['dir']
}

interface PackedTableUI {
  s: PackedSort
  v: TableUIState['visibleCols']
}

interface PackedImportBanner {
  c: number // excludedCount
  t: number // excludedTotal
}

export interface PackedPersistedState {
  p?: PackedPerson[] // people
  t?: PackedTransaction[] // transactions
  th: Theme // theme
  m?: PackedColumnMap // columnMap
  u: PackedTableUI // tableUI
  mc?: Record<string, PackedColumnMap> // columnMapCache
  b?: PackedImportBanner // importBanner — dropped when dismissed
  pe: boolean // persistenceEnabled
}

function packPerson(p: Person): PackedPerson {
  return { i: p.id, n: p.name, c: p.color }
}
function unpackPerson(p: PackedPerson): Person {
  return { id: p.i, name: p.n, color: p.c }
}

function packTransaction(t: Transaction): PackedTransaction {
  const out: PackedTransaction = {
    i: t.id,
    d: t.date,
    s: t.description,
    a: t.amount
  }
  if (t.tags.length > 0) out.t = t.tags
  if (t.category !== undefined) out.c = t.category
  if (t.edited) out.e = 1
  if (t.excluded) out.x = 1
  if (t.isPayment) out.p = 1
  return out
}
function unpackTransaction(t: PackedTransaction): Transaction {
  const out: Transaction = {
    id: t.i,
    date: t.d,
    description: t.s,
    amount: t.a,
    tags: t.t ?? []
  }
  if (t.c !== undefined) out.category = t.c
  if (t.e) out.edited = true
  if (t.x) out.excluded = true
  if (t.p) out.isPayment = true
  return out
}

function packColumnMap(m: ColumnMap): PackedColumnMap {
  const out: PackedColumnMap = { d: m.date, s: m.description }
  if (m.amount !== undefined) out.a = m.amount
  if (m.debit !== undefined) out.D = m.debit
  if (m.credit !== undefined) out.C = m.credit
  if (m.category !== undefined) out.c = m.category
  if (m.headerSignature !== undefined) out.h = m.headerSignature
  return out
}
function unpackColumnMap(m: PackedColumnMap): ColumnMap {
  const out: ColumnMap = { date: m.d, description: m.s }
  if (m.a !== undefined) out.amount = m.a
  if (m.D !== undefined) out.debit = m.D
  if (m.C !== undefined) out.credit = m.C
  if (m.c !== undefined) out.category = m.c
  if (m.h !== undefined) out.headerSignature = m.h
  return out
}

export function pack(state: PersistedState): PackedPersistedState {
  const out: PackedPersistedState = {
    th: state.theme,
    u: {
      s: { k: state.tableUI.sort.key, d: state.tableUI.sort.dir },
      v: state.tableUI.visibleCols
    },
    pe: state.persistenceEnabled
  }
  if (state.people.length > 0) out.p = state.people.map(packPerson)
  if (state.transactions.length > 0) out.t = state.transactions.map(packTransaction)
  if (state.columnMap) out.m = packColumnMap(state.columnMap)
  if (Object.keys(state.columnMapCache).length > 0) {
    const mc: Record<string, PackedColumnMap> = {}
    for (const [k, v] of Object.entries(state.columnMapCache)) mc[k] = packColumnMap(v)
    out.mc = mc
  }
  // Banner is purely a UI notice. Once dismissed it contributes no signal —
  // drop it from disk so a re-launch starts clean (matches what hydrate
  // already does for `sidebarOpen`).
  if (state.importBanner && !state.importBanner.dismissed) {
    out.b = {
      c: state.importBanner.excludedCount,
      t: state.importBanner.excludedTotal
    }
  }
  return out
}

export function unpack(packed: PackedPersistedState): PersistedState {
  const out: PersistedState = {
    ...INITIAL_STATE,
    theme: packed.th,
    tableUI: {
      sort: { key: packed.u.s.k, dir: packed.u.s.d },
      visibleCols: packed.u.v
    },
    persistenceEnabled: packed.pe,
    columnMapCache: {}
  }
  if (packed.p) out.people = packed.p.map(unpackPerson)
  if (packed.t) out.transactions = packed.t.map(unpackTransaction)
  if (packed.m) out.columnMap = unpackColumnMap(packed.m)
  if (packed.mc) {
    const cache: Record<string, ColumnMap> = {}
    for (const [k, val] of Object.entries(packed.mc)) cache[k] = unpackColumnMap(val)
    out.columnMapCache = cache
  }
  if (packed.b) {
    out.importBanner = {
      excludedCount: packed.b.c,
      excludedTotal: packed.b.t,
      dismissed: false
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Schema-validated unpack
//
// `unpack` trusts its input; `safeUnpack` doesn't. The schemas below describe
// the on-disk shape and the validator gracefully degrades on malformed data:
//
//   - Bad top-level fields fall back to `INITIAL_STATE` defaults
//     (`persistenceEnabled: true`, `theme: 'system'`, etc.). This is the
//     critical case — a missing `pe` field would otherwise silently flip
//     persistence off on hydrate.
//   - Bad array items get filtered out per-item instead of taking down the
//     whole array. A single transaction with a non-numeric amount stops
//     that row from hydrating without losing the other 499.
//   - Everything else is forgiven where forgiveness is harmless.
//
// Anything that throws inside falls back to a clean INITIAL_STATE clone, so
// the hydrate path always gets a valid PersistedState.

const ThemeValues = ['light', 'dark', 'system'] as const satisfies readonly Theme[]
const SortKeyValues = ['date', 'description', 'amount'] as const

const PackedPersonSchema = v.object({
  i: v.string(),
  n: v.string(),
  c: v.string()
})

const PackedTransactionSchema = v.object({
  i: v.string(),
  d: v.string(),
  s: v.string(),
  a: v.number(),
  t: v.optional(v.array(v.string())),
  c: v.optional(v.string()),
  e: v.optional(v.literal(1)),
  x: v.optional(v.literal(1)),
  p: v.optional(v.literal(1))
})

const PackedColumnMapSchema = v.object({
  d: v.string(),
  s: v.string(),
  a: v.optional(v.string()),
  D: v.optional(v.string()),
  C: v.optional(v.string()),
  c: v.optional(v.string()),
  h: v.optional(v.string())
})

const VisibleColsSchema = v.object({
  date: v.boolean(),
  description: v.boolean(),
  amount: v.boolean(),
  tags: v.boolean()
})

const PackedSortSchema = v.object({
  k: v.nullable(v.picklist(SortKeyValues)),
  d: v.picklist(['asc', 'desc'])
})

const PackedTableUISchema = v.object({
  s: PackedSortSchema,
  v: VisibleColsSchema
})

const PackedImportBannerSchema = v.object({
  c: v.number(),
  t: v.number()
})

/**
 * Validate an unknown payload (typically read from disk / localStorage) and
 * return a fully-populated PersistedState. Invalid fields are replaced with
 * INITIAL_STATE defaults; invalid array items are dropped individually. Never
 * throws — the worst case is "everything is corrupt and you get INITIAL_STATE
 * back", which is exactly the soft-reset semantics PLAN.md asks for.
 */
export function safeUnpack(raw: unknown): PersistedState {
  if (!raw || typeof raw !== 'object') return cloneInitial()
  const blob = raw as Record<string, unknown>

  // Validate each field independently so one bad section doesn't take down
  // the rest. Per-item filtering for the two arrays preserves as much user
  // data as possible.
  const people = filterValid(blob.p, PackedPersonSchema).map(unpackPerson)
  const transactions = filterValid(blob.t, PackedTransactionSchema).map(unpackTransaction)

  const themeResult = v.safeParse(v.picklist(ThemeValues), blob.th)
  const theme: Theme = themeResult.success ? themeResult.output : INITIAL_STATE.theme

  const tableUI = parseTableUI(blob.u)

  const peResult = v.safeParse(v.boolean(), blob.pe)
  const persistenceEnabled = peResult.success ? peResult.output : INITIAL_STATE.persistenceEnabled

  const columnMapResult = v.safeParse(PackedColumnMapSchema, blob.m)
  const columnMap = columnMapResult.success ? unpackColumnMap(columnMapResult.output) : undefined

  const columnMapCache = parseColumnMapCache(blob.mc)

  const bannerResult = v.safeParse(PackedImportBannerSchema, blob.b)
  const importBanner = bannerResult.success
    ? {
        excludedCount: bannerResult.output.c,
        excludedTotal: bannerResult.output.t,
        dismissed: false
      }
    : undefined

  return {
    ...INITIAL_STATE,
    people,
    transactions,
    theme,
    columnMap,
    tableUI,
    columnMapCache,
    importBanner,
    persistenceEnabled
  }
}

function cloneInitial(): PersistedState {
  return {
    ...INITIAL_STATE,
    tableUI: {
      sort: { ...INITIAL_STATE.tableUI.sort },
      visibleCols: { ...INITIAL_STATE.tableUI.visibleCols }
    },
    columnMapCache: {}
  }
}

function filterValid<TSchema extends v.GenericSchema>(
  raw: unknown,
  schema: TSchema
): v.InferOutput<TSchema>[] {
  if (!Array.isArray(raw)) return []
  const out: v.InferOutput<TSchema>[] = []
  for (const item of raw) {
    const r = v.safeParse(schema, item)
    if (r.success) out.push(r.output as v.InferOutput<TSchema>)
  }
  return out
}

function parseTableUI(raw: unknown): TableUIState {
  const r = v.safeParse(PackedTableUISchema, raw)
  if (!r.success) {
    return {
      sort: { ...INITIAL_STATE.tableUI.sort },
      visibleCols: { ...DEFAULT_VISIBLE_COLS }
    }
  }
  return {
    sort: { key: r.output.s.k, dir: r.output.s.d },
    visibleCols: r.output.v
  }
}

function parseColumnMapCache(raw: unknown): Record<string, ColumnMap> {
  if (!raw || typeof raw !== 'object') return {}
  const cache: Record<string, ColumnMap> = {}
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) {
    const r = v.safeParse(PackedColumnMapSchema, val)
    if (r.success) cache[k] = unpackColumnMap(r.output)
  }
  return cache
}
