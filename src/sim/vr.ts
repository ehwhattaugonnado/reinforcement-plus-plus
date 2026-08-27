/**
 * VR-3 cycle machinery (Milestone 5): the seeded shuffled requirement
 * sequence, live schedule-state derivation, and the round-level gates built
 * on top of it.
 *
 * `deriveOutstandingCycle` and `classifyDelivery` (crf.ts) are already
 * schedule-agnostic -- they classify from `criterion-met`/
 * `stimulus-delivered` events generically, not from a CRF assumption -- so
 * VR reuses them unchanged. What VR adds is: generating the requirement
 * sequence, deriving how many responses count toward the current one, and
 * attributing completed cycles to VR specifically (by each delivery's
 * opening criterion's `schedule`, not by round time window -- see
 * `vrCyclesCompleted`).
 *
 * See docs/architecture/data-model.md sections 3 and 5, and docs/core-loop.md
 * Round 2.
 */

import type { SimConfig } from './config'
import type { SimEvent } from './events'
import { deriveOutstandingCycle, unconsumedResponses } from './crf'
import { createRng } from './rng'

/**
 * The `index`-th (0-indexed) seeded VR ratio requirement.
 *
 * A learner can rack up abandoned or overrun cycles indefinitely before
 * completing the `vrCyclesToComplete` on-schedule ones the round requires,
 * so there is no safe upper bound to pre-generate and store (unlike
 * assessment's fixed six `plannedPairs`). Instead this is a pure, indexed
 * function of `(seed, index, config)`: block `floor(index / blockLength)` is
 * shuffled fresh, in its own RNG namespace (`vr-requirements-<blockIndex>`,
 * following the same per-purpose-stream convention as `responses`/`setup`),
 * and `index` is taken modulo the block length within it. No incremental RNG
 * state is threaded across calls, so this stays callable from `project.ts`'s
 * pure reducer -- callers never need to store or replay a generated array.
 */
export function vrRequirementAt(
  seed: string,
  index: number,
  config: SimConfig,
): number {
  const blockLength = config.vrRequirementBlock.length
  const blockIndex = Math.floor(index / blockLength)
  const withinBlock = index % blockLength
  const shuffled = createRng(seed, `vr-requirements-${blockIndex}`).shuffle(
    config.vrRequirementBlock,
  )
  return shuffled[withinBlock] as number
}

export type VrScheduleState = {
  /** The ratio the learner is currently counting responses toward. */
  readonly currentRequirement: number
  /**
   * Unconsumed responses since the current requirement started (i.e. since
   * the last `criterion-met`, `cycle-abandoned`, or entry into `vr` --
   * whichever is most recent). The same set `classifyDelivery` (crf.ts)
   * would credit a delivery to right now.
   */
  readonly responsesSinceReinforcement: number
  /** Every requirement presented so far, including the current one, in order. */
  readonly generatedRequirements: readonly number[]
}

/**
 * Derives the live VR schedule state purely from the event log: no
 * incremental state is stored or patched in the snapshot. This is what lets
 * an abandoned cycle "start a new one" (core-loop.md Round 2) fall out for
 * free -- `cycle-abandoned` is already a consumption boundary for
 * `unconsumedResponses`, and it resolves the cycle the same as a completed
 * delivery does for advancing to the next seeded requirement, so no
 * separate reset rule has to be reasoned about here.
 *
 * A `criterion-met` alone does not advance `currentRequirement` -- only a
 * resolved cycle does (`deriveOutstandingCycle` returning null: a
 * response-contingent delivery or an abandonment). While a cycle is open,
 * the just-met requirement stays current and `responsesSinceReinforcement`
 * keeps counting overrun responses, matching what `classifyDelivery`
 * (crf.ts) would credit a delivery to right now.
 */
export function deriveVrScheduleState(
  events: readonly SimEvent[],
  seed: string,
  config: SimConfig,
): VrScheduleState {
  const criterionMetCount = events.filter(
    (e) => e.type === 'criterion-met' && e.schedule === 'VR',
  ).length
  const hasOutstandingCycle = deriveOutstandingCycle(events, config) !== null
  const resolvedCycleCount = Math.max(
    0,
    hasOutstandingCycle ? criterionMetCount - 1 : criterionMetCount,
  )
  const generatedRequirements = Array.from(
    { length: resolvedCycleCount + 1 },
    (_, i) => vrRequirementAt(seed, i, config),
  )
  const currentRequirement = generatedRequirements[resolvedCycleCount] as number
  const responsesSinceReinforcement = unconsumedResponses(
    events,
    Infinity,
  ).length
  return {
    currentRequirement,
    responsesSinceReinforcement,
    generatedRequirements,
  }
}

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

type Delivery = Extract<SimEvent, { type: 'stimulus-delivered' }>

/**
 * The `schedule` of the `criterion-met` that a delivery's `responseId`
 * opened, if any. A response can open at most one cycle (crf.ts), so at
 * most one `criterion-met` ever shares a given `responseId`.
 */
function openingSchedule(
  events: readonly SimEvent[],
  delivery: Delivery,
): 'CRF' | 'VR' | null {
  if (delivery.responseId === null) return null
  const criterion = events.find(
    (e): e is Extract<SimEvent, { type: 'criterion-met' }> =>
      e.type === 'criterion-met' && e.responseId === delivery.responseId,
  )
  return criterion?.schedule ?? null
}

/**
 * Count of on-schedule VR deliveries in the round so far (data-model section
 * 5's "completed on-schedule cycles" -- overruns and abandonments do not
 * count, matching CRF's acquisition gate).
 *
 * Requires both an opening `schedule: 'VR'` criterion and a delivery inside
 * `vrRoundWindow`. The schedule check alone is not enough: the extinction
 * round's withheld criteria are also seeded `schedule: 'VR'` (evidence.ts's
 * `firstWithheldCriterionAt`), so a response-contingent delivery landing
 * after the VR round has ended would otherwise be misattributed to VR. The
 * window check alone is not enough either -- that's the boundary case this
 * function exists to get right: a delivery and the following round's
 * `phase-changed` can share the exact same simulated instant (a learner can
 * deliver, then immediately advance with no tick in between), which a
 * time-window-only count would misattribute to whichever round's window
 * happens to include that boundary inclusively. Combining both is exact
 * regardless of timing coincidences or cross-round schedule reuse.
 */
export function vrCyclesCompleted(events: readonly SimEvent[]): number {
  const window = vrRoundWindow(events)
  if (window === null) return 0
  return events.filter(
    (e): e is Delivery =>
      e.type === 'stimulus-delivered' &&
      e.scheduleFidelity === 'on-schedule' &&
      e.at >= window.startMs &&
      (window.endMs === null || e.at <= window.endMs) &&
      openingSchedule(events, e) === 'VR',
  ).length
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
