/**
 * Presentation helpers for the preference hierarchy.
 *
 * `StimulusRanking.rank` is standard competition ranking (1, 2, 2, 4), so a
 * tie shows up as a repeated rank *and* a gap in the sequence. Both render
 * sites showed the bare number, which reads as a bug to a learner who has
 * just been taught that a hierarchy orders items from most to least chosen.
 *
 * These read `rank` as it already appears on the snapshot; they do not
 * recompute selection counts or re-derive the ranking (AGENTS.md: derive
 * metrics from events, in one place).
 */

export type RankedRow = { readonly rank: number }

/** The rank values shared by more than one stimulus in this hierarchy. */
export function tiedRanks(
  hierarchy: readonly RankedRow[],
): ReadonlySet<number> {
  const counts = new Map<number, number>()
  for (const row of hierarchy) {
    counts.set(row.rank, (counts.get(row.rank) ?? 0) + 1)
  }
  const tied = new Set<number>()
  for (const [rank, count] of counts) {
    if (count > 1) tied.add(rank)
  }
  return tied
}

/** `"1"`, or `"1 (tied)"` when another stimulus was chosen just as often. */
export function rankLabel(rank: number, tied: ReadonlySet<number>): string {
  return tied.has(rank) ? `${rank} (tied)` : String(rank)
}

/**
 * The explanation shown beside a hierarchy that contains a tie, or `null`
 * when every stimulus has its own rank and nothing needs explaining.
 *
 * The wording stays inside `docs/aba-glossary.md`: a preference hierarchy is
 * a rank-ordering by how often each stimulus was selected, so items selected
 * equally often genuinely share a place in it.
 */
export function tieNote(
  hierarchy: readonly RankedRow[],
  name: string,
): string | null {
  const tied = tiedRanks(hierarchy)
  if (tied.size === 0) return null
  return `Some items share a rank because ${name} chose them equally often. Tied items take the same place, and the next rank down skips ahead by however many items are tied — that is why the numbers jump.`
}
