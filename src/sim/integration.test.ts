import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, DEFAULT_SIM_CONFIG } from './config'
import type { SimEvent, Speed } from './events'
import { applyEvents } from './project'
import { replay } from './replay'
import { evaluateReinforcerEvidence } from './evidence'
import { buildResponseRateChartData } from './chart-data'
import { computeResponseRatePerMinute } from './learning'
import { createInitialState } from './initial-state'

/**
 * Every other test file in this milestone fan-out verified its own slice in
 * isolation: Milestone 6 against hand-constructed logs, Milestone 7 against
 * fixture logs, Milestone 3 against a live session tested alone. Nothing
 * proved that a *single* realistic log means the same thing to all three
 * consumers — that they agree on field names, round boundaries, and what
 * counts as "the CRF round's response rate". This file is that proof.
 *
 * The log below is still hand-constructed rather than driven through
 * `session.deliverStimulus` (now real as of Milestone 4; see `crf.test.ts`
 * and `session.test.ts`'s "CRF acquisition" suite for tests that exercise
 * live classification). Keeping this one hand-built isolates it from the
 * live response-generation RNG, so it stays a fast, exact proof that every
 * downstream consumer agrees on field names and round boundaries for one
 * fixed, realistic log.
 */

const SEED = 'integration-seed'
const STIMULUS = 'treat'

function sessionStarted(speed: Speed = 1): SimEvent {
  return {
    type: 'session-started',
    at: 0,
    seed: SEED,
    speed,
    configVersion: CONFIG_VERSION,
  }
}

function buildRealisticLog(): SimEvent[] {
  const events: SimEvent[] = [sessionStarted()]

  // Baseline: 45s, ~3 responses/min -> ~2 responses, evenly spaced.
  events.push({ type: 'phase-changed', at: 0, phase: 'baseline' })
  const baselineEndMs = DEFAULT_SIM_CONFIG.baselineDurationMs
  for (const at of [15000, 30000]) {
    events.push({ type: 'response-emitted', at, responseId: `baseline-${at}` })
  }

  // CRF: 8 prompt-contingent deliveries of `treat`, well past the
  // acquisition gate, at a visibly elevated rate inside the evidence window.
  const crfStartMs = baselineEndMs
  events.push({ type: 'phase-changed', at: crfStartMs, phase: 'crf' })
  const deliveryCount = 8
  const spacingMs = 6000
  for (let i = 0; i < deliveryCount; i++) {
    const responseAt = crfStartMs + 5000 + i * spacingMs
    const deliveryAt = responseAt + 400
    const responseId = `crf-${i}`
    events.push({ type: 'response-emitted', at: responseAt, responseId })
    events.push({
      type: 'criterion-met',
      at: responseAt,
      responseId,
      schedule: 'CRF',
    })
    events.push({
      type: 'stimulus-delivered',
      at: deliveryAt,
      stimulusId: STIMULUS,
      responseId,
      latencyMs: 400,
      contingency: 'response-contingent',
      timing: 'prompt',
      scheduleFidelity: 'on-schedule',
    })
  }
  const crfEndMs = crfStartMs + 5000 + deliveryCount * spacingMs
  events.push({ type: 'phase-changed', at: crfEndMs, phase: 'vr' })

  return events
}

describe('cross-milestone log composition', () => {
  it('produces a log every downstream consumer can read', () => {
    const events = buildRealisticLog()

    const initial = createInitialState(SEED, 1, DEFAULT_SIM_CONFIG)
    const folded = applyEvents(initial, events, DEFAULT_SIM_CONFIG)
    expect(folded.phase).toBe('vr')
    expect(folded.events).toHaveLength(events.length)
  })

  it('replays this log to an identical snapshot', () => {
    const events = buildRealisticLog()
    const initial = createInitialState(SEED, 1, DEFAULT_SIM_CONFIG)
    const live = applyEvents(initial, events, DEFAULT_SIM_CONFIG)

    const result = replay(SEED, events)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual(live)
  })

  it('the CRF acquisition history clears the reinforcer-evidence rule', () => {
    const events = buildRealisticLog()

    const result = evaluateReinforcerEvidence(
      events,
      DEFAULT_SIM_CONFIG,
      STIMULUS,
    )
    expect(result.kind).toBe('evidence-met')
  })

  it('the evidence rule and the chart data agree on the CRF round response rate', () => {
    const events = buildRealisticLog()

    const evidence = evaluateReinforcerEvidence(
      events,
      DEFAULT_SIM_CONFIG,
      STIMULUS,
    )
    expect(evidence.kind).toBe('evidence-met')
    if (evidence.kind !== 'evidence-met') return

    const chart = buildResponseRateChartData(events)
    const crfRound = chart.byRound.find((r) => r.round === 'crf')
    expect(crfRound).toBeDefined()

    // Both are "responses per minute over the final reinforcerEvidenceWindowMs
    // of CRF" vs "the whole CRF round" respectively, so they need not be
    // numerically identical -- but they must be close, since this log's CRF
    // round is short enough that the two windows mostly overlap. A large
    // disagreement here would mean the two modules are computing "CRF rate"
    // from different event sets.
    expect(crfRound?.ratePerMinute).toBeGreaterThan(0)
    expect(
      Math.abs(
        (crfRound?.ratePerMinute ?? 0) - evidence.comparison.observed.perMinute,
      ),
    ).toBeLessThan(3)
  })

  it('learning.ts and chart-data.ts agree on the response rate at the end of CRF', () => {
    const events = buildRealisticLog()
    const initial = createInitialState(SEED, 1, DEFAULT_SIM_CONFIG)
    const folded = applyEvents(initial, events, DEFAULT_SIM_CONFIG)

    // learning.ts's live, continuously-updated rate as of the last event.
    const lastAt = folded.events[folded.events.length - 1]?.at ?? 0
    const liveRate = computeResponseRatePerMinute(
      folded.events,
      lastAt,
      DEFAULT_SIM_CONFIG,
      folded.creature,
    )

    const chart = buildResponseRateChartData(events)
    const crfRound = chart.byRound.find((r) => r.round === 'crf')
    expect(crfRound).toBeDefined()

    // learning.ts's rate is instantaneous (decays from the most recent
    // consequence); chart-data's is an average over the whole round. They
    // measure different things and are not expected to match closely, but
    // both must be well above the baseline rate for the same log, or one of
    // them is reading the wrong event set.
    const baselineRound = chart.byRound.find((r) => r.round === 'baseline')
    expect(liveRate).toBeGreaterThan(baselineRound?.ratePerMinute ?? 0)
    expect(crfRound?.ratePerMinute).toBeGreaterThan(
      baselineRound?.ratePerMinute ?? 0,
    )
  })
})
