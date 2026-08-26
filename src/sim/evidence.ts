/**
 * Event-derived detection rules: the reinforcer-evidence rule and the
 * extinction-burst detection rule.
 *
 * Both are pure functions of `(events, config)`. They read the append-only
 * event log and nothing else — no snapshot, no RNG, no clock, and in
 * particular they never ask the behavior model what it "intended". A run is
 * characterized only by what the log can support (ADR 0001; see
 * docs/architecture/data-model.md section 5).
 *
 * Terminology this module is responsible for protecting:
 *
 * - A stimulus the creature selected during assessment is a **preferred
 *   stimulus** or a **candidate (putative) reinforcer**. It may be described
 *   as *functioning as a reinforcer in this simulation* only once
 *   {@link evaluateReinforcerEvidence} returns `evidence-met`.
 * - When the rule is not met the supportable claim is that the stimulus "did
 *   not demonstrate a reinforcing effect in this short simulation" — never
 *   that it cannot function as a reinforcer.
 * - When the burst rule is not met the supportable claim is that no burst
 *   occurred *in this run*, together with the statement that bursts are not
 *   inevitable. An ordinary decrease, satiation, or resurgence is never
 *   called "extinction", and response variation or reappearance is never
 *   called "resurgence".
 * - Every threshold below is a transparent simulation parameter drawn from
 *   `SimConfig`, **not** a clinical rule, and nothing here is clinical
 *   decision support.
 *
 * These functions return data, never learner-facing copy: the simulation core
 * does not produce display strings (ADR 0008). Each result carries the numbers
 * behind its verdict so the debrief can show its work.
 */

import type { SimConfig } from './config'
import type { Phase, SimEvent } from './events'

const MS_PER_MINUTE = 60000

/**
 * A response rate measured over a window of *simulated* time.
 *
 * Simulated time does not advance while the session is paused, so `observedMs`
 * already excludes paused wall-clock time and must never have pause spans
 * subtracted from it a second time. It is also independent of the speed
 * setting: the same simulated-time behavior yields the same rate at 0.5x and
 * 1x.
 */
export type RateSample = {
  /** Target responses observed in the window. */
  readonly responses: number
  /** Observed simulated milliseconds spanned by the window. */
  readonly observedMs: number
  /** `responses` per minute of observed simulated time; 0 when `observedMs` is 0. */
  readonly perMinute: number
  /** Window start, in simulated ms since session start. */
  readonly fromMs: number
  /** Window end, in simulated ms since session start. */
  readonly toMs: number
}

/** An observed rate compared against a reference rate under two thresholds. */
export type RateComparison = {
  readonly reference: RateSample
  readonly observed: RateSample
  /**
   * `(observed - reference) / reference`. `Infinity` when the reference rate
   * is 0 and the observed rate is not; 0 when both are 0.
   */
  readonly relativeIncrease: number
  readonly absoluteIncreasePerMinute: number
  readonly relativeThresholdMet: boolean
  readonly absoluteThresholdMet: boolean
}

export type ReinforcerEvidenceThresholds = {
  readonly minDeliveries: number
  readonly windowMs: number
  readonly relativeIncrease: number
  readonly absoluteIncreasePerMinute: number
}

/** Which clause of the reinforcer-evidence rule was not satisfied. */
export type ReinforcerEvidenceCheck =
  'min-prompt-contingent-deliveries' | 'relative-increase' | 'absolute-increase'

export type PromptContingentDeliveryCounts = {
  /**
   * Prompt, response-contingent deliveries of the stimulus during the CRF
   * round. This is the count the rule tests (see the scoping note on
   * {@link evaluateReinforcerEvidence}).
   */
  readonly inCrfRound: number
  /** The same count across the whole session, for the debrief's detail view. */
  readonly inSession: number
}

/**
 * Why the reinforcer-evidence rule could not be run at all.
 *
 * Distinct from `not-demonstrated`: a log that never reached CRF supports no
 * claim about a reinforcing effect, not even a negative one.
 */
export type ReinforcerEvidenceNotEvaluableReason =
  | 'no-baseline-round'
  | 'no-crf-round'
  | 'baseline-window-empty'
  | 'crf-window-empty'

export type ReinforcerEvidenceResult =
  | {
      /**
       * The event log supports describing this stimulus as functioning as a
       * reinforcer *in this simulation*.
       */
      readonly kind: 'evidence-met'
      readonly stimulusId: string
      readonly deliveries: PromptContingentDeliveryCounts
      readonly comparison: RateComparison
      readonly thresholds: ReinforcerEvidenceThresholds
    }
  | {
      /**
       * The stimulus did not demonstrate a reinforcing effect in this short
       * simulation. This is never evidence that it cannot function as a
       * reinforcer.
       */
      readonly kind: 'not-demonstrated'
      readonly stimulusId: string
      readonly deliveries: PromptContingentDeliveryCounts
      readonly comparison: RateComparison
      readonly thresholds: ReinforcerEvidenceThresholds
      readonly unmet: readonly ReinforcerEvidenceCheck[]
    }
  | {
      readonly kind: 'not-evaluable'
      readonly stimulusId: string
      readonly reason: ReinforcerEvidenceNotEvaluableReason
    }

export type BurstThresholds = {
  readonly detectionWindowMs: number
  readonly referenceWindowMs: number
  readonly minReferenceWindowMs: number
  readonly relativeIncrease: number
  readonly absoluteIncreasePerMinute: number
}

/** Which clause of the burst-detection rule was not satisfied. */
export type BurstCheck = 'relative-increase' | 'absolute-increase'

/**
 * Why burst detection could not be run at all. Deliberately separate from
 * `indeterminate`, which is reserved for the section 5 reference-window floor.
 */
export type BurstNotEvaluableReason =
  | 'no-extinction-round'
  | 'no-preceding-reinforced-round'
  | 'no-withheld-criterion'
  | 'detection-window-empty'

export type BurstDetectionResult =
  | {
      readonly kind: 'burst'
      /** Simulated time of the first withheld criterion. */
      readonly anchorAtMs: number
      readonly referenceRound: Phase
      readonly comparison: RateComparison
      readonly thresholds: BurstThresholds
    }
  | {
      /**
       * No burst occurred in this run. Bursts are not inevitable, and this
       * result must never be presented as though one were expected.
       */
      readonly kind: 'no-burst-in-this-run'
      readonly anchorAtMs: number
      readonly referenceRound: Phase
      readonly comparison: RateComparison
      readonly thresholds: BurstThresholds
      readonly unmet: readonly BurstCheck[]
    }
  | {
      /**
       * The reference window available inside the preceding reinforced round
       * was shorter than `burstMinReferenceWindowMs`, so its rate is too noisy
       * to compare against. This run is neither a burst nor a confirmed
       * no-burst: the demonstration was too short to characterize.
       */
      readonly kind: 'indeterminate'
      readonly reason: 'reference-window-too-short'
      readonly anchorAtMs: number
      readonly referenceRound: Phase
      /** `min(reinforcedRoundDurationMs, burstReferenceWindowMs)`. */
      readonly availableReferenceWindowMs: number
      readonly reinforcedRoundDurationMs: number
      readonly thresholds: BurstThresholds
    }
  | {
      readonly kind: 'not-evaluable'
      readonly reason: BurstNotEvaluableReason
    }

/**
 * A contiguous run of the log spent in one phase.
 *
 * A span ends at the `at` of the next `phase-changed`. The final span has no
 * successor, so it ends at the last event's `at` and includes that instant —
 * otherwise a response recorded as the final event would fall outside every
 * window. Earlier spans are half-open, so an event exactly on a phase boundary
 * is counted once, in the round it starts.
 */
type PhaseSpan = {
  readonly phase: Phase
  readonly startMs: number
  readonly endMs: number
  readonly endInclusive: boolean
}

function phaseSpans(events: readonly SimEvent[]): PhaseSpan[] {
  const changes = events.filter(
    (e): e is Extract<SimEvent, { type: 'phase-changed' }> =>
      e.type === 'phase-changed',
  )
  if (changes.length === 0) return []

  const lastAt = events.reduce((max, e) => Math.max(max, e.at), 0)
  return changes.map((change, i) => {
    const next = changes[i + 1]
    const isLast = next === undefined
    return {
      phase: change.phase,
      startMs: change.at,
      endMs: isLast ? Math.max(change.at, lastAt) : next.at,
      endInclusive: isLast,
    }
  })
}

function firstSpanOf(
  spans: readonly PhaseSpan[],
  phase: Phase,
): PhaseSpan | undefined {
  return spans.find((s) => s.phase === phase)
}

function countResponses(
  events: readonly SimEvent[],
  fromMs: number,
  toMs: number,
  endInclusive: boolean,
): number {
  // V1 has a single target behavior, so every `response-emitted` is a target
  // response. `responseId` identifies the individual response, not the class,
  // and must not be filtered on.
  return events.filter(
    (e) =>
      e.type === 'response-emitted' &&
      e.at >= fromMs &&
      (endInclusive ? e.at <= toMs : e.at < toMs),
  ).length
}

function rateSample(
  events: readonly SimEvent[],
  fromMs: number,
  toMs: number,
  endInclusive: boolean,
): RateSample {
  const observedMs = Math.max(0, toMs - fromMs)
  const responses = countResponses(events, fromMs, toMs, endInclusive)
  return {
    responses,
    observedMs,
    perMinute: observedMs > 0 ? (responses * MS_PER_MINUTE) / observedMs : 0,
    fromMs,
    toMs,
  }
}

function compareRates(
  reference: RateSample,
  observed: RateSample,
  relativeThreshold: number,
  absoluteThresholdPerMinute: number,
): RateComparison {
  const ref = reference.perMinute
  const obs = observed.perMinute

  // A zero reference rate makes the ordinary ratio undefined. Fall back to a
  // presence check so `relativeIncrease` and `relativeThresholdMet` never
  // disagree: `obs * (1 + threshold) >= ref * (1 + threshold)` reduces to
  // `obs >= 0` when `ref` is 0, which is trivially always true and would
  // silently report "threshold met" alongside a "no increase" (0) relative
  // value for an observed rate of 0. That contradiction is exactly the kind
  // of misconception the debrief must not surface (AGENTS.md Quality Bar).
  let relativeIncrease: number
  let relativeThresholdMet: boolean
  if (ref > 0) {
    relativeIncrease = (obs - ref) / ref
    relativeThresholdMet = obs >= ref * (1 + relativeThreshold)
  } else {
    relativeIncrease = obs > 0 ? Infinity : 0
    relativeThresholdMet = obs > 0
  }

  return {
    reference,
    observed,
    relativeIncrease,
    absoluteIncreasePerMinute: obs - ref,
    relativeThresholdMet,
    absoluteThresholdMet: obs >= ref + absoluteThresholdPerMinute,
  }
}

/**
 * The reinforcer-evidence rule (data model section 5).
 *
 * A stimulus has evidence of functioning as a reinforcer only when it has at
 * least `reinforcerEvidenceMinDeliveries` prompt, response-contingent
 * deliveries **and** the target response rate over the final
 * `reinforcerEvidenceWindowMs` of the CRF round exceeds the baseline rate by
 * at least both `reinforcerEvidenceRelativeIncrease` and
 * `reinforcerEvidenceAbsoluteIncrease`.
 *
 * Both sides of the comparison are responses per minute of observed simulated
 * time, so the unequal baseline (45 s by default) and CRF (60 s) windows
 * compare correctly. The baseline rate is measured over the baseline round as
 * it was actually observed in the log, not over `baselineDurationMs`, which is
 * a round-length setting rather than a measurement window.
 *
 * Scoping note: section 5 scopes the rate clause to CRF but leaves the
 * delivery-count clause unscoped. This implementation counts CRF-round
 * deliveries as the rule input, because deliveries made later (during VR)
 * cannot have produced the CRF window's rate. The session-wide count is
 * reported alongside it so a later change of rule needs no change of shape.
 */
export function evaluateReinforcerEvidence(
  events: readonly SimEvent[],
  config: SimConfig,
  stimulusId: string,
): ReinforcerEvidenceResult {
  const thresholds: ReinforcerEvidenceThresholds = {
    minDeliveries: config.reinforcerEvidenceMinDeliveries,
    windowMs: config.reinforcerEvidenceWindowMs,
    relativeIncrease: config.reinforcerEvidenceRelativeIncrease,
    absoluteIncreasePerMinute: config.reinforcerEvidenceAbsoluteIncrease,
  }

  const spans = phaseSpans(events)
  const baseline = firstSpanOf(spans, 'baseline')
  if (baseline === undefined)
    return { kind: 'not-evaluable', stimulusId, reason: 'no-baseline-round' }

  const crf = firstSpanOf(spans, 'crf')
  if (crf === undefined)
    return { kind: 'not-evaluable', stimulusId, reason: 'no-crf-round' }

  const baselineSample = rateSample(
    events,
    baseline.startMs,
    baseline.endMs,
    baseline.endInclusive,
  )
  if (baselineSample.observedMs === 0)
    return {
      kind: 'not-evaluable',
      stimulusId,
      reason: 'baseline-window-empty',
    }

  // The final `reinforcerEvidenceWindowMs` of CRF, clamped so it can never
  // reach back into an earlier round.
  const crfWindowStart = Math.max(
    crf.startMs,
    crf.endMs - config.reinforcerEvidenceWindowMs,
  )
  const crfSample = rateSample(
    events,
    crfWindowStart,
    crf.endMs,
    crf.endInclusive,
  )
  if (crfSample.observedMs === 0)
    return { kind: 'not-evaluable', stimulusId, reason: 'crf-window-empty' }

  const deliveries: PromptContingentDeliveryCounts = {
    inCrfRound: countPromptContingentDeliveries(
      events,
      stimulusId,
      crf.startMs,
      crf.endMs,
      crf.endInclusive,
    ),
    inSession: countPromptContingentDeliveries(events, stimulusId),
  }

  const comparison = compareRates(
    baselineSample,
    crfSample,
    config.reinforcerEvidenceRelativeIncrease,
    config.reinforcerEvidenceAbsoluteIncrease,
  )

  const unmet: ReinforcerEvidenceCheck[] = []
  if (deliveries.inCrfRound < config.reinforcerEvidenceMinDeliveries)
    unmet.push('min-prompt-contingent-deliveries')
  if (!comparison.relativeThresholdMet) unmet.push('relative-increase')
  if (!comparison.absoluteThresholdMet) unmet.push('absolute-increase')

  if (unmet.length === 0)
    return {
      kind: 'evidence-met',
      stimulusId,
      deliveries,
      comparison,
      thresholds,
    }

  return {
    kind: 'not-demonstrated',
    stimulusId,
    deliveries,
    comparison,
    thresholds,
    unmet,
  }
}

function countPromptContingentDeliveries(
  events: readonly SimEvent[],
  stimulusId: string,
  fromMs = -Infinity,
  toMs = Infinity,
  endInclusive = true,
): number {
  return events.filter(
    (e) =>
      e.type === 'stimulus-delivered' &&
      e.stimulusId === stimulusId &&
      e.timing === 'prompt' &&
      e.contingency === 'response-contingent' &&
      e.at >= fromMs &&
      (endInclusive ? e.at <= toMs : e.at < toMs),
  ).length
}

/**
 * Simulated time of the first criterion met during extinction whose
 * reinforcement was withheld — that is, the first `criterion-met` in the
 * extinction round with no later `stimulus-delivered` carrying the same
 * `responseId`.
 *
 * The anchor is deliberately the withheld criterion itself and not the
 * `criterion-missed` that follows `reinforcementDueWindowMs` later: anchoring
 * on the later event would cut the front off the very interval the rule is
 * meant to inspect.
 */
function firstWithheldCriterionAt(
  events: readonly SimEvent[],
  extinction: PhaseSpan,
): number | undefined {
  const deliveredResponseIds = new Set(
    events
      .filter((e) => e.type === 'stimulus-delivered' && e.responseId !== null)
      .map(
        (e) =>
          (e as Extract<SimEvent, { type: 'stimulus-delivered' }>)
            .responseId as string,
      ),
  )
  const withheld = events.find(
    (e) =>
      e.type === 'criterion-met' &&
      e.at >= extinction.startMs &&
      (extinction.endInclusive
        ? e.at <= extinction.endMs
        : e.at < extinction.endMs) &&
      !deliveredResponseIds.has(e.responseId),
  )
  return withheld?.at
}

/**
 * The extinction-burst detection rule (data model section 5).
 *
 * A burst is reported only when, within `burstDetectionWindowMs` of the first
 * withheld criterion, the response rate is at least `burstRelativeIncrease`
 * above and at least `burstAbsoluteIncrease` per minute above the reference
 * rate.
 *
 * The reference is the response rate over the final
 * `min(reinforcedRoundDurationMs, burstReferenceWindowMs)` of the reinforced
 * round immediately preceding extinction, measured within that round only and
 * never bleeding into an earlier round. If the available reference window is
 * shorter than `burstMinReferenceWindowMs`, the result is `indeterminate`:
 * neither a burst nor a confirmed no-burst.
 *
 * Section 5 specifies a floor for the reference window only, so no minimum is
 * imposed on the detection window; it is merely clamped to the observed end of
 * the extinction round, and a zero-length one is `not-evaluable`.
 */
export function detectExtinctionBurst(
  events: readonly SimEvent[],
  config: SimConfig,
): BurstDetectionResult {
  const thresholds: BurstThresholds = {
    detectionWindowMs: config.burstDetectionWindowMs,
    referenceWindowMs: config.burstReferenceWindowMs,
    minReferenceWindowMs: config.burstMinReferenceWindowMs,
    relativeIncrease: config.burstRelativeIncrease,
    absoluteIncreasePerMinute: config.burstAbsoluteIncrease,
  }

  const spans = phaseSpans(events)
  const extinctionIndex = spans.findIndex((s) => s.phase === 'extinction')
  if (extinctionIndex === -1)
    return { kind: 'not-evaluable', reason: 'no-extinction-round' }
  const extinction = spans[extinctionIndex] as PhaseSpan

  // V1 permits entering extinction from VR only, so this is Round 2 in
  // practice; searching for the nearest reinforced round keeps the rule
  // correct without hard-coding that.
  const reference = spans
    .slice(0, extinctionIndex)
    .reverse()
    .find((s) => s.phase === 'crf' || s.phase === 'vr')
  if (reference === undefined)
    return { kind: 'not-evaluable', reason: 'no-preceding-reinforced-round' }

  const anchorAtMs = firstWithheldCriterionAt(events, extinction)
  if (anchorAtMs === undefined)
    return { kind: 'not-evaluable', reason: 'no-withheld-criterion' }

  const reinforcedRoundDurationMs = Math.max(
    0,
    reference.endMs - reference.startMs,
  )
  const availableReferenceWindowMs = Math.min(
    reinforcedRoundDurationMs,
    config.burstReferenceWindowMs,
  )
  if (availableReferenceWindowMs < config.burstMinReferenceWindowMs)
    return {
      kind: 'indeterminate',
      reason: 'reference-window-too-short',
      anchorAtMs,
      referenceRound: reference.phase,
      availableReferenceWindowMs,
      reinforcedRoundDurationMs,
      thresholds,
    }

  const referenceSample = rateSample(
    events,
    reference.endMs - availableReferenceWindowMs,
    reference.endMs,
    reference.endInclusive,
  )

  const detectionEndMs = Math.min(
    anchorAtMs + config.burstDetectionWindowMs,
    extinction.endMs,
  )
  if (detectionEndMs <= anchorAtMs)
    return { kind: 'not-evaluable', reason: 'detection-window-empty' }

  const detectionSample = rateSample(
    events,
    anchorAtMs,
    detectionEndMs,
    detectionEndMs === extinction.endMs && extinction.endInclusive,
  )

  const comparison = compareRates(
    referenceSample,
    detectionSample,
    config.burstRelativeIncrease,
    config.burstAbsoluteIncrease,
  )

  const unmet: BurstCheck[] = []
  if (!comparison.relativeThresholdMet) unmet.push('relative-increase')
  if (!comparison.absoluteThresholdMet) unmet.push('absolute-increase')

  if (unmet.length === 0)
    return {
      kind: 'burst',
      anchorAtMs,
      referenceRound: reference.phase,
      comparison,
      thresholds,
    }

  return {
    kind: 'no-burst-in-this-run',
    anchorAtMs,
    referenceRound: reference.phase,
    comparison,
    thresholds,
    unmet,
  }
}
