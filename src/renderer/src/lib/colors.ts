/**
 * Deterministic person chip palette. Each entry maps to a person-index — chips
 * use the colour for their ring + text, with a transparent background so they
 * read well on both `--card` and `--accent`. Values target "mid-saturation,
 * mid-lightness" so they pop on both light and dark surfaces.
 */
export const PERSON_PALETTE = [
  '#3b82f6', // blue-500
  '#f97316', // orange-500
  '#10b981', // emerald-500
  '#ec4899', // pink-500
  '#8b5cf6', // violet-500
  '#eab308', // yellow-500
  '#06b6d4', // cyan-500
  '#ef4444', // red-500
  '#14b8a6', // teal-500
  '#f59e0b', // amber-500
  '#84cc16', // lime-500
  '#a855f7' // purple-500
] as const

export function colorForIndex(index: number): string {
  if (index < 0) return PERSON_PALETTE[0]
  return PERSON_PALETTE[index % PERSON_PALETTE.length]
}
