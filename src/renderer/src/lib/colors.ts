/**
 * Deterministic person chip palette. Each entry maps to a person-index — chips
 * use the colour for their ring + text, with a transparent background so they
 * read well on both `--card` and `--accent`. Values target "mid-saturation,
 * mid-lightness" so they pop on both light and dark surfaces.
 *
 * Twelve hues spread across the colour wheel. We deliberately avoid the
 * near-duplicates that the previous palette held (violet+purple ~12° apart,
 * orange+amber ~10°, emerald+teal ~14°) — every pair here sits at least ~15°
 * apart, far enough that neighbouring person-indices never look like the
 * same chip. The hue-spacing invariant is enforced by `colors.test.ts`.
 */
export const PERSON_PALETTE = [
  '#ef4444', // red-500     (~0°)
  '#f97316', // orange-500  (~24°)
  '#eab308', // yellow-500  (~50°)
  '#84cc16', // lime-500    (~84°)
  '#22c55e', // green-500   (~142°)
  '#14b8a6', // teal-500    (~172°)
  '#06b6d4', // cyan-500    (~187°)
  '#3b82f6', // blue-500    (~219°)
  '#6366f1', // indigo-500  (~239°)
  '#8b5cf6', // violet-500  (~262°)
  '#d946ef', // fuchsia-500 (~292°)
  '#ec4899' // pink-500    (~329°)
] as const

export function colorForIndex(index: number): string {
  if (index < 0) return PERSON_PALETTE[0]
  return PERSON_PALETTE[index % PERSON_PALETTE.length]
}
