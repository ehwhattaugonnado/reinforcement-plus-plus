import { describe, expect, it } from 'vitest'
import { DEFAULT_SIM_CONFIG } from './config'
import type { SimEvent } from './events'
import {
  deriveVrScheduleState,
  vrCoachingDue,
  vrCyclesCompleted,
  vrRequirementAt,
  vrRoundWindow,
} from './vr'

const config = DEFAULT_SIM_CONFIG
const SEED = 'schedule-seed'

function phaseChanged(
  at: number,
  phase: 'crf' | 'vr' | 'extinction',
): SimEvent {
  return { type: 'phase-changed', at, phase }
}

function response(at: number, responseId: string): SimEvent {
  return { type: 'response-emitted', at, responseId }
}

function criterionMet(at: number, responseId: string): SimEvent {
  return { type: 'criterion-met', at, responseId, schedule: 'VR' }
}

function delivery(
  at: number,
  responseId: string | null,
  contingency: 'response-contingent' | 'noncontingent' = 'response-contingent',
): SimEvent {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId: 'treat',
    responseId,
    latencyMs: contingency === 'response-contingent' ? 100 : null,
    contingency,
    timing: contingency === 'response-contingent' ? 'prompt' : 'no-response',
    scheduleFidelity:
      contingency === 'response-contingent' ? 'on-schedule' : 'not-applicable',
  }
}

function abandoned(at: number): SimEvent {
  return { type: 'cycle-abandoned', at, reason: 'due-window-elapsed' }
}

function onScheduleDelivery(at: number, responseId: string): SimEvent {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId: 'treat',
    responseId,
    latencyMs: 100,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
  }
}

function overrunDelivery(at: number, responseId: string): SimEvent {
  return {
    type: 'stimulus-delivered',
    at,
    stimulusId: 'treat',
    responseId,
    latencyMs: 100,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'overrun',
  }
}

/** One resolved VR cycle: a response, its criterion, and an on-schedule delivery. */
function completedCycle(atMs: number, id: string): SimEvent[] {
  return [
    response(atMs, id),
    criterionMet(atMs, id),
    onScheduleDelivery(atMs + 50, id),
  ]
}

describe('vrRequirementAt', () => {
  it('is deterministic for a given seed and index', () => {
    const a = vrRequirementAt('seed-1', 0, config)
    const b = vrRequirementAt('seed-1', 0, config)
    expect(a).toBe(b)
  })

  it('every value is drawn from vrRequirementBlock', () => {
    for (let i = 0; i < 30; i++) {
      const value = vrRequirementAt('seed-1', i, config)
      expect(config.vrRequirementBlock).toContain(value)
    }
  })

  it('each consecutive block of vrRequirementBlock.length indices is a permutation of vrRequirementBlock', () => {
    const blockLength = config.vrRequirementBlock.length
    for (let block = 0; block < 5; block++) {
      const values = Array.from({ length: blockLength }, (_, i) =>
        vrRequirementAt('seed-1', block * blockLength + i, config),
      )
      expect([...values].sort()).toEqual([...config.vrRequirementBlock].sort())
    }
  })

  it('different seeds produce different sequences', () => {
    const a = Array.from({ length: 12 }, (_, i) =>
      vrRequirementAt('seed-a', i, config),
    )
    const b = Array.from({ length: 12 }, (_, i) =>
      vrRequirementAt('seed-b', i, config),
    )
    expect(a).not.toEqual(b)
  })

  it('different blocks within the same seed are shuffled independently, not identically', () => {
    const blockLength = config.vrRequirementBlock.length
    const block0 = Array.from({ length: blockLength }, (_, i) =>
      vrRequirementAt('seed-1', i, config),
    )
    const block1 = Array.from({ length: blockLength }, (_, i) =>
      vrRequirementAt('seed-1', blockLength + i, config),
    )
    // Not a hard guarantee (a shuffle can coincidentally repeat), but true
    // for this seed -- regression guard against blocks all reusing one draw.
    expect(block0).not.toEqual(block1)
  })

  it('the mean across a long run is close to the documented mean of three', () => {
    const N = 300
    const values = Array.from({ length: N }, (_, i) =>
      vrRequirementAt('cohort-seed', i, config),
    )
    const mean = values.reduce((a, b) => a + b, 0) / N
    expect(mean).toBeCloseTo(3, 1)
  })
})

describe('deriveVrScheduleState', () => {
  it('on fresh entry into VR, the first seeded requirement is current and no responses count yet', () => {
    const events = [phaseChanged(0, 'vr')]
    const state = deriveVrScheduleState(events, SEED, config)
    expect(state.currentRequirement).toBe(vrRequirementAt(SEED, 0, config))
    expect(state.responsesSinceReinforcement).toBe(0)
    expect(state.generatedRequirements).toEqual([
      vrRequirementAt(SEED, 0, config),
    ])
  })

  it('counts responses since entering VR toward the current requirement', () => {
    const events = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      response(2000, 'r2'),
    ]
    const state = deriveVrScheduleState(events, SEED, config)
    expect(state.responsesSinceReinforcement).toBe(2)
    expect(state.currentRequirement).toBe(vrRequirementAt(SEED, 0, config))
  })

  it('does not count a response from before entering VR (a prior CRF response)', () => {
    const events = [
      phaseChanged(0, 'crf'),
      response(500, 'crf-r1'),
      phaseChanged(1000, 'vr'),
      response(2000, 'r1'),
    ]
    const state = deriveVrScheduleState(events, SEED, config)
    expect(state.responsesSinceReinforcement).toBe(1)
  })

  it('keeps the just-met requirement current, and keeps counting overrun responses, while the cycle is still open', () => {
    // criterion-met alone does not resolve the cycle -- only a
    // response-contingent delivery or an abandonment does (crf.ts's
    // deriveOutstandingCycle). Until then this is the "reinforcement is
    // due" state: the requirement that was just met stays current, and
    // further responses accumulate as overruns rather than starting a new
    // count -- matching what `classifyDelivery` would credit a delivery to
    // right now.
    const events = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      response(2000, 'r2'),
      criterionMet(2000, 'r2'),
      response(3000, 'r3'), // overrun: piles up while reinforcement is due
    ]
    const state = deriveVrScheduleState(events, SEED, config)
    expect(state.currentRequirement).toBe(vrRequirementAt(SEED, 0, config))
    expect(state.generatedRequirements).toEqual([
      vrRequirementAt(SEED, 0, config),
    ])
    expect(state.responsesSinceReinforcement).toBe(3)
  })

  it('an on-schedule delivery closing the cycle consumes every response up to it, including overruns', () => {
    const events = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      criterionMet(1000, 'r1'),
      response(1500, 'overrun-r'), // extra response while reinforcement is due
      delivery(2000, 'r1'),
      response(3000, 'r-next'),
    ]
    const state = deriveVrScheduleState(events, SEED, config)
    // Only the response after the delivery counts toward the new requirement
    // -- the overrun response was consumed by the delivery, not carried
    // forward (crf.ts's consumption-boundary logic, reused here).
    expect(state.responsesSinceReinforcement).toBe(1)
    expect(state.currentRequirement).toBe(vrRequirementAt(SEED, 1, config))
  })

  it('an abandoned cycle also advances to the next requirement and discards accumulated overrun responses', () => {
    const events = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      criterionMet(1000, 'r1'),
      response(1500, 'overrun-r'),
      abandoned(11000),
      response(12000, 'r-next'),
    ]
    const state = deriveVrScheduleState(events, SEED, config)
    expect(state.currentRequirement).toBe(vrRequirementAt(SEED, 1, config))
    expect(state.responsesSinceReinforcement).toBe(1)
  })

  it('after several cycles, generatedRequirements accumulates the full seeded history in order', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr')]
    let t = 0
    for (let i = 0; i < 4; i++) {
      t += 1000
      events.push(response(t, `r${i}`))
      t += 100
      events.push(criterionMet(t, `r${i}`))
      t += 100
      events.push(delivery(t, `r${i}`))
    }
    const state = deriveVrScheduleState(events, SEED, config)
    expect(state.generatedRequirements).toEqual(
      Array.from({ length: 5 }, (_, i) => vrRequirementAt(SEED, i, config)),
    )
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

  it('counts only on-schedule VR deliveries within the round window', () => {
    const events: SimEvent[] = [phaseChanged(0, 'vr')]
    let t = 0
    for (let i = 0; i < 3; i++) {
      t += 1000
      events.push(...completedCycle(t, `c${i}`))
    }
    expect(vrCyclesCompleted(events)).toBe(3)
  })

  it('does not count overrun or abandoned cycles', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      response(1000, 'r1'),
      criterionMet(1000, 'r1'),
      response(1500, 'over1'),
      overrunDelivery(2000, 'r1'), // overrun: does not count
      response(3000, 'r2'),
      criterionMet(3000, 'r2'),
      abandoned(13000), // abandoned: does not count
    ]
    expect(vrCyclesCompleted(events)).toBe(0)
  })

  it('does not count a CRF delivery that happens to share the exact instant VR is entered (zero elapsed time between deliver and advance)', () => {
    // A learner can deliver, then immediately advance to VR with no tick
    // in between: the delivery and the phase-changed('vr') event then share
    // the same `at`. Bucketing purely by round time window would double-
    // count this instant (VR's window start is inclusive); attributing by
    // the delivery's own opening criterion's `schedule` avoids the
    // ambiguity entirely.
    const events: SimEvent[] = [
      phaseChanged(0, 'crf'),
      response(500, 'crf-r'),
      { type: 'criterion-met', at: 500, responseId: 'crf-r', schedule: 'CRF' },
      {
        type: 'stimulus-delivered',
        at: 1000,
        stimulusId: 'treat',
        responseId: 'crf-r',
        latencyMs: 500,
        contingency: 'response-contingent',
        timing: 'delayed',
        scheduleFidelity: 'on-schedule',
      },
      phaseChanged(1000, 'vr'), // same instant as the CRF delivery above
    ]
    expect(vrCyclesCompleted(events)).toBe(0)
  })

  it('does not count a CRF cycle completed before entering VR', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'crf'),
      response(500, 'crf-r'),
      { type: 'criterion-met', at: 500, responseId: 'crf-r', schedule: 'CRF' },
      {
        type: 'stimulus-delivered',
        at: 550,
        stimulusId: 'treat',
        responseId: 'crf-r',
        latencyMs: 50,
        contingency: 'response-contingent',
        timing: 'prompt',
        scheduleFidelity: 'on-schedule',
      },
      phaseChanged(1000, 'vr'),
    ]
    expect(vrCyclesCompleted(events)).toBe(0)
  })

  it('does not count a VR-scheduled delivery that lands after the VR round has ended', () => {
    const events: SimEvent[] = [
      phaseChanged(0, 'vr'),
      response(500, 'vr-r'),
      { type: 'criterion-met', at: 500, responseId: 'vr-r', schedule: 'VR' },
      onScheduleDelivery(550, 'vr-r'),
      phaseChanged(1000, 'extinction'),
      response(1500, 'ext-r'),
      { type: 'criterion-met', at: 1500, responseId: 'ext-r', schedule: 'VR' },
      onScheduleDelivery(1550, 'ext-r'),
    ]
    expect(vrCyclesCompleted(events)).toBe(1)
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
    let t = 0
    for (let i = 0; i < config.vrCyclesToComplete; i++) {
      t += 1000
      events.push(...completedCycle(t, `c${i}`))
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
