import { describe, expect, it } from 'vitest'
import { pack, safeUnpack, unpack } from './packPersisted'
import type { PersistedState } from '../store/types'
import { INITIAL_STATE } from '../store/types'

function baseState(): PersistedState {
  return {
    ...INITIAL_STATE,
    people: [
      { id: 'p1', name: 'Alice', color: '#ef4444' },
      { id: 'p2', name: 'Bob', color: '#f97316' }
    ],
    transactions: [
      {
        id: 't1',
        date: '2026-04-01',
        description: 'Shell',
        amount: 48,
        tags: ['p1']
      },
      {
        id: 't2',
        date: '2026-04-02',
        description: 'Uber Eats',
        category: 'Food & Drink',
        amount: 32.1,
        tags: ['p1', 'p2'],
        edited: true
      },
      {
        id: 't3',
        date: '2026-04-03',
        description: 'AUTOPAY THANK YOU',
        amount: -1250,
        tags: [],
        excluded: true,
        isPayment: true
      }
    ],
    theme: 'dark',
    tableUI: {
      sort: { key: 'amount', dir: 'desc' },
      visibleCols: { date: true, description: true, amount: true, tags: false }
    }
  }
}

describe('packPersisted', () => {
  it('round-trips a populated state without losing fields', () => {
    const s = baseState()
    const round = unpack(pack(s))
    // Compare structurally — the unpack path reconstructs optional fields
    // from short-keys, so deep-equal is the right check.
    expect(round).toEqual(s)
  })

  it('strips falsy optional booleans on the way to disk', () => {
    const s: PersistedState = {
      ...baseState(),
      transactions: [
        {
          id: 't1',
          date: '2026-04-01',
          description: 'Shell',
          amount: 48,
          tags: [],
          edited: false,
          excluded: false,
          isPayment: false
        }
      ]
    }
    const packed = pack(s)
    const tx = packed.t![0]
    expect(tx.e).toBeUndefined()
    expect(tx.x).toBeUndefined()
    expect(tx.p).toBeUndefined()
    // Empty tags array is also omitted — it's the common shape for untagged rows.
    expect(tx.t).toBeUndefined()
  })

  it('drops a dismissed import banner', () => {
    const s: PersistedState = {
      ...baseState(),
      importBanner: { excludedCount: 3, excludedTotal: -1250, dismissed: true }
    }
    expect(pack(s).b).toBeUndefined()
    expect(unpack(pack(s)).importBanner).toBeUndefined()
  })

  it('keeps an active import banner but always rehydrates dismissed: false', () => {
    const s: PersistedState = {
      ...baseState(),
      importBanner: { excludedCount: 3, excludedTotal: -1250, dismissed: false }
    }
    const packed = pack(s)
    expect(packed.b).toEqual({ c: 3, t: -1250 })
    expect(unpack(packed).importBanner).toEqual({
      excludedCount: 3,
      excludedTotal: -1250,
      dismissed: false
    })
  })

  it('hydrates an empty packed payload to INITIAL_STATE defaults', () => {
    const empty = pack({ ...INITIAL_STATE })
    const round = unpack(empty)
    expect(round.people).toEqual([])
    expect(round.transactions).toEqual([])
    expect(round.columnMapCache).toEqual({})
    expect(round.theme).toBe(INITIAL_STATE.theme)
    expect(round.persistenceEnabled).toBe(true)
  })

  it('packs much smaller than the verbose JSON', () => {
    // Smoke check, not a hard guarantee — but a 3-row state should at least
    // halve in size with short keys + falsy-strip. If this fails the savings
    // are gone and the extra indirection is no longer worth it.
    const s = baseState()
    const verboseSize = JSON.stringify(s).length
    const packedSize = JSON.stringify(pack(s)).length
    expect(packedSize).toBeLessThan(verboseSize * 0.7)
  })
})

describe('safeUnpack (malformed input)', () => {
  it('round-trips a valid packed payload as cleanly as unpack does', () => {
    const s = baseState()
    expect(safeUnpack(pack(s))).toEqual(s)
  })

  it('returns INITIAL_STATE defaults for non-object input', () => {
    expect(safeUnpack(null).persistenceEnabled).toBe(true)
    expect(safeUnpack(undefined).people).toEqual([])
    expect(safeUnpack('garbage').transactions).toEqual([])
    expect(safeUnpack(42).theme).toBe(INITIAL_STATE.theme)
  })

  it('defaults persistenceEnabled to true when pe is missing', () => {
    // The bug-shaped case from the malformed-input analysis: without a `pe`
    // field, the old `unpack` would set persistenceEnabled to undefined and
    // the `!s.persistenceEnabled` check in the subscriber would silently
    // flip off persistence, wiping user data on the next save.
    const packed = pack(baseState()) as unknown as Record<string, unknown>
    delete packed.pe
    expect(safeUnpack(packed).persistenceEnabled).toBe(true)
  })

  it('defaults theme to system when th is invalid', () => {
    const packed = { ...pack(baseState()), th: 'purple' } as unknown
    expect(safeUnpack(packed).theme).toBe('system')
  })

  it('drops individual bad transactions instead of the whole array', () => {
    const packed = pack(baseState()) as unknown as Record<string, unknown>
    // Append a junk row to the transactions array (amount as a string)
    const txs = [...(packed.t as unknown[]), { i: 'bad', d: '2026', s: 'oops', a: 'not-a-number' }]
    const restored = safeUnpack({ ...packed, t: txs })
    // The three good rows survive; the bad row is filtered out.
    expect(restored.transactions).toHaveLength(3)
    expect(restored.transactions.find((t) => t.id === 'bad')).toBeUndefined()
  })

  it('drops bad people without affecting transactions', () => {
    const packed = pack(baseState()) as unknown as Record<string, unknown>
    const people = [...(packed.p as unknown[]), { i: 99, n: 'Bad', c: '#000' }]
    const restored = safeUnpack({ ...packed, p: people })
    expect(restored.people).toHaveLength(2)
    expect(restored.transactions).toHaveLength(3)
  })

  it('falls back to default tableUI when u is malformed', () => {
    const packed = pack(baseState()) as unknown as Record<string, unknown>
    packed.u = { s: { k: 'category', d: 'asc' }, v: 'nope' }
    const restored = safeUnpack(packed)
    expect(restored.tableUI.sort).toEqual(INITIAL_STATE.tableUI.sort)
    expect(restored.tableUI.visibleCols).toEqual(INITIAL_STATE.tableUI.visibleCols)
  })

  it('drops a malformed importBanner without leaking it through', () => {
    const packed = pack(baseState()) as unknown as Record<string, unknown>
    packed.b = { c: 'three', t: null }
    expect(safeUnpack(packed).importBanner).toBeUndefined()
  })

  it('drops bad columnMapCache entries while keeping good ones', () => {
    const packed = pack(baseState()) as unknown as Record<string, unknown>
    packed.mc = {
      good: { d: 'Transaction Date', s: 'Description' },
      bad: { d: 42 } // missing s, d is wrong type
    }
    const restored = safeUnpack(packed)
    expect(Object.keys(restored.columnMapCache)).toEqual(['good'])
  })
})
