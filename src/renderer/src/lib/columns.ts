import type { ColumnKey } from '../store/types'

/**
 * Container-width thresholds (in px) at which each auto-shed column becomes
 * eligible to be visible. Below the threshold, the column is hidden by the
 * responsive layer regardless of the user's stored preference; its data
 * inlines into the Description cell as a muted secondary line.
 *
 * With Category permanently inlined (not a column), Date is the only
 * auto-sheddable column. The threshold is tuned for `minWidth: 640` (see
 * `src/main/index.ts`) and the current Tags width of 240 px:
 *   - ≥ 780 px container: every column visible.
 *   - < 780 px:           Date auto-hidden (data inlines).
 *
 * Description, Amount, and Tags are never auto-shed — they're either always
 * visible or hidden explicitly via the Columns menu.
 */
export const COLUMN_AUTO_SHED_THRESHOLDS = {
  date: 780
} as const

/**
 * Which columns the responsive layer wants visible at this container width.
 * The map covers every column for ergonomics — values for description,
 * amount, and tags are always `true`. */
export function computeAutoVisibleCols(containerWidth: number): Record<ColumnKey, boolean> {
  return {
    date: containerWidth >= COLUMN_AUTO_SHED_THRESHOLDS.date,
    description: true,
    amount: true,
    tags: true
  }
}

/**
 * Effective visibility = user preference AND the responsive layer's say-so.
 *
 * The intersection is intentional: the user's manual hide via the Columns
 * menu always wins, and the responsive layer can only narrow the visible set
 * further from there — it never resurrects a column the user has chosen to
 * hide. This mirrors how macOS Finder behaves when columns no longer fit.
 */
export function computeEffectiveVisibleCols(
  user: Record<ColumnKey, boolean>,
  auto: Record<ColumnKey, boolean>
): Record<ColumnKey, boolean> {
  return {
    date: user.date && auto.date,
    description: user.description && auto.description,
    amount: user.amount && auto.amount,
    tags: user.tags && auto.tags
  }
}
