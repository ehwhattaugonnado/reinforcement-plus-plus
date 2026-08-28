/**
 * The experienced-consequence learning model (Milestone 3).
 *
 * Everything here is a pure function of the event log plus `SimConfig`: no
 * RNG, no clock, no DOM. `project.ts`'s `applyBehavioralEvent` is the only
 * caller that folds these results back into a snapshot; `session.ts`'s
 * `tick` is the only caller that draws randomness (via `rng.nextExponential`)
 * to decide *when* the next response happens, using the rate this module
 * computes.
 *
 * Central causal invariant (ADR 0003): nothing in this module takes the
 * selected `SchedulePlan` as an input. Response rate depends only on
 * baseline rate, learned strength, the history/contingency/latency of actual
 * deliveries, the delivered stimulus's current value, and time since the
 * last experienced consequence. See docs/architecture/data-model.md section 4.
 */

import type { SimConfig } from './config'
import type { Phase, SimEvent } from './events'
import type { CreatureState, StimulusState } from './types'

/** Phases in which the free-operant response process runs. */
export const RESPONDING_PHASES: ReadonlySet<Phase> = new Set([
  'baseline',
  'crf',
  'vr',
  'extinction',
])

/** Mean inter-response interval, simulated ms, for a given rate. Guards against non-positive rates. */
export function meanInterarrivalMs(ratePerMinute: number): number {
  return 60000 / Math.max(ratePerMinute, 0.01)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

type Delivery = Extract<SimEvent, { type: 'stimulus-delivered' }>
type ValueEvent = Extract<
  SimEvent,
  { type: 'creature-selected' | 'stimulus-delivered' }
>

function deliveriesUpTo(events: readonly SimEvent[], atMs: number): Delivery[] {
  const out: Delivery[] = []
  for (const e of events) {
    if (e.type === 'stimulus-delivered' && e.at <= atMs) out.push(e)
  }
  return out
}

/** Gain to learned strength from one delivery, by contingency and timing. */
function deliveryGain(config: SimConfig, delivery: Delivery): number {
  if (delivery.contingency === 'response-contingent') {
    if (delivery.timing === 'prompt') {
      return config.learnedStrengthGainPromptContingent
    }
    if (delivery.timing === 'delayed') {
      return config.learnedStrengthGainDelayedContingent
    }
  }
  return config.learnedStrengthGainNoncontingent
}

/**
 * Learned strength derived from the full history of stimulus deliveries up
 * to and including `atMs`. Monotonically accumulates, clamped to [0, 1].
 * Prompt, response-contingent deliveries teach more than delayed ones;
 * noncontingent deliveries teach little to nothing (data-model section 4).
 */
export function deriveLearnedStrength(
  events: readonly SimEvent[],
  atMs: number,
  config: SimConfig,
): number {
  let strength = 0
  for (const delivery of deliveriesUpTo(events, atMs)) {
    strength = clamp(strength + deliveryGain(config, delivery), 0, 1)
  }
  return strength
}

/** Exponential approach of `value` toward `target` over `dtMs`. */
function recoverToward(
  value: number,
  target: number,
  dtMs: number,
  timeConstantMs: number,
): number {
  if (dtMs <= 0) return value
  const progress = 1 - Math.exp(-dtMs / timeConstantMs)
  return value + (target - value) * progress
}

/**
 * A stimulus's current value at `atMs`, derived from its own delivery
 * history: each delivery decays it by `satiationDecayFraction`, and between
 * deliveries it recovers asymptotically toward a ceiling strictly below
 * `basePreference` (v1 has no persistence, so this bound is within-session
 * only; see docs/architecture/data-model.md section 4).
 */
export function deriveStimulusValue(
  events: readonly SimEvent[],
  stimulusId: string,
  basePreference: number,
  atMs: number,
  config: SimConfig,
): number {
  const valueEvents = events.filter(
    (event): event is ValueEvent =>
      event.at <= atMs &&
      ((event.type === 'creature-selected' &&
        event.stimulusId === stimulusId) ||
        (event.type === 'stimulus-delivered' &&
          event.stimulusId === stimulusId)),
  )
  if (valueEvents.length === 0) return basePreference

  const recoveryTarget =
    basePreference * config.satiationRecoveryCeilingFraction
  let value = basePreference
  let lastAt: number | null = null
  for (const valueEvent of valueEvents) {
    if (lastAt !== null) {
      value = recoverToward(
        value,
        recoveryTarget,
        valueEvent.at - lastAt,
        config.satiationRecoveryTimeConstantMs,
      )
    }
    value =
      valueEvent.type === 'creature-selected'
        ? Math.max(
            basePreference * config.assessmentSatiationFloorFraction,
            value * (1 - config.assessmentSatiationPerAccess),
          )
        : Math.max(
            config.stimulusValueFloor,
            value * (1 - config.satiationDecayFraction),
          )
    lastAt = valueEvent.at
  }
  if (lastAt !== null) {
    value = recoverToward(
      value,
      recoveryTarget,
      atMs - lastAt,
      config.satiationRecoveryTimeConstantMs,
    )
  }
  return clamp(value, config.stimulusValueFloor, basePreference)
}

/** Recomputes every stimulus's current value at `atMs` from the event log. */
export function deriveStimuliValues(
  events: readonly SimEvent[],
  baseStimuli: readonly StimulusState[],
  atMs: number,
  config: SimConfig,
): StimulusState[] {
  return baseStimuli.map((s) => ({
    ...s,
    currentValue: deriveStimulusValue(
      events,
      s.stimulusId,
      s.basePreference,
      atMs,
      config,
    ),
  }))
}

/** The most recently delivered stimulus at or before `atMs`, if any. */
export function lastDeliveredStimulusId(
  events: readonly SimEvent[],
  atMs: number,
): string | null {
  const deliveries = deliveriesUpTo(events, atMs)
  const last = deliveries[deliveries.length - 1]
  return last === undefined ? null : last.stimulusId
}

/** Simulated ms since the last experienced consequence, or null if none yet. */
export function msSinceLastConsequence(
  events: readonly SimEvent[],
  atMs: number,
): number | null {
  const deliveries = deliveriesUpTo(events, atMs)
  const last = deliveries[deliveries.length - 1]
  return last === undefined ? null : atMs - last.at
}

/**
 * A primed creature's transient extinction-burst contribution at `recencyMs`
 * since the last experienced consequence: zero at cessation, rising to
 * `magnitude` at `config.extinctionBurstPeakDelayMs`, then decaying -- never
 * a step function. `magnitude` scales with the same `learnedStrength *
 * stimulusValue` factors as the ordinary post-delivery rate term, so a
 * creature with a weaker reinforcement history has a smaller possible burst.
 */
function extinctionBurstContribution(
  recencyMs: number,
  learnedStrength: number,
  stimulusValue: number,
  config: SimConfig,
  magnitudeScale: number,
): number {
  const magnitude =
    config.extinctionBurstMagnitudeGainPerMinute *
    learnedStrength *
    stimulusValue *
    magnitudeScale
  const peakMs = config.extinctionBurstPeakDelayMs
  const x = recencyMs / peakMs
  return magnitude * x * Math.exp(1 - x)
}

/**
 * The creature's current response rate at `atMs`. Baseline rate plus a
 * learned-strength contribution that decays with time since the last
 * experienced consequence and scales with that stimulus's current value,
 * plus an optional extinction-transition burst term active only in the
 * `extinction` phase for a creature seeded as primed for one (data-model
 * section 4). The selected schedule is never an input (ADR 0003, central
 * causal invariant); `phase` is a distinct, documented rate input -- which
 * round is running, not the learner's selected schedule type -- and is
 * itself derived from logged `phase-changed` events, so this remains a pure
 * function of the event log plus config.
 */
export function computeResponseRatePerMinute(
  events: readonly SimEvent[],
  atMs: number,
  config: SimConfig,
  creature: Pick<CreatureState, 'stimuli' | 'targetBehavior'>,
  phase: Phase = 'baseline',
): number {
  const learnedStrength = deriveLearnedStrength(events, atMs, config)
  const recencyMs = msSinceLastConsequence(events, atMs)
  if (recencyMs === null || learnedStrength <= 0) {
    return clamp(
      creature.targetBehavior.baselineRatePerMinute,
      config.responseRateFloorPerMinute,
      config.responseRateCeilingPerMinute,
    )
  }

  const influence = Math.exp(-recencyMs / config.responseRateConsequenceDecayMs)
  const deliveredId = lastDeliveredStimulusId(events, atMs)
  const stimulus = creature.stimuli.find((s) => s.stimulusId === deliveredId)
  const value =
    stimulus === undefined
      ? 0
      : deriveStimulusValue(
          events,
          stimulus.stimulusId,
          stimulus.basePreference,
          atMs,
          config,
        )

  const burst =
    phase === 'extinction' && creature.targetBehavior.extinctionBurstPrimed
      ? extinctionBurstContribution(
          recencyMs,
          learnedStrength,
          value,
          config,
          creature.targetBehavior.extinctionBurstMagnitudeScale,
        )
      : 0

  const rate =
    creature.targetBehavior.baselineRatePerMinute +
    learnedStrength * influence * value * config.learningRateGainPerMinute +
    burst

  return clamp(
    rate,
    config.responseRateFloorPerMinute,
    config.responseRateCeilingPerMinute,
  )
}

/**
 * Response-rate window projector: response events divided by observed
 * simulated time in `[fromMs, toMs)`. `elapsedSimMs` (and therefore every
 * event's `at`) only advances while unpaused, so paused time is already
 * excluded without a second data path (data-model section 5).
 */
export function responseRateInWindow(
  events: readonly SimEvent[],
  fromMs: number,
  toMs: number,
): number {
  if (toMs <= fromMs) return 0
  let count = 0
  for (const e of events) {
    if (e.type === 'response-emitted' && e.at >= fromMs && e.at < toMs) {
      count++
    }
  }
  return (count / (toMs - fromMs)) * 60000
}

/**
 * The simulated-time window the baseline round occupied: from the last
 * `phase-changed` into `baseline` to the earlier of `baselineDurationMs`
 * later or the next `phase-changed` away from it (whichever the round
 * actually used), so a learner leaving early or lingering doesn't skew the
 * event-derived baseline rate. Returns null if baseline never started.
 */
export function baselineWindow(
  events: readonly SimEvent[],
  config: SimConfig,
): { startMs: number; endMs: number } | null {
  let startMs: number | null = null
  let endMs: number | null = null
  for (const e of events) {
    if (e.type === 'phase-changed') {
      if (e.phase === 'baseline') {
        startMs = e.at
        endMs = null
      } else if (startMs !== null && endMs === null) {
        endMs = e.at
      }
    }
  }
  if (startMs === null) return null
  const cappedEnd = startMs + config.baselineDurationMs
  return {
    startMs,
    endMs: endMs === null ? cappedEnd : Math.min(endMs, cappedEnd),
  }
}

/**
 * The event-derived baseline response rate: responses observed during the
 * baseline window divided by observed simulated time in that window. This is
 * distinct from `creature.targetBehavior.baselineRatePerMinute`, which is
 * the seeded latent rate the model uses before any consequence has been
 * experienced. M4's acquisition gate and M6's evidence rule compare against
 * this event-derived figure, not the latent one (data-model section 5).
 */
export function baselineResponseRatePerMinute(
  events: readonly SimEvent[],
  config: SimConfig,
): number | null {
  const window = baselineWindow(events, config)
  if (window === null) return null
  return responseRateInWindow(events, window.startMs, window.endMs)
}

/**
 * True once `config.baselineDurationMs` of simulated time has elapsed since
 * baseline started. Derived only; does not itself end the round or emit an
 * event — advancing past baseline still requires the learner's explicit
 * stimulus choice and `startRound('crf')` (core-loop, Round 0).
 */
export function isBaselineComplete(
  events: readonly SimEvent[],
  elapsedSimMs: number,
  config: SimConfig,
): boolean {
  const window = baselineWindow(events, config)
  if (window === null) return false
  return elapsedSimMs - window.startMs >= config.baselineDurationMs
}
