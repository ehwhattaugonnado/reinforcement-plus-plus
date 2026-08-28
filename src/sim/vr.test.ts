import { describe, expect, it } from 'vitest'
import { DEFAULT_SIM_CONFIG } from './config'
import type { SimEvent } from './events'
import {
  classifyVrDelivery,
  deriveVrScheduleState,
  vrCoachingDue,
  vrCyclesCompleted,
  vrRoundWindow,
  vrTrialHistory,
} from './vr'

const config = DEFAULT_SIM_CONFIG

function phaseChanged(
  at: number,
  phase: 'crf' | 'vr' | 'extinction',
): SimEvent {
  return { type: 'phase-changed', at, phase }
}

function response(at: number, responseId: string): SimEvent {
  return { type: 'response-emitted', at, responseId }
}

function vrDelivery(
  at: number,
  responseId: string,
  scheduleFidelity: 'on-schedule' | 'premature' | 'overrun' | 'not-variable',
): SimEvent {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId: 'treat',
    responseId,
    latencyMs: 100,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity,
    schedule: 'VR',
  }
}

function crfDelivery(at: number, responseId: string): SimEvent {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId: 'treat',
    responseId,
    latencyMs: 50,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
    schedule: 'CRF',
  }
}

/** Enters VR and responds `n` times at 1000ms intervals starting at `startMs`. */
function respondN(startMs: number, n: number, prefix = 'r'): SimEvent[] {
  return Array.from({ length: n }, (_, i) =>
    response(startMs + i * 1000, `${prefix}${i}`),
  )
}

describe('classifyVrDelivery', () => {
  it('is noncontingent/not-applicable when there is no unconsumed response', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr')]
    const result = classifyVrDelivery(events, 500, config)
    expect(result).toEqual({
      responseId: null,
      latencyMs: null,
      contingency: 'noncontingent',
      timing: 'no-response',
      scheduleFidelity: 'not-applicable',
    })
  })

  it('accepts a gap of 3 on the very first delivery of the round (seeded average stays at exactly 3)', () => {
    // seed: three phantom 3's. Hypothetical average with a real gap of 3:
    // (3+3+3+3)/4 = 3, in [2,4].
    const events: SimEvent[] = [phaseChanged(0, 'vr'), ...respondN(1000, 3)]
    const atMs = 1000 + 3 * 1000
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('on-schedule')
    expect(result.contingency).toBe('response-contingent')
  })

  it('accepts a gap of 2 on the very first delivery of the round (matches the reported live bug)', () => {
    // (3+3+3+2)/4 = 2.75, in [2,4] -- this is the exact case a live tester
    // hit and was wrongly rejected under the old exact-per-cycle design.
    const events: SimEvent[] = [phaseChanged(0, 'vr'), ...respondN(1000, 2)]
    const atMs = 1000 + 2 * 1000
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('on-schedule')
  })

  it('has no floor: a gap of 1 is judged purely by the hypothetical average, and can be accepted', () => {
    // (3+3+3+1)/4 = 2.5, still in [2,4] -- no special-cased minimum blocks
    // this, unlike the rejected hard-floor design in ADR 0010.
    const events: SimEvent[] = [phaseChanged(0, 'vr'), ...respondN(1000, 1)]
    const atMs = 1000 + 1 * 1000
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('on-schedule')
  })

  it('classifies premature when the hypothetical average would fall below the minimum', () => {
    // Construct a history where the real average is already pinned low
    // enough that even a moderate gap keeps the hypothetical average under 2.
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      ...respondN(1000, 1),
      vrDelivery(2000, 'r0', 'on-schedule'), // real gap 1, on-schedule (avg (9+1)/4=2.5)
      ...respondN(3000, 1, 's'),
      vrDelivery(4000, 's0', 'on-schedule'), // real gap 1, avg (9+1+1)/5=2.2
      ...respondN(5000, 1, 't'),
    ]
    // Candidate gap 1 again: hypothetical avg (9+1+1+1)/6 = 2.0 -- still
    // exactly at the boundary (accepted, inclusive). Push one more identical
    // low-gap real acceptance to drive the average under 2 for the next one.
    const afterThird = [
      ...events,
      vrDelivery(5500, 't0', 'on-schedule'), // avg (9+1+1+1)/6=2.0, accepted
      ...respondN(6000, 1, 'u'),
    ]
    // Now: acceptedGaps=[1,1,1], hypothetical with gap=1: (9+3)/7=1.714 < 2.
    const result = classifyVrDelivery(afterThird, 6500, config)
    expect(result.scheduleFidelity).toBe('premature')
  })

  it('classifies overrun when the hypothetical average would exceed the maximum', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr'), ...respondN(1000, 20)]
    const atMs = 1000 + 20 * 1000
    // (9+20)/4 = 7.25, well above 4.
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('overrun')
  })

  it('the phantom seed alone never triggers not-variable, even when the first real gaps repeat the seed value', () => {
    // Three real deliveries of gap 3 in a row would match the pattern
    // threshold (3) -- but the check must only ever match against *real*
    // accepted gaps, so the very first of these three cannot be flagged
    // (there are zero real gaps yet to compare against).
    const events: SimEvent[] = [phaseChanged(0, 'vr'), ...respondN(1000, 3)]
    const atMs = 1000 + 3 * 1000
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('on-schedule')
  })

  it('classifies not-variable once vrPatternRepeatThreshold identical real gaps would repeat', () => {
    let events: SimEvent[] = [phaseChanged(0, 'vr')]
    let t = 0
    // Two real accepted gaps of 3.
    for (let cycle = 0; cycle < 2; cycle++) {
      events = [...events, ...respondN(t + 1000, 3, `c${cycle}-`)]
      t += 3000
      events = [...events, vrDelivery(t + 500, `c${cycle}-2`, 'on-schedule')]
      t += 500
    }
    // A third gap of 3 would make it three-in-a-row identical.
    events = [...events, ...respondN(t + 1000, 3, 'c2-')]
    const atMs = t + 1000 + 3 * 1000
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('not-variable')
  })

  it('a varied gap breaks the pattern and is on-schedule even after two identical real gaps', () => {
    let events: SimEvent[] = [phaseChanged(0, 'vr')]
    let t = 0
    for (let cycle = 0; cycle < 2; cycle++) {
      events = [...events, ...respondN(t + 1000, 3, `c${cycle}-`)]
      t += 3000
      events = [...events, vrDelivery(t + 500, `c${cycle}-2`, 'on-schedule')]
      t += 500
    }
    // A gap of 4 this time -- breaks the run of identical 3's.
    events = [...events, ...respondN(t + 1000, 4, 'c2-')]
    const atMs = t + 1000 + 4 * 1000
    const result = classifyVrDelivery(events, atMs, config)
    expect(result.scheduleFidelity).toBe('on-schedule')
  })

  it('a not-variable delivery does not join the accepted-gap history (does not further entrench the repeated value)', () => {
    let events: SimEvent[] = [phaseChanged(0, 'vr')]
    let t = 0
    for (let cycle = 0; cycle < 2; cycle++) {
      events = [...events, ...respondN(t + 1000, 3, `c${cycle}-`)]
      t += 3000
      events = [...events, vrDelivery(t + 500, `c${cycle}-2`, 'on-schedule')]
      t += 500
    }
    events = [...events, ...respondN(t + 1000, 3, 'c2-')]
    const notVariableAtMs = t + 1000 + 3 * 1000
    // Confirm it is indeed not-variable, then verify the state derived from
    // a log where this delivery was recorded as not-variable still shows
    // only two accepted gaps.
    const classification = classifyVrDelivery(events, notVariableAtMs, config)
    expect(classification.scheduleFidelity).toBe('not-variable')
    const withNotVariableDelivery: SimEvent[] = [
      ...events,
      vrDelivery(notVariableAtMs + 10, 'c2-2', 'not-variable'),
    ]
    const state = deriveVrScheduleState(withNotVariableDelivery, config)
    expect(state.acceptedGaps).toEqual([3, 3])
  })
})

describe('deriveVrScheduleState', () => {
  it('on fresh entry into VR, no responses counted and the average is the pure seed', () => {
    const events = [phaseChanged(0, 'vr')]
    const state = deriveVrScheduleState(events, config)
    expect(state.responsesSinceReinforcement).toBe(0)
    expect(state.acceptedGaps).toEqual([])
    expect(state.runningAverage).toBe(3)
  })

  it('counts responses since entering VR toward responsesSinceReinforcement', () => {
    const events = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      response(2000, 'r2'),
    ]
    const state = deriveVrScheduleState(events, config)
    expect(state.responsesSinceReinforcement).toBe(2)
  })

  it('does not count a response from before entering VR (a prior CRF response)', () => {
    const events = [
      phaseChanged(0, 'crf'),
      response(500, 'crf-r1'),
      phaseChanged(1000, 'vr'),
      response(2000, 'r1'),
    ]
    const state = deriveVrScheduleState(events, config)
    expect(state.responsesSinceReinforcement).toBe(1)
  })

  it('an on-schedule VR delivery resets responsesSinceReinforcement and joins acceptedGaps', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      ...respondN(1000, 3),
      vrDelivery(4000, 'r2', 'on-schedule'),
      response(5000, 'next'),
    ]
    const state = deriveVrScheduleState(events, config)
    expect(state.acceptedGaps).toEqual([3])
    expect(state.responsesSinceReinforcement).toBe(1)
  })

  it('a premature or overrun VR delivery still resets responsesSinceReinforcement but does not join acceptedGaps', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      ...respondN(1000, 5),
      vrDelivery(6000, 'r4', 'overrun'),
      response(7000, 'next'),
    ]
    const state = deriveVrScheduleState(events, config)
    expect(state.acceptedGaps).toEqual([])
    expect(state.responsesSinceReinforcement).toBe(1)
  })

  it('a CRF delivery never counts toward VR acceptedGaps even if it happens during the VR round window bounds', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      ...respondN(1000, 3),
      crfDelivery(4000, 'r2'),
    ]
    const state = deriveVrScheduleState(events, config)
    expect(state.acceptedGaps).toEqual([])
  })

  it('the running average reflects real accepted gaps blended with the phantom seed', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      ...respondN(1000, 2),
      vrDelivery(3000, 'r1', 'on-schedule'),
    ]
    const state = deriveVrScheduleState(events, config)
    // (3+3+3+2)/4 = 2.75
    expect(state.runningAverage).toBeCloseTo(2.75, 5)
  })
})

describe('vrRoundWindow', () => {
  it('is null when VR was never entered', () => {
    expect(vrRoundWindow([phaseChanged(0, 'crf')])).toBeNull()
  })

  it('is open-ended while VR is the current phase', () => {
    const window = vrRoundWindow([
      phaseChanged(0, 'crf'),
      phaseChanged(1000, 'vr'),
    ])
    expect(window).toEqual({ startMs: 1000, endMs: null })
  })

  it('closes at the next phase change away from VR', () => {
    const window = vrRoundWindow([
      phaseChanged(0, 'crf'),
      phaseChanged(1000, 'vr'),
      phaseChanged(50000, 'extinction'),
    ])
    expect(window).toEqual({ startMs: 1000, endMs: 50000 })
  })
})

describe('vrCyclesCompleted', () => {
  it('is 0 before VR starts', () => {
    expect(vrCyclesCompleted([phaseChanged(0, 'crf')])).toBe(0)
  })

  it('counts on-schedule VR deliveries directly by the schedule field', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      vrDelivery(1000, 'a', 'on-schedule'),
      vrDelivery(2000, 'b', 'on-schedule'),
      vrDelivery(3000, 'c', 'on-schedule'),
    ]
    expect(vrCyclesCompleted(events)).toBe(3)
  })

  it('does not count premature, overrun, or not-variable VR deliveries', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      vrDelivery(1000, 'a', 'premature'),
      vrDelivery(2000, 'b', 'overrun'),
      vrDelivery(3000, 'c', 'not-variable'),
    ]
    expect(vrCyclesCompleted(events)).toBe(0)
  })

  it('does not count an on-schedule CRF delivery', () => {
    const events: SimEvent[] = [phaseChanged(0, 'crf'), crfDelivery(1000, 'a')]
    expect(vrCyclesCompleted(events)).toBe(0)
  })

  it('does not count a VR-scheduled delivery classified after the VR round has ended (schedule field alone still disambiguates)', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      vrDelivery(500, 'a', 'on-schedule'),
      phaseChanged(1000, 'extinction'),
      vrDelivery(1500, 'b', 'on-schedule'),
    ]
    // Both carry schedule: 'VR' and on-schedule -- the schedule field is
    // stamped by the caller from the active phase, so this scenario would
    // only occur if a caller mis-stamped an extinction-phase delivery as
    // VR; vrCyclesCompleted trusts the field and counts both, which is
    // correct given that contract (session.ts, not this module, is
    // responsible for stamping it correctly).
    expect(vrCyclesCompleted(events)).toBe(2)
  })
})

describe('vrTrialHistory', () => {
  it('is empty when VR was never entered', () => {
    expect(vrTrialHistory([phaseChanged(0, 'crf')])).toEqual([])
  })

  it('marks a response credited when a matching on-schedule VR delivery exists', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      vrDelivery(1100, 'r1', 'on-schedule'),
    ]
    expect(vrTrialHistory(events)).toEqual([
      { responseId: 'r1', mark: 'credited' },
    ])
  })

  it('marks a response blocked when a matching VR delivery exists but was not on-schedule', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      vrDelivery(1100, 'r1', 'premature'),
    ]
    expect(vrTrialHistory(events)).toEqual([
      { responseId: 'r1', mark: 'blocked' },
    ])
  })

  it('marks a response blank (null) when no delivery ever credited it', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      response(2000, 'r2'),
      vrDelivery(2100, 'r2', 'on-schedule'),
    ]
    expect(vrTrialHistory(events)).toEqual([
      { responseId: 'r1', mark: null },
      { responseId: 'r2', mark: 'credited' },
    ])
  })

  it('excludes responses from before entering VR', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'crf'),
      response(500, 'crf-r'),
      phaseChanged(1000, 'vr'),
      response(2000, 'r1'),
      vrDelivery(2100, 'r1', 'on-schedule'),
    ]
    expect(vrTrialHistory(events)).toEqual([
      { responseId: 'r1', mark: 'credited' },
    ])
  })
})

describe('vrCoachingDue', () => {
  it('is false before vrCoachingPauseMs has elapsed', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr')]
    expect(vrCoachingDue(events, config.vrCoachingPauseMs - 1, config)).toBe(
      false,
    )
  })

  it('is true once vrCoachingPauseMs has elapsed with the cycle count unmet', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr')]
    expect(vrCoachingDue(events, config.vrCoachingPauseMs, config)).toBe(true)
  })

  it('is false once vrCyclesToComplete on-schedule cycles are already done', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr')]
    for (let i = 0; i < config.vrCyclesToComplete; i++) {
      events.push(vrDelivery(1000 + i * 1000, `c${i}`, 'on-schedule'))
    }
    expect(vrCoachingDue(events, config.vrCoachingPauseMs, config)).toBe(false)
  })

  it('is false once the VR round has closed', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      phaseChanged(config.vrCoachingPauseMs, 'extinction'),
    ]
    expect(vrCoachingDue(events, config.vrCoachingPauseMs, config)).toBe(false)
  })
})
