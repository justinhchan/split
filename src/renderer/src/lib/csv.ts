import Papa from 'papaparse'
import type { ColumnMap, Transaction } from '../store/types'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type Mode = 'single' | 'debit-credit'

export interface DetectedColumns {
  mode: Mode
  date: string
  description: string
  category?: string
  /** single mode */ amount?: string
  /** debit-credit mode */ debit?: string
  credit?: string
  /** True when most values in the single-amount column are negative. */
  flipSign: boolean
  /** Header fingerprint so re-uploads can skip the mapper dialog. */
  signature: string
}

export interface ParseResult {
  transactions: Transaction[]
  detected: DetectedColumns
  excludedCount: number
  excludedTotal: number
  ambiguous: boolean
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** Parse CSV text and emit transactions with payment-row heuristic applied. */
export function parseCSV(text: string, hint?: ColumnMap): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim()
  })

  const rows = parsed.data.filter((r) => r && Object.values(r).some((v) => v != null && String(v).trim() !== ''))
  const headers = parsed.meta.fields ?? Object.keys(rows[0] ?? {})

  const detected = hint ? applyHint(hint, rows, headers) : detectColumns(rows, headers)

  const transactions: Transaction[] = []
  for (const row of rows) {
    const tx = rowToTransaction(row, detected)
    if (tx) transactions.push(tx)
  }

  // Apply payment heuristic — decide per-row whether to mark excluded.
  applyPaymentHeuristic(transactions, detected.mode)

  let excludedCount = 0
  let excludedTotal = 0
  for (const t of transactions) {
    if (t.excluded) {
      excludedCount += 1
      excludedTotal += t.amount
    }
  }

  return {
    transactions,
    detected,
    excludedCount,
    excludedTotal,
    ambiguous: isAmbiguous(detected, rows, headers)
  }
}

// -----------------------------------------------------------------------------
// Column detection
// -----------------------------------------------------------------------------

const DATE_HINTS = /(transaction|posted?)\s*date|^date$/i
const DESC_HINTS = /description|merchant|memo|name|payee/i
const AMOUNT_HINTS = /^amount$|net|value/i
const DEBIT_HINTS = /debit|charge|withdrawal/i
const CREDIT_HINTS = /credit|payment|deposit/i
const CATEGORY_HINTS = /category|type/i

export function detectColumns(
  rows: Record<string, string>[],
  headers: string[]
): DetectedColumns {
  const stats = headers.map((h) => scoreColumn(h, rows.map((r) => (r[h] ?? '').trim())))

  const signature = computeSignature(headers)

  // Find date and description first — those are the same regardless of mode.
  const date = pickBest(
    stats.filter((s) => s.dateFill > 0.5),
    (s) => s.dateFill * 2 + s.hintBonus.date
  )?.name ?? pickBest(stats, (s) => s.dateFill + s.hintBonus.date)?.name ?? headers[0]

  const descCandidate = pickBest(
    stats.filter((s) => s.name !== date),
    (s) => s.avgLen / 20 + s.hintBonus.desc - s.numericFill
  )
  const description = descCandidate?.name ?? headers.find((h) => h !== date) ?? headers[1] ?? ''

  // Detect debit/credit mode — either by header names or by two numeric columns
  // whose non-empty rows don't overlap.
  const debitByName = stats.find((s) => s.hintBonus.debit > 0)
  const creditByName = stats.find((s) => s.hintBonus.credit > 0)
  let mode: Mode = 'single'
  let debit: string | undefined
  let credit: string | undefined
  let amount: string | undefined

  if (debitByName && creditByName && debitByName.name !== creditByName.name) {
    mode = 'debit-credit'
    debit = debitByName.name
    credit = creditByName.name
  } else {
    const numericCols = stats
      .filter((s) => s.numericFill > 0.5 && s.name !== date)
      .sort((a, b) => b.numericFill - a.numericFill)
    if (numericCols.length >= 2) {
      const [a, b] = numericCols
      const overlap = countOverlap(rows, a.name, b.name)
      if (overlap === 0 && Math.min(a.nonEmpty, b.nonEmpty) >= 1) {
        // Which is debit vs credit? Debit almost always has more rows.
        mode = 'debit-credit'
        if (a.nonEmpty >= b.nonEmpty) {
          debit = a.name
          credit = b.name
        } else {
          debit = b.name
          credit = a.name
        }
      }
    }
  }

  if (mode === 'single') {
    const amountCandidate = pickBest(
      stats.filter((s) => s.numericFill > 0.5 && s.name !== date),
      (s) => s.numericFill * 2 + s.hintBonus.amount
    )
    amount = amountCandidate?.name ?? headers.find((h) => h !== date && h !== description)
  }

  // Category column — optional but handy.
  const category = stats.find((s) => s.hintBonus.category > 0 && s.name !== date)?.name

  // Flip-sign: in single-amount mode, if the majority of non-empty values are
  // negative (charges negative, payments positive), auto-flip for display.
  let flipSign = false
  if (mode === 'single' && amount) {
    let neg = 0
    let pos = 0
    for (const r of rows) {
      const v = parseAmount(r[amount] ?? '')
      if (v == null) continue
      if (v < 0) neg++
      else if (v > 0) pos++
    }
    if (neg > pos * 1.5) flipSign = true
  }

  return {
    mode,
    date,
    description,
    category,
    amount,
    debit,
    credit,
    flipSign,
    signature
  }
}

function applyHint(
  hint: ColumnMap,
  rows: Record<string, string>[],
  headers: string[]
): DetectedColumns {
  const mode: Mode = hint.debit && hint.credit ? 'debit-credit' : 'single'
  const signature = computeSignature(headers)
  // Recompute flip-sign for single-amount mode; carry over the rest from hint.
  let flipSign = false
  if (mode === 'single' && hint.amount) {
    let neg = 0
    let pos = 0
    for (const r of rows) {
      const v = parseAmount(r[hint.amount] ?? '')
      if (v == null) continue
      if (v < 0) neg++
      else if (v > 0) pos++
    }
    if (neg > pos * 1.5) flipSign = true
  }
  return {
    mode,
    date: hint.date,
    description: hint.description,
    category: hint.category,
    amount: hint.amount,
    debit: hint.debit,
    credit: hint.credit,
    flipSign,
    signature
  }
}

function isAmbiguous(detected: DetectedColumns, rows: Record<string, string>[], headers: string[]): boolean {
  if (!detected.date || !detected.description) return true
  if (detected.mode === 'single' && !detected.amount) return true
  if (detected.mode === 'debit-credit' && (!detected.debit || !detected.credit)) return true
  // Sanity — at least 1 row produced a valid amount.
  let valid = 0
  for (const r of rows.slice(0, 5)) {
    if (rowToTransaction(r, detected)) valid++
  }
  if (valid === 0) return true
  if (headers.length === 0) return true
  return false
}

interface ColStats {
  name: string
  nonEmpty: number
  numericFill: number
  dateFill: number
  avgLen: number
  hintBonus: { date: number; desc: number; amount: number; debit: number; credit: number; category: number }
}

function scoreColumn(name: string, values: string[]): ColStats {
  let nonEmpty = 0
  let numeric = 0
  let dateLike = 0
  let totalLen = 0
  for (const v of values) {
    if (v === '') continue
    nonEmpty++
    totalLen += v.length
    if (parseAmount(v) != null) numeric++
    if (parseDate(v) != null) dateLike++
  }
  const denom = Math.max(1, nonEmpty)
  return {
    name,
    nonEmpty,
    numericFill: numeric / denom,
    dateFill: dateLike / denom,
    avgLen: totalLen / denom,
    hintBonus: {
      date: DATE_HINTS.test(name) ? 1 : 0,
      desc: DESC_HINTS.test(name) ? 1 : 0,
      amount: AMOUNT_HINTS.test(name) ? 1 : 0,
      debit: DEBIT_HINTS.test(name) ? 1 : 0,
      credit: CREDIT_HINTS.test(name) ? 1 : 0,
      category: CATEGORY_HINTS.test(name) ? 1 : 0
    }
  }
}

function pickBest<T>(items: T[], score: (item: T) => number): T | undefined {
  if (items.length === 0) return undefined
  let best = items[0]
  let bestScore = score(best)
  for (const item of items.slice(1)) {
    const s = score(item)
    if (s > bestScore) {
      best = item
      bestScore = s
    }
  }
  return best
}

function countOverlap(rows: Record<string, string>[], a: string, b: string): number {
  let overlap = 0
  for (const r of rows) {
    if ((r[a] ?? '').trim() !== '' && (r[b] ?? '').trim() !== '') overlap++
  }
  return overlap
}

function computeSignature(headers: string[]): string {
  return headers.map((h) => h.trim().toLowerCase()).sort().join('|')
}

// -----------------------------------------------------------------------------
// Row → transaction
// -----------------------------------------------------------------------------

function rowToTransaction(
  row: Record<string, string>,
  d: DetectedColumns
): Transaction | null {
  const date = parseDate((row[d.date] ?? '').trim())
  if (!date) return null

  const description = (row[d.description] ?? '').trim()
  if (!description) return null

  let amount: number | null = null
  if (d.mode === 'debit-credit' && d.debit && d.credit) {
    const db = parseAmount(row[d.debit] ?? '')
    const cr = parseAmount(row[d.credit] ?? '')
    amount = (db ?? 0) - (cr ?? 0)
    if (db == null && cr == null) return null
  } else if (d.amount) {
    const v = parseAmount(row[d.amount] ?? '')
    if (v == null) return null
    amount = d.flipSign ? -v : v
  }
  if (amount == null) return null

  const category = d.category ? (row[d.category] ?? '').trim() || undefined : undefined

  return {
    id: uuid(),
    date,
    description,
    category,
    amount: roundCents(amount),
    tags: []
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'id-' + Math.random().toString(36).slice(2, 10) + '-' + Date.now().toString(36)
}

function roundCents(n: number): number {
  return Math.round(n * 100) / 100
}

// -----------------------------------------------------------------------------
// Parsers
// -----------------------------------------------------------------------------

export function parseAmount(raw: string): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  // Handle parens → negative, currency symbols, commas.
  const parenNeg = /^\((.+)\)$/.exec(s)
  const body = (parenNeg ? parenNeg[1] : s).replace(/[$£€,\s]/g, '').replace(/[+−]/g, (m) => (m === '−' ? '-' : ''))
  if (!/^[-+]?\d*(\.\d+)?$/.test(body) || body === '' || body === '-' || body === '+') return null
  const v = parseFloat(body)
  if (!Number.isFinite(v)) return null
  return parenNeg ? -Math.abs(v) : v
}

export function parseDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // YYYY-MM-DD
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(s)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }
  // MM/DD/YYYY or M/D/YYYY
  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (usMatch) {
    const m = usMatch[1].padStart(2, '0')
    const d = usMatch[2].padStart(2, '0')
    return `${usMatch[3]}-${m}-${d}`
  }
  // Fallback: Date.parse.
  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  const dt = new Date(t)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

// -----------------------------------------------------------------------------
// Payment heuristic
// -----------------------------------------------------------------------------

const PAYMENT_DESC_RE = /payment|pymt|autopay|thank\s*you|balance transfer/i
const PAYMENT_CATEGORY_RE = /^payment(\/|\s|$)/i
const PAYMENT_MAGNITUDE_THRESHOLD = 200

export function applyPaymentHeuristic(txs: Transaction[], mode: Mode): void {
  if (txs.length === 0) return

  // Determine "majority sign" — for single-amount mode. Skip for debit-credit
  // since sign tracking there is less meaningful (debit column is always +).
  let majoritySign: 1 | -1 | 0 = 0
  if (mode === 'single') {
    let neg = 0
    let pos = 0
    for (const t of txs) {
      if (t.amount < 0) neg++
      else if (t.amount > 0) pos++
    }
    if (neg > pos * 2) majoritySign = -1
    else if (pos > neg * 2) majoritySign = 1
  }

  for (const t of txs) {
    const categoryIsPayment = t.category ? PAYMENT_CATEGORY_RE.test(t.category) : false
    const descIsPayment = PAYMENT_DESC_RE.test(t.description)
    const signFlip =
      majoritySign !== 0 &&
      Math.sign(t.amount) !== 0 &&
      Math.sign(t.amount) !== majoritySign &&
      Math.abs(t.amount) >= PAYMENT_MAGNITUDE_THRESHOLD

    // For debit-credit mode, credits (positive post-subtraction reversal) that
    // look like payments are the target. Since we computed amount = debit - credit,
    // credit rows come out as negative numbers.
    const debitCreditPayment =
      mode === 'debit-credit' &&
      t.amount < 0 &&
      Math.abs(t.amount) >= PAYMENT_MAGNITUDE_THRESHOLD &&
      (categoryIsPayment || descIsPayment)

    const isPayment = categoryIsPayment || descIsPayment || signFlip || debitCreditPayment

    if (isPayment) {
      t.isPayment = true
      t.excluded = true
    }
  }
}
