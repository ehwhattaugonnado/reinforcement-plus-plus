import { describe, expect, it } from 'vitest'
import { DEFAULT_SIM_CONFIG } from './config'
import type { SimEvent } from './events'
import {
  baselineResponseRatePerMinute,
  baselineWindow,
  computeResponseRatePerMinute,
  deriveLearnedStrength,
  deriveStimulusValue,
  isBaselineComplete,
  meanInterarrivalMs,
  responseRateInWindow,
} from './learning'
import { applyEvent } from './project'
import { createInitialState } from './initial-state'
import type { CreatureState, SessionState } from './types'

const config = DEFAULT_SIM_CONFIG

function delivery(
  overrides: Partial<Extract<SimEvent, { type: 'stimulus-delivered' }>>,
): Extract<SimEvent, { type: 'stimulus-delivered' }> {
  return {
    type: 'stimulus-delivered',
    at: 0,
    stimulusId: 'treat',
    responseId: 'r1',
    latencyMs: 200,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
    ...overrides,
  }
}

function promptContingentSeries(count: number, spacingMs = 2000): SimEvent[] {
  const events: SimEvent[] = []
  for (let i = 0; i < count; i++) {
    events.push(delivery({ at: i * spacingMs, responseId: `r${i}` }))
  }
  return events
}

describe('deriveLearnedStrength', () => {
  it('is 0 with no delivery history', () => {
    expect(deriveLearnedStrength([], 1000, config)).toBe(0)
  })

  it('teaches more from a prompt, response-contingent delivery than a delayed one', () => {
    const prompt = deriveLearnedStrength(
      [delivery({ at: 0, timing: 'prompt' })],
      0,
      config,
    )
    const delayed = deriveLearnedStrength(
      [delivery({ at: 0, timing: 'delayed' })],
      0,
      config,
    )
    expect(prompt).toBeGreaterThan(delayed)
  })

  it('teaches more from a delayed contingent delivery than a noncontingent one', () => {
    const delayed = deriveLearnedStrength(
      [delivery({ at: 0, timing: 'delayed' })],
      0,
      config,
    )
    const noncontingent = deriveLearnedStrength(
      [
        delivery({
          at: 0,
          contingency: 'noncontingent',
          timing: 'no-response',
          responseId: null,
        }),
      ],
      0,
      config,
    )
    expect(delayed).toBeGreaterThan(noncontingent)
  })

  it('accumulates monotonically and clamps to 1', () => {
    const events = promptContingentSeries(20)
    const strength = deriveLearnedStrength(events, 19 * 2000, config)
    expect(strength).toBeLessThanOrEqual(1)
    expect(strength).toBe(1) // saturates well before 20 deliveries at this gain
  })

  it('only counts deliveries at or before the query time', () => {
    const events = promptContingentSeries(4, 1000) // at 0, 1000, 2000, 3000
    const early = deriveLearnedStrength(events, 500, config)
    const later = deriveLearnedStrength(events, 3000, config)
    expect(early).toBeLessThan(later)
  })
})

describe('deriveStimulusValue (satiation decay and bounded recovery)', () => {
  const basePreference = 0.8

  it('starts at basePreference with no delivery history', () => {
    expect(deriveStimulusValue([], 'treat', basePreference, 1000, config)).toBe(
      basePreference,
    )
  })

  it('decays with each delivery, floor-bounded', () => {
    const events = promptContingentSeries(10, 1) // deliveries back to back, no recovery time
    const value = deriveStimulusValue(
      events,
      'treat',
      basePreference,
      9,
      config,
    )
    expect(value).toBeGreaterThanOrEqual(config.stimulusValueFloor)
    expect(value).toBeLessThan(basePreference)
  })

  it('recovers over elapsed time but never exceeds the recovery ceiling or basePreference', () => {
    const events = [delivery({ at: 0 })]
    const justAfter = deriveStimulusValue(
      events,
      'treat',
      basePreference,
      1,
      config,
    )
    const muchLater = deriveStimulusValue(
      events,
      'treat',
      basePreference,
      10_000_000,
      config,
    )
    expect(muchLater).toBeGreaterThan(justAfter) // recovered upward
    expect(muchLater).toBeLessThan(basePreference) // bound is strictly below full restoration
    expect(muchLater).toBeLessThanOrEqual(
      basePreference * config.satiationRecoveryCeilingFraction + 1e-9,
    )
  })

  it('recovers more with more elapsed time (monotonic within the bound)', () => {
    const events = [delivery({ at: 0 })]
    const soon = deriveStimulusValue(
      events,
      'treat',
      basePreference,
      500,
      config,
    )
    const later = deriveStimulusValue(
      events,
      'treat',
      basePreference,
      5000,
      config,
    )
    expect(later).toBeGreaterThan(soon)
  })

  it('is unaffected by deliveries of a different stimulus', () => {
    const events = [delivery({ at: 0, stimulusId: 'toy' })]
    expect(
      deriveStimulusValue(events, 'treat', basePreference, 1000, config),
    ).toBe(basePreference)
  })
})

describe('computeResponseRatePerMinute', () => {
  const creature: Pick<CreatureState, 'stimuli' | 'targetBehavior'> = {
    stimuli: [
      { stimulusId: 'treat', basePreference: 0.8, currentValue: 0.8 },
      { stimulusId: 'toy', basePreference: 0.5, currentValue: 0.5 },
    ],
    targetBehavior: {
      behaviorId: 'spin',
      baselineRatePerMinute: 3,
      learnedStrength: 0,
      currentRatePerMinute: 3,
      extinctionBurstPrimed: false,
      extinctionBurstMagnitudeScale: 1,
    },
  }

  it('equals the baseline rate with no experienced consequence yet', () => {
    expect(
      computeResponseRatePerMinute([], 1000, config, creature),
    ).toBeCloseTo(3, 6)
  })

  it('rises after a prompt, response-contingent delivery', () => {
    const events = promptContingentSeries(8, 1000)
    const rate = computeResponseRatePerMinute(events, 7000, config, creature)
    expect(rate).toBeGreaterThan(creature.targetBehavior.baselineRatePerMinute)
  })

  it('rises less after noncontingent deliveries than after prompt-contingent ones', () => {
    const contingentEvents = promptContingentSeries(8, 1000)
    const noncontingentEvents = contingentEvents.map((e) =>
      e.type === 'stimulus-delivered'
        ? {
            ...e,
            contingency: 'noncontingent' as const,
            timing: 'no-response' as const,
            responseId: null,
          }
        : e,
    )
    const contingentRate = computeResponseRatePerMinute(
      contingentEvents,
      7000,
      config,
      creature,
    )
    const noncontingentRate = computeResponseRatePerMinute(
      noncontingentEvents,
      7000,
      config,
      creature,
    )
    expect(noncontingentRate).toBeLessThan(contingentRate)
  })

  it('rises less after substantially delayed deliveries than after prompt ones', () => {
    const promptEvents = promptContingentSeries(8, 1000)
    const delayedEvents = promptEvents.map((e) =>
      e.type === 'stimulus-delivered'
        ? { ...e, timing: 'delayed' as const }
        : e,
    )
    const promptRate = computeResponseRatePerMinute(
      promptEvents,
      7000,
      config,
      creature,
    )
    const delayedRate = computeResponseRatePerMinute(
      delayedEvents,
      7000,
      config,
      creature,
    )
    expect(delayedRate).toBeLessThan(promptRate)
  })

  it('decays back toward baseline as time since the last consequence grows', () => {
    const events = promptContingentSeries(8, 1000)
    const soonAfter = computeResponseRatePerMinute(
      events,
      7500,
      config,
      creature,
    )
    const longAfter = computeResponseRatePerMinute(
      events,
      700_000,
      config,
      creature,
    )
    expect(longAfter).toBeLessThan(soonAfter)
    expect(longAfter).toBeCloseTo(
      creature.targetBehavior.baselineRatePerMinute,
      1,
    )
  })

  it('stays within the configured floor and ceiling', () => {
    const events = promptContingentSeries(50, 1)
    const rate = computeResponseRatePerMinute(events, 49, config, creature)
    expect(rate).toBeLessThanOrEqual(config.responseRateCeilingPerMinute)
    expect(rate).toBeGreaterThanOrEqual(config.responseRateFloorPerMinute)
  })
})

describe('computeResponseRatePerMinute extinction-transition burst term', () => {
  const primedCreature: Pick<CreatureState, 'stimuli' | 'targetBehavior'> = {
    stimuli: [{ stimulusId: 'treat', basePreference: 0.8, currentValue: 0.8 }],
    targetBehavior: {
      behaviorId: 'spin',
      baselineRatePerMinute: 3,
      learnedStrength: 0,
      currentRatePerMinute: 3,
      extinctionBurstPrimed: true,
      extinctionBurstMagnitudeScale: 1,
    },
  }
  const unprimedCreature: Pick<CreatureState, 'stimuli' | 'targetBehavior'> = {
    ...primedCreature,
    targetBehavior: {
      ...primedCreature.targetBehavior,
      extinctionBurstPrimed: false,
    },
  }

  it('does not appear outside the extinction phase, even for a primed creature', () => {
    const events = promptContingentSeries(8, 1000)
    const atPeak = 7000 + config.extinctionBurstPeakDelayMs
    const withoutPhase = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      primedCreature,
    )
    const inCrf = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      primedCreature,
      'crf',
    )
    const inVr = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      primedCreature,
      'vr',
    )
    const ordinaryDecay = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      unprimedCreature,
      'extinction',
    )
    expect(withoutPhase).toBeCloseTo(ordinaryDecay, 6)
    expect(inCrf).toBeCloseTo(ordinaryDecay, 6)
    expect(inVr).toBeCloseTo(ordinaryDecay, 6)
  })

  it('does not raise the rate above the ordinary recency-decay curve for an unprimed creature, even in extinction', () => {
    const events = promptContingentSeries(8, 1000)
    const atPeak = 7000 + config.extinctionBurstPeakDelayMs
    const unprimedInExtinction = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      unprimedCreature,
      'extinction',
    )
    const unprimedElsewhere = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      unprimedCreature,
      'crf',
    )
    expect(unprimedInExtinction).toBeCloseTo(unprimedElsewhere, 6)
  })

  it('raises the rate above the ordinary recency-decay curve for a primed creature, at its peak delay, in extinction', () => {
    const events = promptContingentSeries(8, 1000)
    const atPeak = 7000 + config.extinctionBurstPeakDelayMs
    const primedRate = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      primedCreature,
      'extinction',
    )
    const ordinaryDecay = computeResponseRatePerMinute(
      events,
      atPeak,
      config,
      unprimedCreature,
      'extinction',
    )
    expect(primedRate).toBeGreaterThan(ordinaryDecay)
  })

  it('is zero at the instant reinforcement stops and decays back toward the ordinary curve well after the peak', () => {
    const events = promptContingentSeries(8, 1000)
    const cessationMs = 7000
    const atCessation = computeResponseRatePerMinute(
      events,
      cessationMs,
      config,
      primedCreature,
      'extinction',
    )
    const ordinaryAtCessation = computeResponseRatePerMinute(
      events,
      cessationMs,
      config,
      unprimedCreature,
      'extinction',
    )
    expect(atCessation).toBeCloseTo(ordinaryAtCessation, 6)

    const longAfter = cessationMs + config.extinctionBurstPeakDelayMs * 20
    const primedLongAfter = computeResponseRatePerMinute(
      events,
      longAfter,
      config,
      primedCreature,
      'extinction',
    )
    const ordinaryLongAfter = computeResponseRatePerMinute(
      events,
      longAfter,
      config,
      unprimedCreature,
      'extinction',
    )
    expect(primedLongAfter).toBeCloseTo(ordinaryLongAfter, 1)
  })

  it('scales with learned strength and delivered stimulus value, not an independent seeded magnitude', () => {
    const strongEvents = promptContingentSeries(8, 1000)
    const weakEvents = strongEvents.slice(0, 2) // far less learned strength
    const atPeak = 7000 + config.extinctionBurstPeakDelayMs

    const strongBump =
      computeResponseRatePerMinute(
        strongEvents,
        atPeak,
        config,
        primedCreature,
        'extinction',
      ) -
      computeResponseRatePerMinute(
        strongEvents,
        atPeak,
        config,
        unprimedCreature,
        'extinction',
      )
    const weakBump =
      computeResponseRatePerMinute(
        weakEvents,
        1500 + config.extinctionBurstPeakDelayMs,
        config,
        primedCreature,
        'extinction',
      ) -
      computeResponseRatePerMinute(
        weakEvents,
        1500 + config.extinctionBurstPeakDelayMs,
        config,
        unprimedCreature,
        'extinction',
      )
    expect(strongBump).toBeGreaterThan(weakBump)
  })

  it('stays within the configured floor and ceiling with a burst applied', () => {
    const events = promptContingentSeries(50, 1)
    const rate = computeResponseRatePerMinute(
      events,
      49 + config.extinctionBurstPeakDelayMs,
      config,
      primedCreature,
      'extinction',
    )
    expect(rate).toBeLessThanOrEqual(config.responseRateCeilingPerMinute)
    expect(rate).toBeGreaterThanOrEqual(config.responseRateFloorPerMinute)
  })
})

describe('acquisition cohort (tolerant, seeded)', () => {
  const SEEDS = Array.from({ length: 20 }, (_, i) => `acquisition-seed-${i}`)

  it('clears the documented CRF acquisition gate in most seeds after 8 prompt, contingent deliveries', () => {
    let cleared = 0
    for (const seed of SEEDS) {
      const initial = createInitialState(seed, 1, config)
      const baselineRate = initial.creature.targetBehavior.baselineRatePerMinute
      // A player choosing informed by the preference hierarchy picks the
      // most-preferred stimulus (core-loop Round 1), so calibrate against
      // that rather than an arbitrary stimulus.
      const preferred = [...initial.creature.stimuli].sort(
        (a, b) => b.basePreference - a.basePreference,
      )[0] as (typeof initial.creature.stimuli)[number]
      const treatId = preferred.stimulusId
      const events = Array.from({ length: 8 }, (_, i) =>
        delivery({
          at: i * 1000,
          stimulusId: treatId,
          responseId: `r${i}`,
        }),
      )
      const rate = computeResponseRatePerMinute(
        events,
        7500,
        config,
        initial.creature,
      )
      const relativeIncrease = (rate - baselineRate) / baselineRate
      const absoluteIncrease = rate - baselineRate
      if (
        relativeIncrease >= config.crfAcquisitionRelativeIncrease &&
        absoluteIncrease >= config.crfAcquisitionAbsoluteIncrease
      ) {
        cleared++
      }
    }
    // Tolerant cohort assertion: acquisition should be the common case, not
    // required of every seed (testing-strategy.md). Measured at 20/20 for
    // this 20-seed cohort against the current defaults; the 80% floor is
    // deliberately looser than that so a future config retune (M8) has
    // headroom before this test flakes, rather than pinning today's exact
    // count.
    expect(cleared).toBeGreaterThanOrEqual(Math.ceil(SEEDS.length * 0.8))
  })
})

describe('response-rate window projectors', () => {
  it('counts responses per observed simulated minute in a window', () => {
    const events: SimEvent[] = [
      { type: 'response-emitted', at: 1000, responseId: 'r1' },
      { type: 'response-emitted', at: 5000, responseId: 'r2' },
      { type: 'response-emitted', at: 9000, responseId: 'r3' },
      { type: 'response-emitted', at: 20_000, responseId: 'r4' }, // outside window
    ]
    // 3 responses over a 10s window => 18/min
    expect(responseRateInWindow(events, 0, 10_000)).toBeCloseTo(18, 6)
  })

  it('returns 0 for a degenerate or empty window', () => {
    expect(responseRateInWindow([], 0, 0)).toBe(0)
    expect(responseRateInWindow([], 100, 0)).toBe(0)
  })

  it('derives the baseline window from phase-changed events, capped at baselineDurationMs', () => {
    const events: SimEvent[] = [
      { type: 'phase-changed', at: 0, phase: 'assessment' },
      { type: 'phase-changed', at: 500, phase: 'baseline' },
    ]
    expect(baselineWindow(events, config)).toEqual({
      startMs: 500,
      endMs: 500 + config.baselineDurationMs,
    })
  })

  it('clips the baseline window to an early exit into the next phase', () => {
    const events: SimEvent[] = [
      { type: 'phase-changed', at: 0, phase: 'assessment' },
      { type: 'phase-changed', at: 500, phase: 'baseline' },
      { type: 'phase-changed', at: 10_500, phase: 'crf' },
    ]
    expect(baselineWindow(events, config)).toEqual({
      startMs: 500,
      endMs: 10_500,
    })
  })

  it('returns null baseline metrics before baseline has started', () => {
    expect(baselineWindow([], config)).toBeNull()
    expect(baselineResponseRatePerMinute([], config)).toBeNull()
    expect(isBaselineComplete([], 1000, config)).toBe(false)
  })

  it('marks baseline complete only once baselineDurationMs has elapsed since it started', () => {
    const events: SimEvent[] = [
      { type: 'phase-changed', at: 1000, phase: 'baseline' },
    ]
    expect(
      isBaselineComplete(events, 1000 + config.baselineDurationMs - 1, config),
    ).toBe(false)
    expect(
      isBaselineComplete(events, 1000 + config.baselineDurationMs, config),
    ).toBe(true)
  })

  it('is distinct from the seeded latent baseline rate: the event-derived figure reflects only observed responses', () => {
    const events: SimEvent[] = [
      { type: 'phase-changed', at: 0, phase: 'assessment' },
      { type: 'phase-changed', at: 0, phase: 'baseline' },
      { type: 'response-emitted', at: 1000, responseId: 'r1' },
    ]
    const observed = baselineResponseRatePerMinute(events, config)
    // 1 response over the full (uncapped-by-early-exit) 45s window.
    expect(observed).toBeCloseTo(60000 / config.baselineDurationMs, 6)
    expect(observed).not.toBe(3) // never confused with a hardcoded/latent figure
  })
})

describe('meanInterarrivalMs', () => {
  it('is the reciprocal of the per-minute rate in ms', () => {
    expect(meanInterarrivalMs(60)).toBeCloseTo(1000, 6)
    expect(meanInterarrivalMs(6)).toBeCloseTo(10_000, 6)
  })

  it('guards against a non-positive rate', () => {
    expect(Number.isFinite(meanInterarrivalMs(0))).toBe(true)
    expect(meanInterarrivalMs(0)).toBeGreaterThan(0)
  })
})

describe('the central causal invariant', () => {
  function baseState(): SessionState {
    const state = createInitialState('invariant-seed', 1, config)
    return { ...state, phase: 'crf' }
  }

  it('produces identical creature state from applyBehavioralEvent regardless of the selected schedule plan', () => {
    const crfState: SessionState = {
      ...baseState(),
      schedulePlan: { type: 'CRF', responsesRequired: 1 },
    }
    const vrState: SessionState = {
      ...baseState(),
      schedulePlan: {
        type: 'VR',
        meanRatio: 3,
        currentRequirement: 4,
        responsesSinceReinforcement: 2,
        generatedRequirements: [2, 3, 4],
      },
    }

    const treatId = crfState.creature.stimuli[0]?.stimulusId as string
    const event: SimEvent = delivery({
      at: 1000,
      stimulusId: treatId,
      responseId: 'r1',
    })

    const afterCrf = applyEvent(crfState, event, config)
    const afterVr = applyEvent(vrState, event, config)

    expect(afterCrf.creature).toEqual(afterVr.creature)
  })

  it("computeResponseRatePerMinute's signature has no schedulePlan parameter at all", () => {
    // The strongest form of the invariant (ADR 0003): it isn't just that two
    // equal calls agree (trivially true of any pure function) but that there
    // is no parameter through which a schedule label could reach this
    // function in the first place. This is a type-level guard as much as a
    // runtime one -- `applyBehavioralEvent`'s call site above only ever
    // passes `state.creature`, never `state.schedulePlan`.
    //
    // `phase` (baseline/crf/vr/extinction) is a distinct, documented rate
    // input (data-model section 4 lists "optional extinction-transition
    // state" alongside recency and stimulus value) -- unlike `schedulePlan`,
    // it is not the learner's selected schedule *type*, only which round is
    // running, and it is itself derived from logged `phase-changed` events.
    // It has a default value, so `Function.length` (which excludes any
    // parameter after the first with a default) still reports 4.
    expect(computeResponseRatePerMinute.length).toBe(4) // (events, atMs, config, creature, phase = 'baseline')
  })
})
