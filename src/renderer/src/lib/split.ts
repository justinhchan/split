import type { Person, PersonId, Transaction } from '../store/types'

export interface SplitResult {
  owed: Record<PersonId, number>
  /** Number of (non-excluded) transactions each person is tagged on. */
  taggedCounts: Record<PersonId, number>
  grand: number
  untagged: number
  untaggedCount: number
  excluded: number
  excludedCount: number
  sum: number
  mismatch: boolean
}

/**
 * Per-person totals with support for excluded rows. Excluded rows skip `grand`,
 * `owed`, and `untagged` but contribute to `excluded` for transparency in the
 * summary panel.
 *
 * Money is tracked in **integer cents** internally so even splits across N
 * people always reconcile to the exact transaction total (no missing penny on
 * $10 ÷ 3). The remainder is distributed by the largest-remainder method: the
 * first |remainder| tags on `tx.tags` each absorb one cent (signed). Tag order
 * is stable, so the same person consistently absorbs the rounding for the same
 * transaction.
 */
export function perPersonTotals(txs: Transaction[], people: Person[]): SplitResult {
  const owedCents: Record<PersonId, number> = Object.fromEntries(people.map((p) => [p.id, 0]))
  const taggedCounts: Record<PersonId, number> = Object.fromEntries(
    people.map((p) => [p.id, 0])
  )
  let grandCents = 0
  let untaggedCents = 0
  let untaggedCount = 0
  let excludedCents = 0
  let excludedCount = 0

  for (const tx of txs) {
    const cents = Math.round(tx.amount * 100)
    if (tx.excluded) {
      excludedCents += cents
      excludedCount += 1
      continue
    }
    grandCents += cents
    if (tx.tags.length === 0) {
      untaggedCents += cents
      untaggedCount += 1
      continue
    }
    const n = tx.tags.length
    // Truncate toward zero so positive and negative amounts split symmetrically:
    // -1000 / 3 → base -333, remainder -1; first tag absorbs the extra -1 cent.
    const baseCents = Math.trunc(cents / n)
    const remainder = cents - baseCents * n
    const sign = remainder === 0 ? 0 : remainder > 0 ? 1 : -1
    const extras = Math.abs(remainder)
    for (let i = 0; i < tx.tags.length; i++) {
      const id = tx.tags[i]
      const share = baseCents + (i < extras ? sign : 0)
      owedCents[id] = (owedCents[id] ?? 0) + share
      taggedCounts[id] = (taggedCounts[id] ?? 0) + 1
    }
  }

  const owed: Record<PersonId, number> = Object.fromEntries(
    Object.entries(owedCents).map(([id, c]) => [id, c / 100])
  )
  const sumCents = Object.values(owedCents).reduce((a, b) => a + b, 0)
  // Exact integer arithmetic — any mismatch would mean a bug in this function
  // rather than floating-point drift, but the tolerance stays at 0.01 so the
  // contract with the summary panel doesn't change.
  const mismatch = Math.abs(sumCents + untaggedCents - grandCents) > 1

  return {
    owed,
    taggedCounts,
    grand: grandCents / 100,
    untagged: untaggedCents / 100,
    untaggedCount,
    excluded: excludedCents / 100,
    excludedCount,
    sum: sumCents / 100,
    mismatch
  }
}
