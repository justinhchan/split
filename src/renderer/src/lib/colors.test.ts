import { describe, expect, it } from 'vitest'
import { PERSON_PALETTE, colorForIndex } from './colors'

describe('colorForIndex', () => {
  it('returns the first colour for index 0', () => {
    expect(colorForIndex(0)).toBe(PERSON_PALETTE[0])
  })

  it('wraps around when the index exceeds the palette length', () => {
    const len = PERSON_PALETTE.length
    expect(colorForIndex(len)).toBe(PERSON_PALETTE[0])
    expect(colorForIndex(len + 3)).toBe(PERSON_PALETTE[3])
    expect(colorForIndex(len * 2 + 5)).toBe(PERSON_PALETTE[5])
  })

  it('handles negative indices by returning the first colour', () => {
    expect(colorForIndex(-1)).toBe(PERSON_PALETTE[0])
    expect(colorForIndex(-100)).toBe(PERSON_PALETTE[0])
  })

  it('returns distinct colours for the first palette slots', () => {
    const seen = new Set<string>()
    for (let i = 0; i < PERSON_PALETTE.length; i++) seen.add(colorForIndex(i))
    expect(seen.size).toBe(PERSON_PALETTE.length)
  })
})
