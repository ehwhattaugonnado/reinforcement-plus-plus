import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, DEFAULT_SIM_CONFIG, type SimConfig } from './config'
import type { Phase, SimEvent, Speed } from './events'
import { detectExtinctionBurst, evaluateReinforcerEvidence } from './evidence'

/**
 * Small log-builder helpers for hand-constructed event logs. These build
 * plain `SimEvent[]` arrays directly (no session/projector involved) so the
 * detection rules can be tested as pure functions of the log, independent of
 * the learning/behavior model (per the milestone's scope).
 */

function sessionStarted(speed: Speed = 1): SimEvent {
  return {
    type: 'session-started',
    at: 0,
    seed: 'evidence-test-seed',
    speed,
    configVersion: CONFIG_VERSION,
  }
}

function phaseChanged(at: number, phase: Phase): SimEvent {
  return { type: 'phase-changed', at, phase }
}

/** `count` response-emitted events, evenly and strictly interior to [fromMs, toMs). */
function responsesEvenly(
  fromMs: number,
  toMs: number,
  count: number,
  idPrefix: string,
): SimEvent[] {
  const step = (toMs - fromMs) / count
  return Array.from({ length: count }, (_, i) => ({
    type: 'response-emitted' as const,
    at: fromMs + step * (i + 0.5),
    responseId: `${idPrefix}-${i}`,
  }))
}

function promptContingentDelivery(
  at: number,
  stimulusId: string,
  responseId: string,
): SimEvent {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId,
    responseId,
    latencyMs: 200,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
  }
}

function withheldCriterion(at: number, responseId: string): SimEvent {
  return { type: 'criterion-met', at, responseId, schedule: 'VR' }
}

describe('evaluateReinforcerEvidence', () => {
  // Baseline: 3 responses over 45000ms => 4.0 responses/min (reference rate).
  // CRF: round spans 45000-135000 (90000ms, >= windowMs) so the final-window
  // clamp lands exactly on [75000, 135000), a clean 60000ms window.
  const baselineEvents = [
    phaseChanged(0, 'baseline'),
    ...responsesEvenly(0, 45000, 3, 'base'),
  ]
  const crfPhaseStart = phaseChanged(45000, 'crf')
  // 10 responses inside the final 60s window => 10.0 responses/min.
  const crfResponses = responsesEvenly(75000, 135000, 10, 'crf')
  const eightDeliveries = Array.from({ length: 8 }, (_, i) =>
    promptContingentDelivery(50000 + i * 10000, 'ball', `crf-${i}`),
  )
  const endCrf = phaseChanged(135000, 'vr')

  function buildLog(deliveries: SimEvent[], speed: Speed = 1): SimEvent[] {
    return [
      sessionStarted(speed),
      ...baselineEvents,
      crfPhaseStart,
      ...crfResponses,
      ...deliveries,
      endCrf,
    ]
  }

  it('reports evidence-met when deliveries and both thresholds are satisfied', () => {
    const result = evaluateReinforcerEvidence(
      buildLog(eightDeliveries),
      DEFAULT_SIM_CONFIG,
      'ball',
    )
    expect(result.kind).toBe('evidence-met')
    if (result.kind !== 'evidence-met') throw new Error('unreachable')
    expect(result.deliveries.inCrfRound).toBe(8)
    expect(result.deliveries.inSession).toBe(8)
    expect(result.comparison.reference.perMinute).toBeCloseTo(4.0, 6)
    expect(result.comparison.observed.perMinute).toBeCloseTo(10.0, 6)
    expect(result.comparison.relativeThresholdMet).toBe(true)
    expect(result.comparison.absoluteThresholdMet).toBe(true)
  })

  it('fails only the delivery-count clause when rates pass but deliveries are too few', () => {
    const fewDeliveries = eightDeliveries.slice(0, 5)
    const result = evaluateReinforcerEvidence(
      buildLog(fewDeliveries),
      DEFAULT_SIM_CONFIG,
      'ball',
    )
    expect(result.kind).toBe('not-demonstrated')
    if (result.kind !== 'not-demonstrated') throw new Error('unreachable')
    expect(result.deliveries.inCrfRound).toBe(5)
    expect(result.unmet).toEqual(['min-prompt-contingent-deliveries'])
    expect(result.comparison.relativeThresholdMet).toBe(true)
    expect(result.comparison.absoluteThresholdMet).toBe(true)
  })

  it('fails only the relative-increase clause when the relative threshold is set high', () => {
    const config: SimConfig = {
      ...DEFAULT_SIM_CONFIG,
      reinforcerEvidenceRelativeIncrease: 5.0, // requires obs >= ref * 6 = 24
    }
    const result = evaluateReinforcerEvidence(
      buildLog(eightDeliveries),
      config,
      'ball',
    )
    expect(result.kind).toBe('not-demonstrated')
    if (result.kind !== 'not-demonstrated') throw new Error('unreachable')
    expect(result.unmet).toEqual(['relative-increase'])
    expect(result.comparison.absoluteThresholdMet).toBe(true)
  })

  it('fails only the absolute-increase clause when the absolute threshold is set high', () => {
    const config: SimConfig = {
      ...DEFAULT_SIM_CONFIG,
      reinforcerEvidenceAbsoluteIncrease: 100, // requires obs >= ref + 100
    }
    const result = evaluateReinforcerEvidence(
      buildLog(eightDeliveries),
      config,
      'ball',
    )
    expect(result.kind).toBe('not-demonstrated')
    if (result.kind !== 'not-demonstrated') throw new Error('unreachable')
    expect(result.unmet).toEqual(['absolute-increase'])
    expect(result.comparison.relativeThresholdMet).toBe(true)
  })

  it('is invariant to speed/pause bookkeeping for identical simulated-time behavior', () => {
    // Neither log's `response-emitted`/`stimulus-delivered`/`phase-changed`
    // timestamps differ at all: `at` is already simulated time, so a slower
    // speed must give more wall-clock time without moving any of these
    // timestamps or changing the score. This is the regression the module's
    // own docs warn about (see the `RateSample` doc comment): pause spans
    // must never be subtracted from `observedMs` a second time. Exercise
    // that by interleaving `paused`/`resumed`/`speed-changed` bookkeeping
    // events into the 0.5x log; the rules must ignore them entirely.
    const at1x = evaluateReinforcerEvidence(
      buildLog(eightDeliveries, 1),
      DEFAULT_SIM_CONFIG,
      'ball',
    )
    const withPauseBookkeeping: SimEvent[] = [
      ...buildLog(eightDeliveries, 0.5),
      { type: 'speed-changed', at: 20000, speed: 0.5 },
      { type: 'paused', at: 40000 },
      { type: 'resumed', at: 40000 },
    ]
    const at05x = evaluateReinforcerEvidence(
      withPauseBookkeeping,
      DEFAULT_SIM_CONFIG,
      'ball',
    )
    expect(at05x).toEqual(at1x)
  })

  it('clamps the final CRF window to the round itself, never bleeding into baseline, when CRF is shorter than reinforcerEvidenceWindowMs', () => {
    // Baseline: 3 responses over 45000ms (4.0/min).
    // CRF round is only 20000ms, shorter than the default 60000ms window, so
    // the window clamps to the whole (short) round starting at crf.startMs.
    const shortCrfStart = phaseChanged(45000, 'crf')
    const shortCrfResponses = responsesEvenly(45000, 65000, 5, 'short-crf')
    const shortCrfEnd = phaseChanged(65000, 'vr')
    const log: SimEvent[] = [
      sessionStarted(),
      ...baselineEvents,
      shortCrfStart,
      ...shortCrfResponses,
      shortCrfEnd,
    ]
    const result = evaluateReinforcerEvidence(log, DEFAULT_SIM_CONFIG, 'ball')
    if (result.kind === 'not-evaluable') throw new Error('unreachable')
    expect(result.comparison.observed.fromMs).toBe(45000)
    expect(result.comparison.observed.toMs).toBe(65000)
    expect(result.comparison.observed.responses).toBe(5)
    expect(result.comparison.observed.perMinute).toBeCloseTo(15.0, 6)
  })

  it('is not-evaluable when there is no baseline round', () => {
    const log: SimEvent[] = [
      sessionStarted(),
      crfPhaseStart,
      ...crfResponses,
      ...eightDeliveries,
      endCrf,
    ]
    const result = evaluateReinforcerEvidence(log, DEFAULT_SIM_CONFIG, 'ball')
    expect(result).toEqual({
      kind: 'not-evaluable',
      stimulusId: 'ball',
      reason: 'no-baseline-round',
    })
  })

  it('is not-evaluable when there is no CRF round', () => {
    const log: SimEvent[] = [sessionStarted(), ...baselineEvents]
    const result = evaluateReinforcerEvidence(log, DEFAULT_SIM_CONFIG, 'ball')
    expect(result).toEqual({
      kind: 'not-evaluable',
      stimulusId: 'ball',
      reason: 'no-crf-round',
    })
  })
})

describe('detectExtinctionBurst', () => {
  const DETECTION_WINDOW_MS = DEFAULT_SIM_CONFIG.burstDetectionWindowMs

  function fixedWindowLog(opts: {
    vrStart: number
    vrEnd: number
    vrResponseCount: number
    anchorOffsetMs: number
    detectionResponseCount: number
    detectionEndMs: number
    speed?: Speed
    leadingBaseline?: { start: number; end: number; count: number }
  }): SimEvent[] {
    const events: SimEvent[] = [sessionStarted(opts.speed ?? 1)]
    if (opts.leadingBaseline) {
      events.push(phaseChanged(opts.leadingBaseline.start, 'baseline'))
      events.push(
        ...responsesEvenly(
          opts.leadingBaseline.start,
          opts.leadingBaseline.end,
          opts.leadingBaseline.count,
          'base',
        ),
      )
    }
    events.push(phaseChanged(opts.vrStart, 'vr'))
    events.push(
      ...responsesEvenly(opts.vrStart, opts.vrEnd, opts.vrResponseCount, 'vr'),
    )
    events.push(phaseChanged(opts.vrEnd, 'extinction'))
    const anchorAt = opts.vrEnd + opts.anchorOffsetMs
    events.push(withheldCriterion(anchorAt, 'ext-anchor'))
    events.push(
      ...responsesEvenly(
        anchorAt,
        opts.detectionEndMs,
        opts.detectionResponseCount,
        'ext',
      ),
    )
    events.push(
      phaseChanged(opts.detectionEndMs + DETECTION_WINDOW_MS, 'debrief'),
    )
    return events
  }

  it('detects a clear burst', () => {
    const log = fixedWindowLog({
      vrStart: 0,
      vrEnd: 60000,
      vrResponseCount: 6, // 6/min reference
      anchorOffsetMs: 100,
      detectionResponseCount: 36, // 24/min in the fixed 90000ms detection window
      detectionEndMs: 60100 + DETECTION_WINDOW_MS,
    })
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result.kind).toBe('burst')
    if (result.kind !== 'burst') throw new Error('unreachable')
    expect(result.anchorAtMs).toBe(60100)
    expect(result.referenceRound).toBe('vr')
    expect(result.comparison.reference.perMinute).toBeCloseTo(6.0, 6)
    expect(result.comparison.observed.perMinute).toBeCloseTo(24.0, 6)
    expect(result.comparison.relativeThresholdMet).toBe(true)
    expect(result.comparison.absoluteThresholdMet).toBe(true)
  })

  it('reports no-burst-in-this-run for a clear non-burst', () => {
    const log = fixedWindowLog({
      vrStart: 0,
      vrEnd: 60000,
      vrResponseCount: 12, // 12/min reference; clears burstMinReferenceResponses
      anchorOffsetMs: 100,
      detectionResponseCount: 18, // 12/min: no increase, clears burstMinDetectionResponses
      detectionEndMs: 60100 + DETECTION_WINDOW_MS,
    })
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result.kind).toBe('no-burst-in-this-run')
    if (result.kind !== 'no-burst-in-this-run') throw new Error('unreachable')
    expect(result.comparison.reference.perMinute).toBeCloseTo(12.0, 6)
    expect(result.comparison.observed.perMinute).toBeCloseTo(12.0, 6)
    expect(result.unmet).toEqual(['relative-increase', 'absolute-increase'])
  })

  it('computes the reference over the full preceding round when shorter than burstReferenceWindowMs, without going indeterminate', () => {
    // VR round is 30000ms: shorter than burstReferenceWindowMs (60000) but
    // at/above burstMinReferenceWindowMs (20000).
    const log = fixedWindowLog({
      vrStart: 0,
      vrEnd: 30000,
      vrResponseCount: 3, // 6/min over the whole (clamped) round
      anchorOffsetMs: 100,
      detectionResponseCount: 10, // well above reference: yields a clear burst
      detectionEndMs: 30100 + DETECTION_WINDOW_MS,
    })
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result.kind).not.toBe('indeterminate')
    expect(result.kind).not.toBe('not-evaluable')
    if (result.kind === 'indeterminate' || result.kind === 'not-evaluable')
      throw new Error('unreachable')
    expect(result.comparison.reference.fromMs).toBe(0)
    expect(result.comparison.reference.toMs).toBe(30000)
    expect(result.comparison.reference.perMinute).toBeCloseTo(6.0, 6)
  })

  it('reports indeterminate when the preceding round is shorter than burstMinReferenceWindowMs', () => {
    const log = fixedWindowLog({
      vrStart: 0,
      vrEnd: 10000, // shorter than burstMinReferenceWindowMs (20000)
      vrResponseCount: 1,
      anchorOffsetMs: 100,
      detectionResponseCount: 5,
      detectionEndMs: 10100 + DETECTION_WINDOW_MS,
    })
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result.kind).toBe('indeterminate')
    if (
      result.kind !== 'indeterminate' ||
      result.reason !== 'reference-window-too-short'
    )
      throw new Error('unreachable')
    expect(result.availableReferenceWindowMs).toBe(10000)
    expect(result.reinforcedRoundDurationMs).toBe(10000)
    expect(result.referenceRound).toBe('vr')
  })

  it('keeps the reference window inside the preceding round and never bleeds into an earlier one', () => {
    const log = fixedWindowLog({
      leadingBaseline: { start: 0, end: 20000, count: 20 }, // 60/min, must be excluded
      vrStart: 20000,
      vrEnd: 50000, // 30000ms round
      vrResponseCount: 3, // 6/min, using only the VR round
      anchorOffsetMs: 100,
      detectionResponseCount: 10,
      detectionEndMs: 50100 + DETECTION_WINDOW_MS,
    })
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    if (result.kind === 'indeterminate' || result.kind === 'not-evaluable')
      throw new Error('unreachable')
    expect(result.comparison.reference.fromMs).toBe(20000)
    expect(result.comparison.reference.toMs).toBe(50000)
    expect(result.comparison.reference.responses).toBe(3)
    expect(result.comparison.reference.perMinute).toBeCloseTo(6.0, 6)
  })

  it('is invariant to speed/pause bookkeeping for identical simulated-time behavior', () => {
    // As with the evidence rule: timestamps are already simulated time and
    // must not move with speed, and pause bookkeeping events must be ignored
    // rather than double-subtracted from the observed window.
    const base = {
      vrStart: 0,
      vrEnd: 60000,
      vrResponseCount: 6,
      anchorOffsetMs: 100,
      detectionResponseCount: 12,
      detectionEndMs: 60100 + DETECTION_WINDOW_MS,
    }
    const at1x = detectExtinctionBurst(
      fixedWindowLog({ ...base, speed: 1 }),
      DEFAULT_SIM_CONFIG,
    )
    const withPauseBookkeeping: SimEvent[] = [
      ...fixedWindowLog({ ...base, speed: 0.5 }),
      { type: 'speed-changed', at: 30000, speed: 0.5 },
      { type: 'paused', at: 70000 },
      { type: 'resumed', at: 70000 },
    ]
    const at05x = detectExtinctionBurst(
      withPauseBookkeeping,
      DEFAULT_SIM_CONFIG,
    )
    expect(at05x).toEqual(at1x)
  })

  it('a zero-response reference window is now insufficient-samples, not a confident no-burst -- but the underlying relativeIncrease/relativeThresholdMet agreement still holds on the attached comparison', () => {
    // ref === 0 makes the ordinary ratio undefined, and a reference window
    // with zero responses can never clear burstMinReferenceResponses either, so
    // this is `indeterminate` by construction now (not a confident
    // 'no-burst-in-this-run'). `relativeIncrease` and `relativeThresholdMet`
    // must still never disagree on the comparison this result carries.
    const zeroRefNoObserved = fixedWindowLog({
      vrStart: 0,
      vrEnd: 60000,
      vrResponseCount: 0, // reference rate 0/min: below burstMinReferenceResponses
      anchorOffsetMs: 100,
      detectionResponseCount: 0, // observed rate also 0/min: no increase
      detectionEndMs: 60100 + DETECTION_WINDOW_MS,
    })
    const noIncrease = detectExtinctionBurst(
      zeroRefNoObserved,
      DEFAULT_SIM_CONFIG,
    )
    expect(noIncrease.kind).toBe('indeterminate')
    if (
      noIncrease.kind !== 'indeterminate' ||
      noIncrease.reason !== 'insufficient-samples'
    )
      throw new Error('unreachable')
    expect(noIncrease.comparison.relativeIncrease).toBe(0)
    expect(noIncrease.comparison.relativeThresholdMet).toBe(false)

    const zeroRefWithObserved = fixedWindowLog({
      vrStart: 0,
      vrEnd: 60000,
      vrResponseCount: 0, // reference rate 0/min: below burstMinReferenceResponses
      anchorOffsetMs: 100,
      detectionResponseCount: 5, // any response is an infinite relative increase
      detectionEndMs: 60100 + DETECTION_WINDOW_MS,
    })
    const withIncrease = detectExtinctionBurst(
      zeroRefWithObserved,
      DEFAULT_SIM_CONFIG,
    )
    expect(withIncrease.kind).toBe('indeterminate')
    if (
      withIncrease.kind !== 'indeterminate' ||
      withIncrease.reason !== 'insufficient-samples'
    )
      throw new Error('unreachable')
    expect(withIncrease.comparison.relativeIncrease).toBe(Infinity)
    expect(withIncrease.comparison.relativeThresholdMet).toBe(true)
  })

  describe('sample-count floor (asymmetric: reference and detection windows have different durations and typical counts)', () => {
    it('reports indeterminate when the reference window has fewer than burstMinReferenceResponses responses, even though its duration clears burstMinReferenceWindowMs', () => {
      const log = fixedWindowLog({
        vrStart: 0,
        vrEnd: 60000, // duration clears burstMinReferenceWindowMs (20000)
        vrResponseCount: 2, // below burstMinReferenceResponses (3)
        anchorOffsetMs: 100,
        detectionResponseCount: 12, // would otherwise read as a clear burst
        detectionEndMs: 60100 + DETECTION_WINDOW_MS,
      })
      const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
      expect(result.kind).toBe('indeterminate')
      if (result.kind !== 'indeterminate') throw new Error('unreachable')
      expect(result.reason).toBe('insufficient-samples')
    })

    it('reports indeterminate when the detection window has fewer than burstMinDetectionResponses responses', () => {
      const log = fixedWindowLog({
        vrStart: 0,
        vrEnd: 60000,
        vrResponseCount: 6,
        anchorOffsetMs: 100,
        detectionResponseCount: 3, // below burstMinDetectionResponses (6)
        detectionEndMs: 60100 + DETECTION_WINDOW_MS,
      })
      const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
      expect(result.kind).toBe('indeterminate')
      if (result.kind !== 'indeterminate') throw new Error('unreachable')
      expect(result.reason).toBe('insufficient-samples')
    })

    it('still detects a burst when both windows clear their respective sample-count floors', () => {
      const log = fixedWindowLog({
        vrStart: 0,
        vrEnd: 60000,
        vrResponseCount: 6,
        anchorOffsetMs: 100,
        detectionResponseCount: 36, // 24/min in the fixed 90000ms detection window
        detectionEndMs: 60100 + DETECTION_WINDOW_MS,
      })
      const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
      expect(result.kind).toBe('burst')
    })
  })

  it('is not-evaluable when there is no extinction round', () => {
    const log: SimEvent[] = [
      sessionStarted(),
      phaseChanged(0, 'vr'),
      ...responsesEvenly(0, 60000, 6, 'vr'),
    ]
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result).toEqual({
      kind: 'not-evaluable',
      reason: 'no-extinction-round',
    })
  })

  it('is not-evaluable when there is no preceding reinforced round', () => {
    const log: SimEvent[] = [
      sessionStarted(),
      phaseChanged(0, 'baseline'),
      ...responsesEvenly(0, 20000, 4, 'base'),
      phaseChanged(20000, 'extinction'),
      withheldCriterion(20100, 'ext-anchor'),
    ]
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result).toEqual({
      kind: 'not-evaluable',
      reason: 'no-preceding-reinforced-round',
    })
  })

  it('is not-evaluable when no criterion in extinction was ever withheld', () => {
    const log: SimEvent[] = [
      sessionStarted(),
      phaseChanged(0, 'vr'),
      ...responsesEvenly(0, 60000, 6, 'vr'),
      phaseChanged(60000, 'extinction'),
      withheldCriterion(60100, 'ext-anchor'),
      promptContingentDelivery(60200, 'ball', 'ext-anchor'), // reinforced, not withheld
    ]
    const result = detectExtinctionBurst(log, DEFAULT_SIM_CONFIG)
    expect(result).toEqual({
      kind: 'not-evaluable',
      reason: 'no-withheld-criterion',
    })
  })
})
