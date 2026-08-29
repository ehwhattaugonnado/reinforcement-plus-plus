import type { DebriefSummary } from '../../sim'

/**
 * The debrief's closing line, derived from the event log.
 *
 * Simple mode used to end on "Switch to Advanced detail to inspect rates,
 * graphs, and their data tables." Product Principle 3 and ADR 0004 require
 * both modes to reach the same conclusions, and PRODUCT.md says neither mode
 * may ship as a degraded stub of the other — so a final line that points at
 * the other mode is close to the project's own definition of a defect. It
 * also ends a ten-to-twenty minute session on an instruction to change a
 * setting.
 *
 * Both modes now close on this sentence. Advanced still adds the charts and
 * their data tables, which is a genuine difference in *detail*, not in what
 * the session concluded.
 *
 * Every clause is a count the log actually carries, and no clause asserts a
 * result the log cannot support: a session that skipped a round says so by
 * omitting that clause rather than by reporting a zero as an outcome.
 * Milestone 7's complete mode-neutral summary is still outstanding; this
 * closes the conclusion-parity defect, not that scope.
 */
export function debriefClosing(
  result: DebriefSummary,
  creatureName: string,
): string {
  const clauses: string[] = []

  const { trialsRecorded } = result.assessment
  if (trialsRecorded > 0) {
    clauses.push(
      `recorded ${trialsRecorded} ${trialsRecorded === 1 ? 'assessment trial' : 'assessment trials'}`,
    )
  }

  const { deliveries } = result.crfMetrics
  if (deliveries > 0) {
    clauses.push(
      `made ${deliveries} ${deliveries === 1 ? 'delivery' : 'deliveries'}`,
    )
  }

  if (result.vrCredited > 0) {
    clauses.push(
      `completed ${result.vrCredited} of ${result.vrRequired} variable-ratio cycles on schedule`,
    )
  }

  const work =
    clauses.length === 0
      ? `You did not record enough of this session for it to conclude anything about ${creatureName}.`
      : `In this session you ${joinClauses(clauses)}; ${creatureName} responded ${result.totalResponses} ${result.totalResponses === 1 ? 'time' : 'times'}.`

  return `${work} Everything above comes from that record, and nothing is saved when you close this page.`
}

function joinClauses(clauses: readonly string[]): string {
  if (clauses.length === 1) return clauses[0] as string
  return `${clauses.slice(0, -1).join(', ')} and ${clauses.at(-1) as string}`
}
