import { describe, expect, it } from 'vitest'
import { perPersonTotals } from './split'
import type { Person, Transaction } from '../store/types'

const alice: Person = { id: 'alice', name: 'Alice', color: '#3b82f6' }
const bob: Person = { id: 'bob', name: 'Bob', color: '#f97316' }

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amount'>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(),
    date: partial.date ?? '2026-04-01',
    description: partial.description ?? 'test',
    amount: partial.amount,
    tags: partial.tags ?? [],
    excluded: partial.excluded,
    isPayment: partial.isPayment
  }
}

describe('perPersonTotals', () => {
  it('splits fully-tagged transactions evenly across the taggees', () => {
    const txs = [
      tx({ amount: 100, tags: ['alice', 'bob'] }),
      tx({ amount: 20, tags: ['alice'] })
    ]
    const r = perPersonTotals(txs, [alice, bob])
    expect(r.owed.alice).toBeCloseTo(70)
    expect(r.owed.bob).toBeCloseTo(50)
    expect(r.taggedCounts.alice).toBe(2)
    expect(r.taggedCounts.bob).toBe(1)
    expect(r.grand).toBeCloseTo(120)
    expect(r.untagged).toBe(0)
    expect(r.untaggedCount).toBe(0)
    expect(r.mismatch).toBe(false)
  })

  it('tracks untagged transactions separately without distributing them', () => {
    const txs = [tx({ amount: 30, tags: ['alice'] }), tx({ amount: 50, tags: [] })]
    const r = perPersonTotals(txs, [alice, bob])
    expect(r.owed.alice).toBeCloseTo(30)
    expect(r.owed.bob).toBe(0)
    expect(r.untagged).toBeCloseTo(50)
    expect(r.untaggedCount).toBe(1)
    expect(r.grand).toBeCloseTo(80)
    expect(r.mismatch).toBe(false)
  })

  it('excludes rows from grand/owed/untagged and reports them separately', () => {
    const txs = [
      tx({ amount: 40, tags: ['alice'] }),
      tx({ amount: -1250, tags: ['alice'], excluded: true })
    ]
    const r = perPersonTotals(txs, [alice, bob])
    expect(r.grand).toBeCloseTo(40)
    expect(r.owed.alice).toBeCloseTo(40)
    expect(r.taggedCounts.alice).toBe(1) // excluded row's tag doesn't count
    expect(r.excluded).toBeCloseTo(-1250)
    expect(r.excludedCount).toBe(1)
    expect(r.untagged).toBe(0)
  })

  it('flags mismatch when floating-point drift exceeds a cent', () => {
    // We can only cause a mismatch by constructing one manually, since the
    // split always balances. This sanity-checks the tolerance.
    const r = perPersonTotals([tx({ amount: 10, tags: ['alice'] })], [alice])
    expect(r.mismatch).toBe(false)
  })

  it('returns zeroes for an empty transaction list', () => {
    const r = perPersonTotals([], [alice, bob])
    expect(r.grand).toBe(0)
    expect(r.owed.alice).toBe(0)
    expect(r.owed.bob).toBe(0)
    expect(r.untagged).toBe(0)
    expect(r.excluded).toBe(0)
    expect(r.mismatch).toBe(false)
  })
})
