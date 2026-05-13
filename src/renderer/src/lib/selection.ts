import type { Person, PersonId, Transaction } from '../store/types'

/**
 * Coverage of a property across a selection of rows.
 *  - `none`    — no selected row has it
 *  - `partial` — some selected rows have it
 *  - `all`     — every selected row has it
 */
export type TriState = 'none' | 'partial' | 'all'

export interface SelectionState {
  /** Per-person tag coverage across the selection. */
  tagStates: Record<PersonId, TriState>
  /** Aggregate of `tagStates`: `all` only when every person covers every row. */
  everyoneState: TriState
  /** True if at least one selected row is not excluded. */
  anyIncluded: boolean
  /** True if at least one selected row is excluded. */
  anyExcluded: boolean
}

const EMPTY: SelectionState = {
  tagStates: {},
  everyoneState: 'none',
  anyIncluded: false,
  anyExcluded: false
}

/**
 * Derive the BulkTagBar's view state from the current selection. Pure so the
 * BulkTagBar can stay thin and so the tri-state edges are unit-testable
 * without mocking the store.
 *
 * Invariants:
 *  - `tagStates[p]` is `all` iff every selected row has `p` in its tags.
 *  - `tagStates[p]` is `none` iff no selected row has `p` in its tags.
 *  - `everyoneState` is `all` iff every person is `all`; `none` iff every
 *    person is `none`; otherwise `partial`. Empty `people` ⇒ `none`.
 *  - `anyIncluded` / `anyExcluded` look at the `excluded` flag on each row.
 */
export function deriveSelectionState(
  selectedIds: ReadonlyArray<string>,
  transactions: ReadonlyArray<Transaction>,
  people: ReadonlyArray<Person>
): SelectionState {
  if (selectedIds.length === 0) return EMPTY

  const wanted = new Set(selectedIds)
  const selected: Transaction[] = []
  for (const t of transactions) {
    if (wanted.has(t.id)) selected.push(t)
  }
  if (selected.length === 0) return EMPTY

  const tagStates: Record<PersonId, TriState> = {}
  for (const p of people) {
    let withTag = 0
    for (const t of selected) {
      if (t.tags.includes(p.id)) withTag += 1
    }
    tagStates[p.id] = withTag === 0 ? 'none' : withTag === selected.length ? 'all' : 'partial'
  }

  let anyIncluded = false
  let anyExcluded = false
  for (const t of selected) {
    if (t.excluded) anyExcluded = true
    else anyIncluded = true
    if (anyIncluded && anyExcluded) break
  }

  const states = Object.values(tagStates)
  const everyoneState: TriState =
    states.length === 0
      ? 'none'
      : states.every((s) => s === 'all')
        ? 'all'
        : states.every((s) => s === 'none')
          ? 'none'
          : 'partial'

  return { tagStates, everyoneState, anyIncluded, anyExcluded }
}
