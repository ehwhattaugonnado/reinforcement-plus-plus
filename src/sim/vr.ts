/**
 * VR-3 fidelity machinery (Milestone 5, revised per ADR 0010): a session-wide
 * running average of responses-per-delivery, not a hidden exact per-cycle
 * target. There is no discrete "the schedule is now due" instant and no
 * single-outstanding-cycle machinery here (unlike CRF's
 * `deriveOutstandingCycle`) -- every delivery is judged independently, at
 * the instant it happens, by whether accepting it would keep the round's
 * running average in `[vrAcceptableRatioMin, vrAcceptableRatioMax]`.
 *
 * `unconsumedResponses` (crf.ts) is reused unchanged: the response-boundary
 * rule (a response-contingent delivery of any fidelity, an abandonment, or
 * entering a scheduled round all "consume" every response before them) does
 * not change under ADR 0010, only what a delivery is judged against once a
 * candidate gap is known.
 *
 * See docs/architecture/data-model.md sections 3 and 5, docs/core-loop.md
 * Round 2, and ADR 0010.
 */

import type { SimConfig } from './config'
import type { SimEvent } from './events'
import { unconsumedResponses, type DeliveryClassification } from './crf'

type Delivery = Extract<SimEvent, { type: 'stimulus-delivered' }>

/**
 * The simulated-time span of the VR round: from `phase-changed` into it to
 * the next `phase-changed` away (or open-ended, `endMs: null`, if still
 * current). Mirrors `crfRoundWindow`.
 */
export function vrRoundWindow(
  events: readonly SimEvent[],
): { readonly startMs: number; readonly endMs: number | null } | null {
  let startMs: number | null = null
  let endMs: number | null = null
  for (const e of events) {
    if (e.type === 'phase-changed') {
      if (e.phase === 'vr') {
        startMs = e.at
        endMs = null
      } else if (startMs !== null && endMs === null) {
        endMs = e.at
      }
    }
  }
  if (startMs === null) return null
  return { startMs, endMs }
}

/**
 * The real history of gaps (responses-since-last-delivery) for every VR
 * delivery credited `on-schedule` so far this round, in order. Recomputed
 * from the log rather than stored incrementally: for each such delivery,
 * the gap is `unconsumedResponses` evaluated against the event log *up to
 * but not including it* (mirroring exactly how `classifyVrDelivery` sees
 * the log at the moment that delivery was originally classified), so a
 * later delivery in the log can never influence an earlier one's gap.
 */
function vrAcceptedGapsSoFar(events: readonly SimEvent[]): number[] {
  const window = vrRoundWindow(events)
  if (window === null) return []
  const gaps: number[] = []
  for (let i = 0; i < events.length; i++) {
    const e = events[i] as SimEvent
    if (
      e.type === 'stimulus-delivered' &&
      e.schedule === 'VR' &&
      e.scheduleFidelity === 'on-schedule' &&
      e.at >= window.startMs
    ) {
      const prefix = events.slice(0, i)
      gaps.push(unconsumedResponses(prefix, e.at).length)
    }
  }
  return gaps
}

/**
 * The running average of responses-per-delivery over `acceptedGaps`, blended
 * with the seeded phantom prior (`vrAverageSeedCount` entries each worth
 * `vrAverageSeedValue`) so early deliveries are judged against a reasonable
 * prior instead of wild swings from a near-empty sample. Pass `extraGap` to
 * get the *hypothetical* average if one more gap were accepted -- this is
 * what a candidate delivery is actually judged against.
 */
function vrRunningAverage(
  acceptedGaps: readonly number[],
  config: SimConfig,
  extraGap?: number,
): number {
  const gaps =
    extraGap === undefined ? acceptedGaps : [...acceptedGaps, extraGap]
  const realSum = gaps.reduce((a, b) => a + b, 0)
  const seedSum = config.vrAverageSeedValue * config.vrAverageSeedCount
  return (realSum + seedSum) / (gaps.length + config.vrAverageSeedCount)
}

export type VrScheduleState = {
  /**
   * Unconsumed responses since the last consumption boundary (a delivery of
   * any fidelity, an abandonment, or entering VR -- whichever is most
   * recent). The same set `classifyVrDelivery` would judge a delivery
   * against right now.
   */
  readonly responsesSinceReinforcement: number
  /** Real gaps credited `on-schedule` so far this round, in order. */
  readonly acceptedGaps: readonly number[]
  /** The running average over `acceptedGaps` plus the seeded phantom prior. */
  readonly runningAverage: number
}

/**
 * Derives the live VR schedule state purely from the event log: no
 * incremental state is stored or patched in the snapshot.
 */
export function deriveVrScheduleState(
  events: readonly SimEvent[],
  config: SimConfig,
): VrScheduleState {
  const acceptedGaps = vrAcceptedGapsSoFar(events)
  const runningAverage = vrRunningAverage(acceptedGaps, config)
  const responsesSinceReinforcement = unconsumedResponses(
    events,
    Infinity,
  ).length
  return { responsesSinceReinforcement, acceptedGaps, runningAverage }
}

/**
 * Classifies a VR delivery at `atMs` (ADR 0010). Contingency and timing
 * follow the same rule as CRF's `classifyDelivery` (crf.ts); schedule
 * fidelity does not: there is no outstanding-cycle concept for VR, so every
 * candidate gap is judged directly against the hypothetical running average
 * it would produce.
 *
 * - Below `vrAcceptableRatioMin` -> `premature`.
 * - Above `vrAcceptableRatioMax` -> `overrun`.
 * - In range, but the last `vrPatternRepeatThreshold - 1` *real* accepted
 *   gaps are all equal to this candidate too (the phantom seed is excluded,
 *   so it alone can never trigger this) -> `not-variable`: a fixed ratio in
 *   disguise, not VR.
 * - Otherwise -> `on-schedule`.
 */
export function classifyVrDelivery(
  events: readonly SimEvent[],
  atMs: number,
  config: SimConfig,
): DeliveryClassification {
  const unconsumed = unconsumedResponses(events, atMs)
  if (unconsumed.length === 0) {
    return {
      responseId: null,
      latencyMs: null,
      contingency: 'noncontingent',
      timing: 'no-response',
      scheduleFidelity: 'not-applicable',
    }
  }

  const last = unconsumed[unconsumed.length - 1]!
  const latencyMs = atMs - last.at
  const timing =
    latencyMs <= config.promptDeliveryWindowMs ? 'prompt' : 'delayed'
  const gap = unconsumed.length

  const acceptedGaps = vrAcceptedGapsSoFar(events)
  const hypotheticalAverage = vrRunningAverage(acceptedGaps, config, gap)

  const scheduleFidelity = (() => {
    if (hypotheticalAverage < config.vrAcceptableRatioMin) return 'premature'
    if (hypotheticalAverage > config.vrAcceptableRatioMax) return 'overrun'
    const threshold = config.vrPatternRepeatThreshold
    const recentReal = acceptedGaps.slice(-(threshold - 1))
    const wouldRepeat =
      recentReal.length === threshold - 1 && recentReal.every((g) => g === gap)
    return wouldRepeat ? 'not-variable' : 'on-schedule'
  })()

  return {
    responseId: last.responseId,
    latencyMs,
    contingency: 'response-contingent',
    timing,
    scheduleFidelity,
  }
}

/**
 * Count of VR deliveries credited `on-schedule` (data-model section 5's
 * "credited reinforcements" -- premature, overrun, and not-variable
 * deliveries do not count). A direct field check: `schedule` is stamped
 * onto each `stimulus-delivered` event by its caller (session.ts) from the
 * active phase at commit time, so no indirect attribution via a paired
 * criterion event or round time window is needed (ADR 0010).
 */
export function vrCyclesCompleted(events: readonly SimEvent[]): number {
  return events.filter(
    (e): e is Delivery =>
      e.type === 'stimulus-delivered' &&
      e.schedule === 'VR' &&
      e.scheduleFidelity === 'on-schedule',
  ).length
}

/** How a response's one associated delivery attempt (if any) resolved. */
export type VrTrialMark = 'credited' | 'blocked' | null

/**
 * A trial-by-trial view of the VR round for display: one entry per response,
 * in order, marked `'credited'` if a VR delivery crediting it was
 * `on-schedule`, `'blocked'` if a VR delivery credited it but was not
 * (`premature`/`overrun`/`not-variable`), or `null` if no delivery was ever
 * credited to it.
 */
export function vrTrialHistory(
  events: readonly SimEvent[],
): ReadonlyArray<{ readonly responseId: string; readonly mark: VrTrialMark }> {
  const window = vrRoundWindow(events)
  if (window === null) return []
  const responses = events.filter(
    (e): e is Extract<SimEvent, { type: 'response-emitted' }> =>
      e.type === 'response-emitted' &&
      e.at >= window.startMs &&
      (window.endMs === null || e.at <= window.endMs),
  )
  const vrDeliveries = events.filter(
    (e): e is Delivery =>
      e.type === 'stimulus-delivered' && e.schedule === 'VR',
  )
  return responses.map((r) => {
    const delivery = vrDeliveries.find((d) => d.responseId === r.responseId)
    const mark: VrTrialMark =
      delivery === undefined
        ? null
        : delivery.scheduleFidelity === 'on-schedule'
          ? 'credited'
          : 'blocked'
    return { responseId: r.responseId, mark }
  })
}

/**
 * True once `vrCoachingPauseMs` of simulated time has elapsed in the
 * current, still-open VR round without `vrCyclesToComplete` on-schedule
 * cycles being reached. Derived only -- mirrors `crfCoachingDue`.
 */
export function vrCoachingDue(
  events: readonly SimEvent[],
  elapsedSimMs: number,
  config: SimConfig,
): boolean {
  const window = vrRoundWindow(events)
  if (window === null || window.endMs !== null) return false
  if (elapsedSimMs - window.startMs < config.vrCoachingPauseMs) return false
  return vrCyclesCompleted(events) < config.vrCyclesToComplete
}
