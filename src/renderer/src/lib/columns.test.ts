import { describe, expect, it } from 'vitest'
import {
  COLUMN_AUTO_SHED_THRESHOLDS,
  computeAutoVisibleCols,
  computeEffectiveVisibleCols
} from './columns'

const allVisible = {
  date: true,
  description: true,
  amount: true,
  tags: true
}

describe('computeAutoVisibleCols', () => {
  it('keeps every column visible well above the Date threshold', () => {
    expect(computeAutoVisibleCols(1200)).toEqual(allVisible)
  })

  it('auto-hides Date below the Date threshold', () => {
    const v = computeAutoVisibleCols(COLUMN_AUTO_SHED_THRESHOLDS.date - 1)
    expect(v.date).toBe(false)
  })

  it('never auto-hides Description, Amount, or Tags', () => {
    const v = computeAutoVisibleCols(0)
    expect(v.description).toBe(true)
    expect(v.amount).toBe(true)
    expect(v.tags).toBe(true)
  })

  it('switches Date on exactly at the Date threshold', () => {
    expect(computeAutoVisibleCols(COLUMN_AUTO_SHED_THRESHOLDS.date).date).toBe(true)
  })
})

describe('computeEffectiveVisibleCols', () => {
  it('intersects user preference with the responsive layer', () => {
    expect(
      computeEffectiveVisibleCols(
        { ...allVisible, amount: false },
        { ...allVisible, date: false }
      )
    ).toEqual({
      date: false,
      description: true,
      amount: false,
      tags: true
    })
  })

  it('respects a user hide even when auto would show', () => {
    const effective = computeEffectiveVisibleCols({ ...allVisible, amount: false }, allVisible)
    expect(effective.amount).toBe(false)
  })

  it('respects auto-hide even when the user wants the column on', () => {
    const effective = computeEffectiveVisibleCols(allVisible, { ...allVisible, date: false })
    expect(effective.date).toBe(false)
  })
})
