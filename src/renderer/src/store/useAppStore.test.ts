import { beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from './useAppStore'
import { INITIAL_STATE, type Transaction } from './types'

/** Build a transaction with sensible defaults so each test only declares the
 *  fields it cares about. */
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: overrides.id ?? `t-${Math.random().toString(36).slice(2, 8)}`,
    date: overrides.date ?? '2026-05-01',
    description: overrides.description ?? 'Sample',
    amount: overrides.amount ?? 10,
    tags: overrides.tags ?? [],
    ...overrides
  }
}

function seed(transactions: Transaction[]): void {
  useAppStore.setState({ ...INITIAL_STATE, transactions, _hydrated: true } as never)
}

beforeEach(() => {
  // Reset before each test — zustand stores are module-singletons, so leaving
  // state behind would let order-of-execution change results.
  useAppStore.setState({ ...INITIAL_STATE, _hydrated: false } as never)
})

describe('deleteTransactionsForSelection + restoreTransactions', () => {
  it('removes the matching rows and returns entries with their original indices', () => {
    const a = tx({ id: 'a', description: 'A' })
    const b = tx({ id: 'b', description: 'B' })
    const c = tx({ id: 'c', description: 'C' })
    seed([a, b, c])

    const entries = useAppStore.getState().deleteTransactionsForSelection(['a', 'c'])

    expect(useAppStore.getState().transactions.map((t) => t.id)).toEqual(['b'])
    expect(entries).toEqual([
      { tx: a, index: 0 },
      { tx: c, index: 2 }
    ])
  })

  it('round-trip restores rows to their original positions', () => {
    const a = tx({ id: 'a' })
    const b = tx({ id: 'b' })
    const c = tx({ id: 'c' })
    const d = tx({ id: 'd' })
    seed([a, b, c, d])

    const entries = useAppStore.getState().deleteTransactionsForSelection(['b', 'd'])
    useAppStore.getState().restoreTransactions(entries)

    expect(useAppStore.getState().transactions.map((t) => t.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('returns an empty array and is a no-op when no ids match', () => {
    seed([tx({ id: 'a' })])
    const entries = useAppStore.getState().deleteTransactionsForSelection(['missing'])
    expect(entries).toEqual([])
    expect(useAppStore.getState().transactions).toHaveLength(1)
  })

  it('clamps the restore index when the array has shrunk in the meantime', () => {
    const a = tx({ id: 'a' })
    const b = tx({ id: 'b' })
    const c = tx({ id: 'c' })
    seed([a, b, c])

    // Delete c (index 2), then also delete a (index 0). Restoring c should
    // clamp to the end of the now-shorter array instead of throwing.
    const cEntries = useAppStore.getState().deleteTransactionsForSelection(['c'])
    useAppStore.getState().deleteTransactionsForSelection(['a'])
    useAppStore.getState().restoreTransactions(cEntries)

    // b was at index 1 originally and stays; c clamps in after it.
    expect(useAppStore.getState().transactions.map((t) => t.id)).toEqual(['b', 'c'])
  })
})

describe('setPaymentForSelection', () => {
  it('marking sets isPayment AND excluded', () => {
    seed([tx({ id: 'a' }), tx({ id: 'b' })])

    useAppStore.getState().setPaymentForSelection(['a'], true)

    const after = useAppStore.getState().transactions
    expect(after[0]).toMatchObject({ id: 'a', isPayment: true, excluded: true })
    // Unrelated rows untouched. (toMatchObject treats a missing key as a
    // mismatch even when the expected value is `undefined`, so check directly.)
    expect(after[1].id).toBe('b')
    expect(after[1].isPayment).toBeUndefined()
    expect(after[1].excluded).toBeFalsy()
  })

  it('unmarking clears isPayment but leaves excluded alone', () => {
    seed([tx({ id: 'a', isPayment: true, excluded: true })])

    useAppStore.getState().setPaymentForSelection(['a'], false)

    const [row] = useAppStore.getState().transactions
    expect(row.isPayment).toBe(false)
    // excluded is intentionally preserved — the user may have a separate reason
    // to keep the row out of totals.
    expect(row.excluded).toBe(true)
  })

  it('handles bulk selection', () => {
    seed([tx({ id: 'a' }), tx({ id: 'b' }), tx({ id: 'c' })])

    useAppStore.getState().setPaymentForSelection(['a', 'c'], true)

    const after = useAppStore.getState().transactions
    expect(after.map((t) => !!t.isPayment)).toEqual([true, false, true])
    expect(after.map((t) => !!t.excluded)).toEqual([true, false, true])
  })
})
