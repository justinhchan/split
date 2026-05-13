import { describe, expect, it } from 'vitest'
import { deriveSelectionState } from './selection'
import type { Person, Transaction } from '../store/types'

const alice: Person = { id: 'alice', name: 'Alice', color: '#3b82f6' }
const bob: Person = { id: 'bob', name: 'Bob', color: '#f97316' }
const carol: Person = { id: 'carol', name: 'Carol', color: '#10b981' }

function tx(partial: Partial<Transaction> & Pick<Transaction, 'id'>): Transaction {
  return {
    id: partial.id,
    date: partial.date ?? '2026-04-01',
    description: partial.description ?? 'test',
    amount: partial.amount ?? 10,
    tags: partial.tags ?? [],
    excluded: partial.excluded,
    isPayment: partial.isPayment
  }
}

describe('deriveSelectionState', () => {
  it('returns empty defaults when nothing is selected', () => {
    const r = deriveSelectionState([], [tx({ id: 'a' })], [alice])
    expect(r.tagStates).toEqual({})
    expect(r.everyoneState).toBe('none')
    expect(r.anyIncluded).toBe(false)
    expect(r.anyExcluded).toBe(false)
  })

  it('returns empty defaults when selectedIds reference no real rows', () => {
    const r = deriveSelectionState(['ghost'], [tx({ id: 'a' })], [alice])
    expect(r.tagStates).toEqual({})
    expect(r.everyoneState).toBe('none')
  })

  it('marks a person as `all` when every selected row carries their tag', () => {
    const txs = [tx({ id: '1', tags: ['alice'] }), tx({ id: '2', tags: ['alice', 'bob'] })]
    const r = deriveSelectionState(['1', '2'], txs, [alice, bob])
    expect(r.tagStates.alice).toBe('all')
    expect(r.tagStates.bob).toBe('partial')
  })

  it('marks a person as `none` when no selected row carries their tag', () => {
    const txs = [tx({ id: '1', tags: ['alice'] }), tx({ id: '2', tags: ['alice'] })]
    const r = deriveSelectionState(['1', '2'], txs, [alice, bob])
    expect(r.tagStates.alice).toBe('all')
    expect(r.tagStates.bob).toBe('none')
  })

  it('everyoneState is `all` only when every person is `all` on every row', () => {
    const txs = [tx({ id: '1', tags: ['alice', 'bob'] }), tx({ id: '2', tags: ['alice', 'bob'] })]
    const r = deriveSelectionState(['1', '2'], txs, [alice, bob])
    expect(r.everyoneState).toBe('all')
  })

  it('everyoneState is `none` only when every person is `none`', () => {
    const txs = [tx({ id: '1', tags: [] }), tx({ id: '2', tags: [] })]
    const r = deriveSelectionState(['1', '2'], txs, [alice, bob])
    expect(r.everyoneState).toBe('none')
  })

  it('everyoneState is `partial` when coverage is mixed across people', () => {
    const txs = [tx({ id: '1', tags: ['alice'] }), tx({ id: '2', tags: ['alice'] })]
    const r = deriveSelectionState(['1', '2'], txs, [alice, bob, carol])
    expect(r.tagStates.alice).toBe('all')
    expect(r.tagStates.bob).toBe('none')
    expect(r.everyoneState).toBe('partial')
  })

  it('everyoneState is `none` when people list is empty', () => {
    const r = deriveSelectionState(['1'], [tx({ id: '1' })], [])
    expect(r.everyoneState).toBe('none')
  })

  it('detects exclusion state across the selection', () => {
    const txs = [tx({ id: '1' }), tx({ id: '2', excluded: true }), tx({ id: '3', excluded: true })]
    expect(deriveSelectionState(['1'], txs, []).anyIncluded).toBe(true)
    expect(deriveSelectionState(['1'], txs, []).anyExcluded).toBe(false)
    expect(deriveSelectionState(['2', '3'], txs, []).anyIncluded).toBe(false)
    expect(deriveSelectionState(['2', '3'], txs, []).anyExcluded).toBe(true)
    const mixed = deriveSelectionState(['1', '2'], txs, [])
    expect(mixed.anyIncluded).toBe(true)
    expect(mixed.anyExcluded).toBe(true)
  })

  it('is order-independent on selectedIds', () => {
    const txs = [tx({ id: '1', tags: ['alice'] }), tx({ id: '2', tags: ['bob'] })]
    const a = deriveSelectionState(['1', '2'], txs, [alice, bob])
    const b = deriveSelectionState(['2', '1'], txs, [alice, bob])
    expect(a).toEqual(b)
  })
})
