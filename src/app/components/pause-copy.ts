/**
 * Why the session is stopped, and what the learner is told.
 *
 * A plain module with no imports, matching `screens/coaching.ts` and
 * `screens/debrief-closing.ts`: state-derived copy lives where it can be read
 * and tested without rendering. `useSimState` derives the reason; this owns
 * the vocabulary and the wording.
 *
 * The layout suite drives the control bar through every message in this
 * table. Below 50rem the bar is fixed over the sheet and its height depends
 * on which of these is rendering, so a reserve verified against only the
 * shortest one is not verified at all (docs/testing-strategy.md, "Layout and
 * presentation defects"). Keeping this dependency-free is what lets the
 * end-to-end project import it without pulling in the simulation core.
 */

/** Why the session is currently stopped, for the shell's paused treatment. */
export type PauseReason = 'away' | 'coaching' | 'user'

/** What stopped the session, in the learner's words. */
export const PAUSE_REASON_TEXT: Record<PauseReason, string> = {
  away: 'Paused because you left this tab.',
  coaching: 'Paused for a coaching checkpoint.',
  user: 'Paused.',
}
