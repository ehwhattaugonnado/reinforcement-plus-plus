/**
 * CRF cycle machinery (Milestone 4): one-outstanding-criterion cycles,
 * independent delivery classification, due-window abandonment, and the
 * derived CRF metrics/gates built from those classifications.
 *
 * Everything here is a pure function of `(events, config)` (plus, where
 * noted, the current simulated time): no RNG, no clock, no DOM. `session.ts`
 * is the only caller that commits the events these functions help build or
 * classify; nothing here reads `SchedulePlan` for the response-rate model
 * (that remains learning.ts's job) and nothing here decides creature
 * behavior -- it only classifies what the learner actually did (ADR 0003).
 *
 * See docs/architecture/data-model.md sections 3 and 5, and docs/core-loop.md
 * Round 1.
 */

import type { SimConfig } from './config'
import type {
  DeliveryContingency,
  DeliveryTiming,
  Phase,
  ScheduleFidelity,
  SimEvent,
} from './events'
import { baselineResponseRatePerMinute, responseRateInWindow } from './learning'

type ResponseEmitted = Extract<SimEvent, { type: 'response-emitted' }>
type CriterionMet = Extract<SimEvent, { type: 'criterion-met' }>
type Delivery = Extract<SimEvent, { type: 'stimulus-delivered' }>

export type OutstandingCycle = {
  /** The response whose criterion opened this cycle. */
  readonly responseId: string
  /** When the criterion was met (the opening `criterion-met`'s `at`). */
  readonly metAtMs: number
  /** When the due window elapses if no delivery closes the cycle first. */
  readonly dueByMs: number
}

/**
 * The single outstanding criterion, if any, derived purely from the event
 * log: a `criterion-met` opens a cycle; the next response-contingent
 * `stimulus-delivered` or `cycle-abandoned` after it closes it. At most one
 * cycle is ever open at a time because callers never emit a second
 * `criterion-met` while one is outstanding (core-loop.md Round 1).
 */
export function deriveOutstandingCycle(
  events: readonly SimEvent[],
  config: SimConfig,
): OutstandingCycle | null {
  let open: CriterionMet | null = null
  for (const e of events) {
    if (e.type === 'criterion-met') {
      open = e
    } else if (open !== null) {
      if (
        (e.type === 'stimulus-delivered' &&
          e.contingency === 'response-contingent') ||
        e.type === 'cycle-abandoned'
      ) {
        open = null
      }
    }
  }
  if (open === null) return null
  return {
    responseId: open.responseId,
    metAtMs: open.at,
    dueByMs: open.at + config.reinforcementDueWindowMs,
  }
}

/** Phases in which `deliverStimulus` is legal and the cycle machinery runs. */
const SCHEDULED_ROUND_PHASES: ReadonlySet<Phase> = new Set([
  'crf',
  'vr',
  'extinction',
])

/**
 * Simulated ms of the most recent event that "consumed" every response
 * before it: a response-contingent delivery (it was credited to a response),
 * a cycle abandonment (core-loop.md: "abandons the cycle, and starts a new
 * one at the next response" -- the old response is no longer reinforceable
 * once its cycle times out), or entering a scheduled round (`crf`, `vr`, or
 * `extinction`). The last case matters because `deliverStimulus` is illegal
 * outside those phases, so a baseline response can never be consumed by a
 * delivery or abandonment; without this boundary it would still be
 * "unconsumed" the instant CRF starts and would wrongly make the very first
 * CRF delivery look response-contingent on a response the schedule never
 * governed.
 */
function lastConsumptionBoundaryMs(events: readonly SimEvent[]): number {
  let boundary = -Infinity
  for (const e of events) {
    if (
      (e.type === 'stimulus-delivered' &&
        e.contingency === 'response-contingent') ||
      e.type === 'cycle-abandoned' ||
      (e.type === 'phase-changed' && SCHEDULED_ROUND_PHASES.has(e.phase))
    ) {
      boundary = e.at
    }
  }
  return boundary
}

/** Responses at or before `atMs` not yet consumed by a delivery or abandonment. */
function unconsumedResponses(
  events: readonly SimEvent[],
  atMs: number,
): ResponseEmitted[] {
  const boundary = lastConsumptionBoundaryMs(events)
  return events.filter(
    (e): e is ResponseEmitted =>
      e.type === 'response-emitted' && e.at > boundary && e.at <= atMs,
  )
}

export type DeliveryClassification = {
  readonly responseId: string | null
  readonly latencyMs: number | null
  readonly contingency: DeliveryContingency
  readonly timing: DeliveryTiming
  readonly scheduleFidelity: ScheduleFidelity
}

/**
 * Classifies a stimulus delivery at `atMs` against the event log, along
 * three independent dimensions (data-model section 3):
 *
 * - **Contingency**: response-contingent iff a response is unconsumed at
 *   `atMs`; otherwise noncontingent (`not-applicable` fidelity, `no-response`
 *   timing -- there is nothing to be prompt or late about).
 * - **Timing**: prompt if the associated response's latency is within
 *   `promptDeliveryWindowMs`, else delayed.
 * - **Schedule fidelity**: `premature` when a response is unconsumed but its
 *   criterion has not been met (unreachable in pure CRF, where every
 *   response meets the criterion immediately, but real for a ratio schedule
 *   whose requirement is not yet satisfied); `on-schedule`/`overrun` when
 *   this delivery closes the single outstanding cycle, depending on whether
 *   extra responses piled up since the criterion was met; `not-applicable`
 *   for a noncontingent delivery.
 *
 * `on-schedule` deliberately does not require `prompt` timing -- a delayed
 * but still-contingent, still-first delivery is a fidelity success and a
 * timing shortfall, not a fidelity failure; conflating the two would erase
 * the independence the docs require.
 */
export function classifyDelivery(
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

  const outstanding = deriveOutstandingCycle(events, config)
  if (outstanding === null) {
    // A response is unconsumed, but no criterion has been met for it (real
    // for an unmet ratio requirement; unreachable through live CRF play,
    // where every response immediately opens a cycle -- see crf.test.ts).
    const last = unconsumed[unconsumed.length - 1] as ResponseEmitted
    const latencyMs = atMs - last.at
    return {
      responseId: last.responseId,
      latencyMs,
      contingency: 'response-contingent',
      timing: latencyMs <= config.promptDeliveryWindowMs ? 'prompt' : 'delayed',
      scheduleFidelity: 'premature',
    }
  }

  const latencyMs = atMs - outstanding.metAtMs
  const overrunCount = unconsumed.filter(
    (r) => r.at > outstanding.metAtMs,
  ).length
  return {
    responseId: outstanding.responseId,
    latencyMs,
    contingency: 'response-contingent',
    timing: latencyMs <= config.promptDeliveryWindowMs ? 'prompt' : 'delayed',
    scheduleFidelity: overrunCount > 0 ? 'overrun' : 'on-schedule',
  }
}

/** The simulated-time span of the CRF round: from `phase-changed` into it to the next `phase-changed` away (or open-ended, `endMs: null`, if still current). */
export function crfRoundWindow(
  events: readonly SimEvent[],
): { readonly startMs: number; readonly endMs: number | null } | null {
  let startMs: number | null = null
  let endMs: number | null = null
  for (const e of events) {
    if (e.type === 'phase-changed') {
      if (e.phase === 'crf') {
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

export type CrfMetrics = {
  readonly deliveries: number
  readonly contingentDeliveries: number
  readonly noncontingentDeliveries: number
  readonly prematureDeliveries: number
  readonly onScheduleDeliveries: number
  readonly overrunDeliveries: number
  readonly promptContingentDeliveries: number
  /** Diagnostic-only count; never summed into the fidelity denominator (data-model section 5). */
  readonly missedCriteria: number
  readonly abandonedCycles: number
  /** Response-contingent deliveries / all deliveries. `null` when there are none. */
  readonly contingentDeliveryRate: number | null
  /** Prompt / all response-contingent deliveries. `null` when there are none. */
  readonly promptDeliveryRate: number | null
  /** On-schedule / (on-schedule + overrun + abandoned). `null` when the denominator is 0. */
  readonly scheduleFidelity: number | null
  /** Median latency across response-contingent deliveries. `null` when there are none. */
  readonly medianLatencyMs: number | null
}

/**
 * Derives every CRF-relevant metric from the event log alone (data-model
 * section 5): contingent/prompt-delivery rates, schedule fidelity, median
 * latency, missed criteria, premature deliveries, noncontingent deliveries,
 * and overruns. Optionally scoped to `[fromMs, toMs)`; unscoped by default so
 * callers needing a whole-session view don't have to compute a window.
 */
export function deriveCrfMetrics(
  events: readonly SimEvent[],
  fromMs = -Infinity,
  toMs = Infinity,
): CrfMetrics {
  // Inclusive on both ends: `toMs` is typically either a closed round's own
  // boundary event or, for a still-open round, "now" -- and a delivery can
  // legitimately land exactly on "now" (it is what set `elapsedSimMs`), so an
  // exclusive upper bound would silently drop the most recent event.
  const inWindow = (at: number) => at >= fromMs && at <= toMs
  const deliveries = events.filter(
    (e): e is Delivery => e.type === 'stimulus-delivered' && inWindow(e.at),
  )
  const contingent = deliveries.filter(
    (d) => d.contingency === 'response-contingent',
  )
  const noncontingent = deliveries.filter(
    (d) => d.contingency === 'noncontingent',
  )
  const premature = deliveries.filter((d) => d.scheduleFidelity === 'premature')
  const onSchedule = deliveries.filter(
    (d) => d.scheduleFidelity === 'on-schedule',
  )
  const overrun = deliveries.filter((d) => d.scheduleFidelity === 'overrun')
  const promptContingent = contingent.filter((d) => d.timing === 'prompt')
  const missedCriteria = events.filter(
    (e) => e.type === 'criterion-missed' && inWindow(e.at),
  ).length
  const abandonedCycles = events.filter(
    (e) => e.type === 'cycle-abandoned' && inWindow(e.at),
  ).length

  const latencies = contingent
    .map((d) => d.latencyMs)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  const mid = Math.floor(latencies.length / 2)
  const medianLatencyMs =
    latencies.length === 0
      ? null
      : latencies.length % 2 === 1
        ? (latencies[mid] as number)
        : ((latencies[mid - 1] as number) + (latencies[mid] as number)) / 2

  const fidelityDenominator =
    onSchedule.length + overrun.length + abandonedCycles

  return {
    deliveries: deliveries.length,
    contingentDeliveries: contingent.length,
    noncontingentDeliveries: noncontingent.length,
    prematureDeliveries: premature.length,
    onScheduleDeliveries: onSchedule.length,
    overrunDeliveries: overrun.length,
    promptContingentDeliveries: promptContingent.length,
    missedCriteria,
    abandonedCycles,
    contingentDeliveryRate:
      deliveries.length === 0 ? null : contingent.length / deliveries.length,
    promptDeliveryRate:
      contingent.length === 0
        ? null
        : promptContingent.length / contingent.length,
    scheduleFidelity:
      fidelityDenominator === 0
        ? null
        : onSchedule.length / fidelityDenominator,
    medianLatencyMs,
  }
}

/**
 * True once both the minimum on-schedule delivery count and the
 * acquisition-rate threshold are met for the current CRF round
 * (docs/core-loop.md Round 1, data-model section 6). Deliberately stricter
 * than {@link import('./evidence').evaluateReinforcerEvidence}: this gate
 * decides whether the response is established enough to thin the schedule,
 * not what the debrief may claim.
 */
export function crfAcquisitionMet(
  events: readonly SimEvent[],
  elapsedSimMs: number,
  config: SimConfig,
): boolean {
  const window = crfRoundWindow(events)
  if (window === null) return false
  const endMs = window.endMs ?? elapsedSimMs

  const onScheduleCount = deriveCrfMetrics(
    events,
    window.startMs,
    endMs,
  ).onScheduleDeliveries
  if (onScheduleCount < config.crfMinOnScheduleDeliveries) return false

  const baselineRate = baselineResponseRatePerMinute(events, config)
  if (baselineRate === null) return false

  const acquisitionWindowStart = Math.max(
    window.startMs,
    endMs - config.crfAcquisitionWindowMs,
  )
  const crfRate = responseRateInWindow(events, acquisitionWindowStart, endMs)

  return (
    crfRate >= baselineRate * (1 + config.crfAcquisitionRelativeIncrease) &&
    crfRate >= baselineRate + config.crfAcquisitionAbsoluteIncrease
  )
}

/**
 * True once `crfCoachingPauseMs` of simulated time has elapsed in the
 * current, still-open CRF round without the acquisition gate being met.
 * Derived only -- like `isBaselineComplete`, it emits no event and does not
 * itself pause the session; the screen surfaces it as coaching copy.
 */
export function crfCoachingDue(
  events: readonly SimEvent[],
  elapsedSimMs: number,
  config: SimConfig,
): boolean {
  const window = crfRoundWindow(events)
  if (window === null || window.endMs !== null) return false
  if (elapsedSimMs - window.startMs < config.crfCoachingPauseMs) return false
  return !crfAcquisitionMet(events, elapsedSimMs, config)
}
