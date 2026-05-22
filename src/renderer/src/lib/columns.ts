import type { ColumnKey, Person } from '../store/types'
import { formatCurrency } from './format'

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
 * Container width below which the transactions table abandons its tabular
 * layout and renders as a list of stacked cards instead. Inspired by the
 * "list of cards" mobile pattern in Linear, Gmail, and GitHub mobile —
 * Description gets full width as the row's primary identifier, with the date
 * / category / payment hint and tag dots sitting on a muted secondary line.
 *
 * 520 px catches every phone width and small split-screen panes without
 * triggering on tablet portrait (~768 px), where the table still has enough
 * room to be the better surface.
 */
export const MOBILE_CARD_BREAKPOINT_PX = 520

export function isCardLayout(containerWidth: number): boolean {
  // `containerWidth === 0` happens for one frame before the ResizeObserver
  // fires. Default to the table layout so the first paint matches the desktop
  // rendering rather than flashing the card list and then snapping back.
  if (containerWidth === 0) return false
  return containerWidth < MOBILE_CARD_BREAKPOINT_PX
}

/**
 * Compute the Amount column's width from the longest formatted amount in
 * the visible transactions, so $100,000,000.00 fits without truncating but
 * a list of single-dollar splits doesn't reserve 110 px of dead space.
 *
 * The math is a per-char estimate rather than a Canvas measurement: the
 * table uses tabular-nums (every digit + comma + period has equal advance
 * width) and Inter's tabular glyphs at text-sm are ~8.5 px wide. A 16 px
 * buffer covers the "$" sign's slightly wider advance, the sort-arrow icon
 * in the header, and the button's negative-margin breathing room. 88 px is
 * the floor — wide enough to hold the "Amount" header label + sort icon
 * even when every row holds a sub-dollar value.
 */
const AMOUNT_CHAR_PX = 8.5
const AMOUNT_CELL_PADDING_PX = 24 // px-3 both sides
const AMOUNT_HEADER_BUFFER_PX = 16 // sort icon + button x-padding
const AMOUNT_COL_MIN_PX = 88
const AMOUNT_PLACEHOLDER_LEN = 6 // "$0.00" + 1 char of slack

export function computeAmountColWidth(amounts: ReadonlyArray<number>): number {
  let maxLen = AMOUNT_PLACEHOLDER_LEN
  for (const a of amounts) {
    const len = formatCurrency(a).length
    if (len > maxLen) maxLen = len
  }
  const width = Math.ceil(maxLen * AMOUNT_CHAR_PX + AMOUNT_CELL_PADDING_PX + AMOUNT_HEADER_BUFFER_PX)
  return Math.max(AMOUNT_COL_MIN_PX, width)
}

/**
 * Compute the Tags column's width from the longest person name so the cell
 * fits a single chip + the always-present kebab without reserving 240 px
 * for short rosters. Chips inside the cell still wrap when a row has more
 * tags than fit on one line — this only sizes the chip lane wide enough
 * for the widest single chip.
 *
 * Description benefits whenever this returns less than the old fixed 240 px,
 * which is the common case (4-character names → ~144 px column).
 */
const TAG_CHIP_CHAR_PX = 7.5 // body text in a chip at text-xs
const TAG_CHIP_FIXED_PX = 32 // dot (8) + gap (4) + chip padding (16) + ring (4)
const TAG_KEBAB_PX = 40 // absolute-positioned MoreHorizontal button + right-2 offset
const TAG_CELL_PADDING_PX = 24 // px-3 both sides
const TAG_HEADER_BUFFER_PX = 8 // "Tags" header label is short — small safety buffer
const TAG_COL_MIN_PX = 120 // kebab + a stub chip area even when names are 1–2 chars
const TAG_COL_MAX_PX = 240 // cap so a long single name doesn't dominate the row

export function computeTagsColWidth(people: ReadonlyArray<Person>): number {
  let maxNameLen = 0
  for (const p of people) {
    if (p.name.length > maxNameLen) maxNameLen = p.name.length
  }
  const chipPx = maxNameLen * TAG_CHIP_CHAR_PX + TAG_CHIP_FIXED_PX
  const width = Math.ceil(
    chipPx + TAG_KEBAB_PX + TAG_CELL_PADDING_PX + TAG_HEADER_BUFFER_PX
  )
  return Math.min(TAG_COL_MAX_PX, Math.max(TAG_COL_MIN_PX, width))
}

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
