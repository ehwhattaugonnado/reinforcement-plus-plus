import { describe, expect, it } from 'vitest'
import { DEFAULT_SIM_CONFIG } from './config'
import {
  classifyDelivery,
  crfAcquisitionMet,
  crfCoachingDue,
  deriveCrfMetrics,
  deriveOutstandingCycle,
} from './crf'
import type { Phase, SimEvent } from './events'

const config = DEFAULT_SIM_CONFIG

function response(at: number, responseId: string): SimEvent {
  return { type: 'response-emitted', at, responseId }
}

function criterionMet(at: number, responseId: string): SimEvent {
  return { type: 'criterion-met', at, responseId, schedule: 'CRF' }
}

function delivered(
  at: number,
  overrides: Partial<Extract<SimEvent, { type: 'stimulus-delivered' }>> = {},
): Extract<SimEvent, { type: 'stimulus-delivered' }> {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId: 'treat',
    responseId: null,
    latencyMs: null,
    contingency: 'noncontingent',
    timing: 'no-response',
    scheduleFidelity: 'not-applicable',
    schedule: 'CRF',
    ...overrides,
  }
}

function abandoned(
  at: number,
  reason: 'due-window-elapsed' | 'round-ended' = 'due-window-elapsed',
): SimEvent {
  return { type: 'cycle-abandoned', at, reason }
}

function criterionMissed(at: number, responseId: string): SimEvent {
  return { type: 'criterion-missed', at, responseId }
}

function phaseChanged(at: number, phase: Phase): SimEvent {
  return { type: 'phase-changed', at, phase }
}

describe('deriveOutstandingCycle', () => {
  it('is null before any criterion has been met', () => {
    expect(deriveOutstandingCycle([], config)).toBeNull()
    expect(deriveOutstandingCycle([response(0, 'r1')], config)).toBeNull()
  })

  it('ignores VR-stamped withheld criteria used by extinction detection', () => {
    expect(
      deriveOutstandingCycle(
        [
          response(100, 'r1'),
          { type: 'criterion-met', at: 100, responseId: 'r1', schedule: 'VR' },
        ],
        config,
      ),
    ).toBeNull()
  })

  it('opens on criterion-met and reports the due-by instant', () => {
    const events = [response(0, 'r1'), criterionMet(0, 'r1')]
    const cycle = deriveOutstandingCycle(events, config)
    expect(cycle).toEqual({
      responseId: 'r1',
      metAtMs: 0,
      dueByMs: config.reinforcementDueWindowMs,
    })
  })

  it('closes on a response-contingent delivery', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      delivered(200, { responseId: 'r1', contingency: 'response-contingent' }),
    ]
    expect(deriveOutstandingCycle(events, config)).toBeNull()
  })

  it('does not close on a noncontingent delivery', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      delivered(200, { contingency: 'noncontingent' }),
    ]
    expect(deriveOutstandingCycle(events, config)).not.toBeNull()
  })

  it('closes on cycle-abandoned', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      criterionMissed(10000, 'r1'),
      abandoned(10000),
    ]
    expect(deriveOutstandingCycle(events, config)).toBeNull()
  })

  it('stays outstanding through extra unconsumed responses', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      response(200, 'r2'),
    ]
    expect(deriveOutstandingCycle(events, config)).toEqual({
      responseId: 'r1',
      metAtMs: 0,
      dueByMs: config.reinforcementDueWindowMs,
    })
  })
})

describe('CRF metric schedule attribution', () => {
  it('does not absorb a VR delivery sharing the CRF round boundary timestamp', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'crf'),
      response(100, 'crf-r'),
      criterionMet(100, 'crf-r'),
      delivered(100, {
        responseId: 'crf-r',
        contingency: 'response-contingent',
        timing: 'prompt',
        latencyMs: 0,
        scheduleFidelity: 'on-schedule',
      }),
      phaseChanged(200, 'vr'),
      delivered(200, {
        responseId: 'vr-r',
        contingency: 'response-contingent',
        timing: 'prompt',
        latencyMs: 0,
        scheduleFidelity: 'on-schedule',
        schedule: 'VR',
      }),
    ]
    expect(deriveCrfMetrics(events, 0, 200).deliveries).toBe(1)
    expect(deriveCrfMetrics(events, 0, 200).onScheduleDeliveries).toBe(1)
  })
})

describe('classifyDelivery: independent classification combinations', () => {
  it('{noncontingent, no-response, not-applicable}: no response has occurred at all', () => {
    const result = classifyDelivery([], 5000, config)
    expect(result).toEqual({
      responseId: null,
      latencyMs: null,
      contingency: 'noncontingent',
      timing: 'no-response',
      scheduleFidelity: 'not-applicable',
    })
  })

  it('{response-contingent, prompt, on-schedule}: delivered promptly for the first eligible response', () => {
    const events = [response(0, 'r1'), criterionMet(0, 'r1')]
    const result = classifyDelivery(events, 200, config)
    expect(result).toEqual({
      responseId: 'r1',
      latencyMs: 200,
      contingency: 'response-contingent',
      timing: 'prompt',
      scheduleFidelity: 'on-schedule',
    })
  })

  it('{response-contingent, delayed, on-schedule}: independence cell -- late but still the only response', () => {
    const events = [response(0, 'r1'), criterionMet(0, 'r1')]
    const result = classifyDelivery(events, 3000, config)
    expect(result.contingency).toBe('response-contingent')
    expect(result.timing).toBe('delayed')
    expect(result.scheduleFidelity).toBe('on-schedule')
    expect(result.latencyMs).toBe(3000)
  })

  it('{response-contingent, prompt, overrun}: independence cell -- extra response piled up before a still-prompt delivery', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      response(200, 'r2'),
    ]
    const result = classifyDelivery(events, 1400, config)
    expect(result.contingency).toBe('response-contingent')
    expect(result.timing).toBe('prompt')
    expect(result.scheduleFidelity).toBe('overrun')
    // Credited to the response that opened the cycle, not the extra one.
    expect(result.responseId).toBe('r1')
    expect(result.latencyMs).toBe(1400)
  })

  it('{response-contingent, delayed, overrun}: extra response and a slow delivery', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      response(500, 'r2'),
    ]
    const result = classifyDelivery(events, 4000, config)
    expect(result.timing).toBe('delayed')
    expect(result.scheduleFidelity).toBe('overrun')
  })

  it('{response-contingent, *, premature}: a response occurred but its criterion was never met (pure-function only; unreachable via live CRF)', () => {
    const events = [response(0, 'r1')] // no criterion-met
    const result = classifyDelivery(events, 200, config)
    expect(result).toEqual({
      responseId: 'r1',
      latencyMs: 200,
      contingency: 'response-contingent',
      timing: 'prompt',
      scheduleFidelity: 'premature',
    })
  })

  it('{noncontingent, no-response, not-applicable} after a double delivery with no new response', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      delivered(200, { responseId: 'r1', contingency: 'response-contingent' }),
    ]
    const result = classifyDelivery(events, 500, config)
    expect(result).toEqual({
      responseId: null,
      latencyMs: null,
      contingency: 'noncontingent',
      timing: 'no-response',
      scheduleFidelity: 'not-applicable',
    })
  })

  it('a late delivery after the cycle already timed out and was abandoned is noncontingent, not premature', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      criterionMissed(10000, 'r1'),
      abandoned(10000),
    ]
    const result = classifyDelivery(events, 10500, config)
    expect(result).toEqual({
      responseId: null,
      latencyMs: null,
      contingency: 'noncontingent',
      timing: 'no-response',
      scheduleFidelity: 'not-applicable',
    })
  })

  it('a fresh response after an abandonment opens a new, independently classified cycle', () => {
    const events = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      criterionMissed(10000, 'r1'),
      abandoned(10000),
      response(10600, 'r2'),
      criterionMet(10600, 'r2'),
    ]
    const result = classifyDelivery(events, 10800, config)
    expect(result).toEqual({
      responseId: 'r2',
      latencyMs: 200,
      contingency: 'response-contingent',
      timing: 'prompt',
      scheduleFidelity: 'on-schedule',
    })
  })
})

describe('the one-abandoned-cycle-per-timeout invariant', () => {
  it('a single elapsed due window contributes exactly one criterion-missed and one cycle-abandoned', () => {
    // This mirrors what session.ts's tick() commits on timeout; the test
    // proves the *shape* callers must produce, independent of session.ts's
    // clock-walking mechanics.
    const events: SimEvent[] = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      criterionMissed(config.reinforcementDueWindowMs, 'r1'),
      abandoned(config.reinforcementDueWindowMs, 'due-window-elapsed'),
    ]
    const metrics = deriveCrfMetrics(events)
    expect(metrics.missedCriteria).toBe(1)
    expect(metrics.abandonedCycles).toBe(1)
    // The denominator counted the abandonment once, not twice.
    expect(
      metrics.onScheduleDeliveries +
        metrics.overrunDeliveries +
        metrics.abandonedCycles,
    ).toBe(1)
  })

  it('a burst of unreinforced responding within one due window still produces exactly one abandonment, not one per response', () => {
    const events: SimEvent[] = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      response(1000, 'r2'),
      response(2000, 'r3'),
      response(3000, 'r4'),
      criterionMissed(config.reinforcementDueWindowMs, 'r1'),
      abandoned(config.reinforcementDueWindowMs, 'due-window-elapsed'),
    ]
    const missed = events.filter((e) => e.type === 'criterion-missed')
    const abandonedCycles = events.filter((e) => e.type === 'cycle-abandoned')
    expect(missed.length).toBe(1)
    expect(abandonedCycles.length).toBe(1)

    const metrics = deriveCrfMetrics(events)
    expect(metrics.missedCriteria).toBe(1)
    expect(metrics.abandonedCycles).toBe(1)
  })

  it('never treats criterion-missed as contributing to the fidelity denominator directly', () => {
    // A log with only criterion-missed events (no cycle-abandoned) must not
    // move the denominator -- callers always emit both together, but this
    // guards the metric function itself against double-counting if that
    // invariant were ever violated upstream.
    const events: SimEvent[] = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      criterionMissed(config.reinforcementDueWindowMs, 'r1'),
    ]
    const metrics = deriveCrfMetrics(events)
    expect(metrics.missedCriteria).toBe(1)
    expect(metrics.abandonedCycles).toBe(0)
  })
})

describe('deriveCrfMetrics', () => {
  it('computes contingent/prompt rates, fidelity, and median latency from a mixed log', () => {
    const events: SimEvent[] = [
      response(0, 'r1'),
      criterionMet(0, 'r1'),
      delivered(200, {
        responseId: 'r1',
        latencyMs: 200,
        contingency: 'response-contingent',
        timing: 'prompt',
        scheduleFidelity: 'on-schedule',
      }),
      response(1000, 'r2'),
      criterionMet(1000, 'r2'),
      delivered(4000, {
        responseId: 'r2',
        latencyMs: 3000,
        contingency: 'response-contingent',
        timing: 'delayed',
        scheduleFidelity: 'on-schedule',
      }),
      delivered(4500, {
        contingency: 'noncontingent',
        timing: 'no-response',
        scheduleFidelity: 'not-applicable',
      }),
    ]
    const metrics = deriveCrfMetrics(events)
    expect(metrics.deliveries).toBe(3)
    expect(metrics.contingentDeliveries).toBe(2)
    expect(metrics.noncontingentDeliveries).toBe(1)
    expect(metrics.onScheduleDeliveries).toBe(2)
    expect(metrics.contingentDeliveryRate).toBeCloseTo(2 / 3)
    expect(metrics.promptDeliveryRate).toBeCloseTo(1 / 2)
    expect(metrics.scheduleFidelity).toBe(1)
    expect(metrics.medianLatencyMs).toBe(1600) // median of [200, 3000]
  })

  it('reports null rates when there is nothing to divide by', () => {
    const metrics = deriveCrfMetrics([])
    expect(metrics.contingentDeliveryRate).toBeNull()
    expect(metrics.promptDeliveryRate).toBeNull()
    expect(metrics.scheduleFidelity).toBeNull()
    expect(metrics.medianLatencyMs).toBeNull()
  })
})

describe('crfAcquisitionMet / crfCoachingDue', () => {
  function buildAcquiredLog(): SimEvent[] {
    const events: SimEvent[] = [
      phaseChanged(0, 'baseline'),
      // Sparse baseline responses over 45s so the event-derived baseline
      // rate is low relative to the CRF acquisition window below.
      response(5000, 'b1'),
      response(20000, 'b2'),
      phaseChanged(45000, 'crf'),
    ]
    // Ten on-schedule cycles, evenly spaced 500ms apart within the final
    // acquisition window, well above the low baseline rate.
    let at = 45000
    for (let i = 1; i <= 10; i++) {
      at += 500
      const responseId = `r${i}`
      events.push(response(at, responseId))
      events.push(criterionMet(at, responseId))
      events.push(
        delivered(at + 100, {
          responseId,
          latencyMs: 100,
          contingency: 'response-contingent',
          timing: 'prompt',
          scheduleFidelity: 'on-schedule',
        }),
      )
    }
    return events
  }

  it('is not met before crfMinOnScheduleDeliveries or before the rate threshold, and is met once both hold', () => {
    const events = buildAcquiredLog()
    const lastAt = (events[events.length - 1] as { at: number }).at
    expect(crfAcquisitionMet(events, lastAt, config)).toBe(true)

    // Fewer on-schedule deliveries: gate must not be met.
    const short = events.slice(0, events.length - 15) // trims several cycles
    const shortLastAt = (short[short.length - 1] as { at: number }).at
    expect(crfAcquisitionMet(short, shortLastAt, config)).toBe(false)
  })

  it('is false with no baseline round in the log', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'crf'),
      response(100, 'r1'),
      criterionMet(100, 'r1'),
    ]
    expect(crfAcquisitionMet(events, 100, config)).toBe(false)
  })

  it('crfCoachingDue is false before crfCoachingPauseMs and true after, when the gate is unmet', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'baseline'),
      phaseChanged(45000, 'crf'),
    ]
    expect(
      crfCoachingDue(events, 45000 + config.crfCoachingPauseMs - 1, config),
    ).toBe(false)
    expect(
      crfCoachingDue(events, 45000 + config.crfCoachingPauseMs, config),
    ).toBe(true)
  })

  it('crfCoachingDue is false once acquisition is met, even after the round has run past the pause instant', () => {
    // Build a log whose CRF round has genuinely run for longer than
    // crfCoachingPauseMs, with all ten acquisition cycles inside the final
    // crfAcquisitionWindowMs so the rolling rate window still sees them.
    const events: SimEvent[] = [
      phaseChanged(0, 'baseline'),
      response(5000, 'b1'),
      response(20000, 'b2'),
      phaseChanged(45000, 'crf'),
    ]
    const roundLengthMs = config.crfCoachingPauseMs + 10000
    const acquisitionStartAt =
      45000 + roundLengthMs - config.crfAcquisitionWindowMs
    let at = acquisitionStartAt
    for (let i = 1; i <= 10; i++) {
      at += config.crfAcquisitionWindowMs / 11
      const responseId = `r${i}`
      events.push(response(at, responseId))
      events.push(criterionMet(at, responseId))
      events.push(
        delivered(at + 100, {
          responseId,
          latencyMs: 100,
          contingency: 'response-contingent',
          timing: 'prompt',
          scheduleFidelity: 'on-schedule',
        }),
      )
    }
    const nowMs = 45000 + roundLengthMs
    expect(crfAcquisitionMet(events, nowMs, config)).toBe(true)
    expect(crfCoachingDue(events, nowMs, config)).toBe(false)
  })

  it('crfCoachingDue is false once the round has ended', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'baseline'),
      phaseChanged(45000, 'crf'),
      phaseChanged(45000 + config.crfCoachingPauseMs + 1, 'vr'),
    ]
    expect(
      crfCoachingDue(events, 45000 + config.crfCoachingPauseMs + 1000, config),
    ).toBe(false)
  })
})
