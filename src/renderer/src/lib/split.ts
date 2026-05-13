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
 */
export function perPersonTotals(txs: Transaction[], people: Person[]): SplitResult {
  const owed: Record<PersonId, number> = Object.fromEntries(people.map((p) => [p.id, 0]))
  const taggedCounts: Record<PersonId, number> = Object.fromEntries(
    people.map((p) => [p.id, 0])
  )
  let grand = 0
  let untagged = 0
  let untaggedCount = 0
  let excluded = 0
  let excludedCount = 0

  for (const tx of txs) {
    if (tx.excluded) {
      excluded += tx.amount
      excludedCount += 1
      continue
    }
    grand += tx.amount
    if (tx.tags.length === 0) {
      untagged += tx.amount
      untaggedCount += 1
      continue
    }
    const share = tx.amount / tx.tags.length
    for (const id of tx.tags) {
      owed[id] = (owed[id] ?? 0) + share
      taggedCounts[id] = (taggedCounts[id] ?? 0) + 1
    }
  }

  const sum = Object.values(owed).reduce((a, b) => a + b, 0)
  const mismatch = Math.abs(sum + untagged - grand) > 0.01

  return {
    owed,
    taggedCounts,
    grand,
    untagged,
    untaggedCount,
    excluded,
    excludedCount,
    sum,
    mismatch
  }
}
