import type { CrfMetrics } from '../../sim'

/**
 * Coaching copy, derived from the round's own event log.
 *
 * This module exists apart from the screen so the derivation can be tested
 * against constructed evidence rather than against whichever seeds happen to
 * reach a coaching pause. It owns no simulation rules (ADR 0002): it reads
 * already-derived metrics and decides what to say about them.
 */

/**
 * What the round's own event log says is holding the learner back.
 *
 * A coaching pause fires on elapsed time alone — it means "this round has run
 * a while without reaching its goal," not "you did something wrong." The copy
 * it triggers must therefore be derived from what actually happened, and must
 * be able to conclude that nothing is wrong. Both presentation modes read the
 * same conclusion here and only word it differently (ADR 0004): a conclusion
 * available in one mode and contradicted in the other is a defect.
 */
export type CoachingFinding =
  | 'no-deliveries'
  | 'noncontingent'
  | 'late'
  | 'missed'
  | 'not-variable'
  | 'premature'
  | 'overrun'
  | 'on-track'

export function deriveCrfCoaching(metrics: CrfMetrics): CoachingFinding {
  if (metrics.deliveries === 0) return 'no-deliveries'
  // Ordered by how much each one costs the learner: a delivery that followed
  // no response cannot strengthen anything, a late one strengthens weakly,
  // and a response that got nothing is a missed opportunity rather than an
  // error. Only report the largest real problem, never a list of them.
  if (metrics.noncontingentDeliveries > 0) return 'noncontingent'
  if (metrics.promptDeliveryRate !== null && metrics.promptDeliveryRate < 0.6) {
    return 'late'
  }
  if (metrics.missedCriteria > metrics.contingentDeliveries) return 'missed'
  return 'on-track'
}

export function deriveVrCoaching(tally: {
  deliveries: number
  noncontingent: number
  notVariable: number
  premature: number
  overrun: number
  onSchedule: number
}): CoachingFinding {
  if (tally.deliveries === 0) return 'no-deliveries'
  if (tally.noncontingent > 0) return 'noncontingent'
  const worst = Math.max(tally.notVariable, tally.premature, tally.overrun)
  if (worst === 0) return 'on-track'
  if (tally.notVariable === worst) return 'not-variable'
  if (tally.premature === worst) return 'premature'
  return 'overrun'
}

export const COACHING_COPY: Record<
  CoachingFinding,
  { simple: (name: string) => string; advanced: (name: string) => string }
> = {
  'no-deliveries': {
    simple: (name) =>
      `No deliveries yet this round. Watch for ${name} to respond, then deliver right away.`,
    advanced: (name) =>
      `no deliveries are recorded in this round yet. Deliver immediately after ${name} responds so the consequence is contingent on the response.`,
  },
  noncontingent: {
    simple: () =>
      'Some deliveries did not follow a response, so they could not strengthen anything. Wait for a response first.',
    advanced: (name) =>
      `some deliveries in this round were noncontingent — they followed no response, so they cannot reinforce one. Wait for ${name} to respond before delivering.`,
  },
  late: {
    simple: (name) =>
      `Deliveries are arriving a little late. Try delivering the moment ${name} responds.`,
    advanced: () =>
      'most deliveries landed outside the prompt window. Shortening the latency between the response and the delivery makes the contingency easier to discriminate.',
  },
  missed: {
    simple: (name) =>
      `Several responses from ${name} went by without a delivery. Under this schedule, every response earns one.`,
    advanced: (name) =>
      `more responses went unreinforced than reinforced. CRF reinforces every response, so each one ${name} makes should be followed by a delivery.`,
  },
  'not-variable': {
    simple: () =>
      'Try changing how many responses you wait for between deliveries, rather than repeating one count.',
    advanced: () =>
      'deliveries followed too predictable a pattern to count as variable. Vary the responses-per-delivery count while keeping the average near three.',
  },
  premature: {
    simple: () =>
      'Deliveries are coming a bit early. Try waiting for a few more responses.',
    advanced: () =>
      'several deliveries arrived before the running average would accept them. Letting a few more responses accumulate between deliveries will bring the average toward three.',
  },
  overrun: {
    simple: () =>
      'Deliveries are coming after quite a few responses. Try delivering a little sooner.',
    advanced: () =>
      'several deliveries arrived after extra responses had accumulated. Delivering sooner will bring the running average back toward three.',
  },
  'on-track': {
    simple: () =>
      'Nothing is going wrong — this round just needs a few more deliveries before the pattern shows.',
    advanced: () =>
      'the event log shows no fidelity problem — deliveries are contingent, prompt, and on schedule. This round simply needs more of them before the criterion is met.',
  },
}
