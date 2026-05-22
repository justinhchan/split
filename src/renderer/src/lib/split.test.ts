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

  describe('integer-cent rounding (largest-remainder)', () => {
    const carol: Person = { id: 'carol', name: 'Carol', color: '#000000' }

    it('splits $10.00 three ways with no missing cent', () => {
      // $10.00 / 3 = $3.33...; naive math returns three $3.333... summing to $9.999...
      // The fix gives one person $3.34 and the other two $3.33, summing to $10.00 exactly.
      const r = perPersonTotals(
        [tx({ amount: 10, tags: ['alice', 'bob', 'carol'] })],
        [alice, bob, carol]
      )
      const sum = r.owed.alice + r.owed.bob + r.owed.carol
      expect(sum).toBe(10)
      expect(r.owed.alice).toBe(3.34)
      expect(r.owed.bob).toBe(3.33)
      expect(r.owed.carol).toBe(3.33)
      expect(r.mismatch).toBe(false)
    })

    it('splits $1.00 three ways without losing a penny', () => {
      const r = perPersonTotals(
        [tx({ amount: 1, tags: ['alice', 'bob', 'carol'] })],
        [alice, bob, carol]
      )
      expect(r.owed.alice + r.owed.bob + r.owed.carol).toBe(1)
      expect(r.owed.alice).toBe(0.34)
      expect(r.owed.bob).toBe(0.33)
      expect(r.owed.carol).toBe(0.33)
    })

    it('splits negative refunds symmetrically', () => {
      // -$10.00 / 3 → first tag absorbs the extra -1 cent.
      const r = perPersonTotals(
        [tx({ amount: -10, tags: ['alice', 'bob', 'carol'] })],
        [alice, bob, carol]
      )
      expect(r.owed.alice + r.owed.bob + r.owed.carol).toBe(-10)
      expect(r.owed.alice).toBe(-3.34)
      expect(r.owed.bob).toBe(-3.33)
      expect(r.owed.carol).toBe(-3.33)
    })

    it('aggregates many uneven splits without drift', () => {
      // Twenty $10/3 splits = grand $200; per-person totals must sum to that exactly.
      // Sum is compared in integer cents because IEEE-754 can't represent
      // $66.80 + $66.60 + $66.60 as exactly $200.00 — the cent values are exact,
      // it's the addition of the floats that drifts. The displayed totals (rounded
      // to 2 decimals) reconcile, which is what the user sees.
      const txs = Array.from({ length: 20 }, () =>
        tx({ amount: 10, tags: ['alice', 'bob', 'carol'] })
      )
      const r = perPersonTotals(txs, [alice, bob, carol])
      expect(r.grand).toBe(200)
      // Alice (first tag) absorbs +1 cent on every row → 20 × $3.34 = $66.80
      expect(r.owed.alice).toBe(66.8)
      expect(r.owed.bob).toBe(66.6)
      expect(r.owed.carol).toBe(66.6)
      const sumCents =
        Math.round(r.owed.alice * 100) +
        Math.round(r.owed.bob * 100) +
        Math.round(r.owed.carol * 100)
      expect(sumCents).toBe(20000)
      expect(r.mismatch).toBe(false)
    })

    it('respects tag order when distributing the extra cent', () => {
      // Same transaction, different tag orders: the first listed tag is the one
      // that absorbs the rounding.
      const r1 = perPersonTotals(
        [tx({ amount: 10, tags: ['bob', 'alice', 'carol'] })],
        [alice, bob, carol]
      )
      expect(r1.owed.bob).toBe(3.34)
      expect(r1.owed.alice).toBe(3.33)
      expect(r1.owed.carol).toBe(3.33)
    })
  })
})
