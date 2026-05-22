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

  it('keeps every palette pair perceptually distinct', () => {
    // Catches accidental near-duplicates (violet vs purple ~12°, orange vs
    // amber ~10°, emerald vs teal ~14°) by requiring a minimum hue separation
    // between every pair. Tailwind's 500-line hues cluster in the cyan/blue
    // arc (teal 172° → cyan 187° → blue 219° is only 47° for three colours),
    // so 15° is the practical floor — wide enough to reject the twin pairs
    // above, tight enough that we can still fit twelve Tailwind 500 colours.
    const MIN_HUE_DELTA = 15
    for (let i = 0; i < PERSON_PALETTE.length; i++) {
      for (let j = i + 1; j < PERSON_PALETTE.length; j++) {
        const a = hueOf(PERSON_PALETTE[i])
        const b = hueOf(PERSON_PALETTE[j])
        const delta = hueDistance(a, b)
        expect(
          delta,
          `${PERSON_PALETTE[i]} and ${PERSON_PALETTE[j]} are only ${delta.toFixed(1)}° apart`
        ).toBeGreaterThanOrEqual(MIN_HUE_DELTA)
      }
    }
  })
})

function hueOf(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Bad hex: ${hex}`)
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 0xff) / 255
  const g = ((n >> 8) & 0xff) / 255
  const b = (n & 0xff) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const c = max - min
  if (c === 0) return 0
  let h: number
  if (max === r) h = ((g - b) / c) % 6
  else if (max === g) h = (b - r) / c + 2
  else h = (r - g) / c + 4
  h *= 60
  if (h < 0) h += 360
  return h
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}
