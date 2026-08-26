import { describe, expect, it } from 'vitest'
import {
  chooseInPair,
  deriveAssessmentSummary,
  deriveHierarchy,
  deriveAssessmentTrials,
  deriveRecordingAccuracy,
} from './assessment'
import { DEFAULT_SIM_CONFIG, type SimConfig } from './config'
import type { SimEvent } from './events'
import { replay } from './replay'
import { createRng } from './rng'
import { createSession } from './session'
import { STIMULUS_IDS, allUniquePairs } from './stimuli'
import type { StimulusState } from './types'

const SEED = 'assessment-seed'

/** Runs an assessment to completion, recording each trial accurately. */
function runAssessment(seed: string, config?: Partial<SimConfig>) {
  const session = createSession(
    config === undefined ? { seed } : { seed, config },
  )
  for (let i = 0; i < 6; i++) {
    expect(session.presentNextPair().ok).toBe(true)
    const trial = session.getSnapshot().assessment.trials.at(-1)
    expect(trial).toBeDefined()
    expect(
      session.recordObservedSelection(trial?.creatureSelection ?? null).ok,
    ).toBe(true)
  }
  return session
}

function unorderedKey(a: string, b: string): string {
  return [a, b].sort().join('|')
}

// --- Synthetic-log helpers -------------------------------------------------
//
// Ties, no-selection trials, and recording errors are rare under the default
// choice model, so the derivations are tested against constructed logs. That
// keeps them provable independently of the behaviour model, the same way the
// data model prescribes for burst detection.

type SyntheticTrial = {
  pair: readonly [string, string]
  chose?: string | null
  recorded?: string | null
  skipRecord?: boolean
}

function syntheticLog(trials: readonly SyntheticTrial[]): SimEvent[] {
  const events: SimEvent[] = []
  trials.forEach((trial, i) => {
    const at = i * 1000
    events.push({
      type: 'pair-presented',
      at,
      leftId: trial.pair[0],
      rightId: trial.pair[1],
    })
    const chose = trial.chose === undefined ? trial.pair[0] : trial.chose
    events.push({ type: 'creature-selected', at, stimulusId: chose })
    if (trial.skipRecord === true) return
    events.push({
      type: 'selection-recorded',
      at,
      stimulusId: trial.recorded === undefined ? chose : trial.recorded,
    })
  })
  return events
}

describe('pair coverage and seeded randomization', () => {
  it('presents each of the six unique pairs exactly once', () => {
    const events = runAssessment(SEED).getSnapshot().events
    const presented = events
      .filter((e) => e.type === 'pair-presented')
      .map((e) => unorderedKey(e.leftId, e.rightId))

    expect(presented).toHaveLength(6)
    expect(new Set(presented).size).toBe(6)
    expect(new Set(presented)).toEqual(
      new Set(allUniquePairs().map(([a, b]) => unorderedKey(a, b))),
    )
  })

  it('emits exactly one creature selection per presented pair', () => {
    const events = runAssessment(SEED).getSnapshot().events
    const sequence = events
      .filter(
        (e) => e.type === 'pair-presented' || e.type === 'creature-selected',
      )
      .map((e) => e.type)

    expect(sequence).toEqual(
      Array.from({ length: 6 }, () => [
        'pair-presented',
        'creature-selected',
      ]).flat(),
    )
  })

  it('reproduces trial order and left/right placement for the same seed', () => {
    const a = runAssessment(SEED).getSnapshot()
    const b = runAssessment(SEED).getSnapshot()
    expect(a.assessment.plannedPairs).toEqual(b.assessment.plannedPairs)
    expect(a.events).toEqual(b.events)
  })

  it('varies trial order and placement across seeds', () => {
    const orders = new Set<string>()
    const placements = new Set<string>()
    for (let i = 0; i < 40; i++) {
      const pairs = createSession({ seed: `order-${i}` }).getSnapshot()
        .assessment.plannedPairs
      orders.add(pairs.map(([a, b]) => unorderedKey(a, b)).join(','))
      // Placement of the alphabetically-first pair, whichever trial it lands in.
      const target = pairs.find(
        ([a, b]) => unorderedKey(a, b) === unorderedKey('play', 'praise'),
      )
      if (target !== undefined) placements.add(target.join('>'))
    }
    expect(orders.size).toBeGreaterThan(1)
    // Both left/right orientations occur, so placement is randomized too.
    expect(placements.size).toBe(2)
  })
})

describe('creature choice model', () => {
  const stimuli: readonly StimulusState[] = [
    { stimulusId: 'treat', basePreference: 0.85, currentValue: 0.85 },
    { stimulusId: 'toy', basePreference: 0.2, currentValue: 0.2 },
  ]

  it('draws exactly two values per trial whatever the outcome', () => {
    const rng = createRng(SEED, 'choice')
    for (let i = 1; i <= 50; i++) {
      chooseInPair(stimuli, 'treat', 'toy', rng, DEFAULT_SIM_CONFIG)
      expect(rng.draws).toBe(i * 2)
    }
  })

  it('chooses the higher-value stimulus more often, but not always', () => {
    const rng = createRng(SEED, 'choice')
    let treat = 0
    const trials = 400
    for (let i = 0; i < trials; i++) {
      if (
        chooseInPair(stimuli, 'treat', 'toy', rng, DEFAULT_SIM_CONFIG) ===
        'treat'
      )
        treat++
    }
    expect(treat / trials).toBeGreaterThan(0.8)
  })

  it('produces no-selection trials when both stimuli have little value left', () => {
    const rng = createRng(SEED, 'choice')
    const depleted: readonly StimulusState[] = [
      { stimulusId: 'treat', basePreference: 0.85, currentValue: 0 },
      { stimulusId: 'toy', basePreference: 0.2, currentValue: 0 },
    ]
    let none = 0
    for (let i = 0; i < 400; i++) {
      if (
        chooseInPair(depleted, 'treat', 'toy', rng, DEFAULT_SIM_CONFIG) === null
      )
        none++
    }
    // `assessmentNoSelectionScale` is the peak rate, reached at zero value.
    expect(none / 400).toBeGreaterThan(0.05)
    expect(none / 400).toBeLessThan(0.3)
  })

  it('falls back to an even coin flip rather than NaN at zero value', () => {
    const rng = createRng(SEED, 'choice')
    const worthless: readonly StimulusState[] = [
      { stimulusId: 'treat', basePreference: 0, currentValue: 0 },
      { stimulusId: 'toy', basePreference: 0, currentValue: 0 },
    ]
    const noSelectionOff: SimConfig = {
      ...DEFAULT_SIM_CONFIG,
      assessmentNoSelectionScale: 0,
    }
    const picks = new Set<string | null>()
    for (let i = 0; i < 100; i++) {
      picks.add(chooseInPair(worthless, 'treat', 'toy', rng, noSelectionOff))
    }
    expect(picks).toEqual(new Set(['treat', 'toy']))
  })

  it('produces at least one no-selection trial across a seeded cohort', () => {
    let noSelection = 0
    for (let i = 0; i < 60; i++) {
      noSelection += deriveAssessmentSummary(
        runAssessment(`none-${i}`).getSnapshot().events,
      ).noSelectionTrials
    }
    expect(noSelection).toBeGreaterThan(0)
  })
})

describe('bounded satiation from equal post-selection access', () => {
  it('lowers only the selected stimulus, and never below its floor', () => {
    for (let i = 0; i < 40; i++) {
      const state = runAssessment(`satiation-${i}`).getSnapshot()
      for (const stimulus of state.creature.stimuli) {
        expect(stimulus.currentValue).toBeLessThanOrEqual(
          stimulus.basePreference,
        )
        expect(stimulus.currentValue).toBeGreaterThanOrEqual(
          stimulus.basePreference *
            DEFAULT_SIM_CONFIG.assessmentSatiationFloorFraction -
            1e-9,
        )
      }
      const chosen = new Set(
        state.assessment.trials
          .map((t) => t.creatureSelection)
          .filter((id): id is string => id !== null),
      )
      for (const stimulus of state.creature.stimuli) {
        if (!chosen.has(stimulus.stimulusId)) {
          expect(stimulus.currentValue).toBe(stimulus.basePreference)
        }
      }
    }
  })

  /**
   * The requirement is not "satiation exists" but "satiation is small enough
   * that trial order does not dominate the result" (Core Loop, Phase A). A
   * one-armed test cannot show that, because it would pass with satiation
   * switched off entirely. So the same seed cohort is run twice: once on the
   * documented defaults, and once with satiation cranked far past them. The
   * defaults must track latent preference and ignore order; the cranked arm
   * must visibly lose that property.
   */
  it('does not let trial order dominate the hierarchy at the documented defaults', () => {
    const dominated: Partial<SimConfig> = {
      assessmentSatiationPerAccess: 0.85,
      assessmentSatiationFloorFraction: 0.02,
    }

    const measure = (config?: Partial<SimConfig>) => {
      const cohort = 200
      let preferenceHits = 0
      let orderHits = 0
      for (let i = 0; i < cohort; i++) {
        const state = runAssessment(`cohort-${i}`, config).getSnapshot()
        const top = deriveAssessmentSummary(state.events).hierarchy[0]
        expect(top).toBeDefined()

        const mostPreferred = [...state.creature.stimuli].sort(
          (a, b) => b.basePreference - a.basePreference,
        )[0]
        if (top?.stimulusId === mostPreferred?.stimulusId) preferenceHits++

        // If order dominated, the winner would be whichever stimulus is
        // presented latest on average: it enters its trials least satiated.
        const positions = new Map<string, number[]>()
        state.assessment.plannedPairs.forEach((pair, index) => {
          for (const id of pair) {
            positions.set(id, [...(positions.get(id) ?? []), index])
          }
        })
        const latest = [...positions.entries()]
          .map(
            ([id, at]) =>
              [id, at.reduce((a, b) => a + b, 0) / at.length] as const,
          )
          .sort((a, b) => b[1] - a[1])[0]
        if (top?.stimulusId === latest?.[0]) orderHits++
      }
      return { preference: preferenceHits / cohort, order: orderHits / cohort }
    }

    const defaults = measure()
    const cranked = measure(dominated)
    const chance = 1 / STIMULUS_IDS.length

    // Defaults: latent preference predicts the winner far better than order,
    // and order is no better than chance.
    expect(defaults.preference).toBeGreaterThan(0.6)
    expect(defaults.preference).toBeGreaterThan(defaults.order + 0.3)
    expect(defaults.order).toBeLessThan(chance + 0.05)

    // Cranked: the bound is what was doing the work, so removing it costs a
    // large, measurable amount of preference tracking.
    expect(cranked.preference).toBeLessThan(defaults.preference - 0.2)
    expect(cranked.order).toBeGreaterThan(defaults.order)
  })
})

describe('replay after a completed assessment', () => {
  it('reconstructs the satiated creature state from seed plus log', () => {
    const live = runAssessment(SEED).getSnapshot()
    const replayed = replay(SEED, live.events)
    expect(replayed.ok).toBe(true)
    if (!replayed.ok) return
    // The last recorded event is `selection-recorded`, so this comparison is
    // taken at an event boundary rather than mid-tick.
    expect(replayed.state).toEqual(live)
    expect(replayed.state.creature.stimuli).toEqual(live.creature.stimuli)
    expect(replayed.state.assessment.complete).toBe(true)
  })
})

describe('command atomicity', () => {
  it('consumes no RNG draws when presenting the next pair is rejected', () => {
    const session = createSession({ seed: SEED })
    expect(session.presentNextPair().ok).toBe(true)
    const draws = session.rng.draws
    const events = session.getSnapshot().events.length

    // The current trial is not recorded yet, so a second present is refused.
    expect(session.presentNextPair()).toEqual({
      ok: false,
      reason: 'duplicate-command',
      detail: expect.any(String),
    })
    expect(session.rng.draws).toBe(draws)
    expect(session.getSnapshot().events).toHaveLength(events)
  })

  it('refuses to present a seventh pair', () => {
    const session = runAssessment(SEED)
    expect(session.presentNextPair()).toEqual({
      ok: false,
      reason: 'already-complete',
    })
  })
})

describe('event-derived trials', () => {
  it('keeps the creature selection and the learner record separate', () => {
    const trials = deriveAssessmentTrials(
      syntheticLog([
        { pair: ['toy', 'treat'], chose: 'treat', recorded: 'toy' },
      ]),
    )
    expect(trials).toEqual([
      {
        leftId: 'toy',
        rightId: 'treat',
        observed: true,
        creatureSelection: 'treat',
        recorded: true,
        recordedSelection: 'toy',
      },
    ])
  })
})

describe('recording accuracy', () => {
  it('counts a matching record, including an agreed no-selection trial', () => {
    const trials = deriveAssessmentTrials(
      syntheticLog([
        { pair: ['toy', 'treat'], chose: 'treat' },
        { pair: ['play', 'praise'], chose: null, recorded: null },
      ]),
    )
    expect(deriveRecordingAccuracy(trials)).toEqual({
      comparableTrials: 2,
      matchingTrials: 2,
      accuracy: 1,
    })
  })

  it('counts a mis-recorded trial and a missed no-selection as errors', () => {
    const trials = deriveAssessmentTrials(
      syntheticLog([
        { pair: ['toy', 'treat'], chose: 'treat', recorded: 'toy' },
        { pair: ['play', 'praise'], chose: null, recorded: 'play' },
        { pair: ['play', 'toy'], chose: 'play', recorded: null },
        { pair: ['praise', 'treat'], chose: 'treat' },
      ]),
    )
    expect(deriveRecordingAccuracy(trials)).toEqual({
      comparableTrials: 4,
      matchingTrials: 1,
      accuracy: 0.25,
    })
  })

  it('excludes an unrecorded trial and reports null with nothing to compare', () => {
    const trials = deriveAssessmentTrials(
      syntheticLog([{ pair: ['toy', 'treat'], skipRecord: true }]),
    )
    expect(deriveRecordingAccuracy(trials)).toEqual({
      comparableTrials: 0,
      matchingTrials: 0,
      accuracy: null,
    })
  })
})

describe('preference hierarchy', () => {
  it('ranks by selection percentage over presentations', () => {
    // treat wins all three of its trials; play wins the two it is left in.
    const hierarchy = deriveHierarchy(
      deriveAssessmentTrials(
        syntheticLog([
          { pair: ['toy', 'treat'], chose: 'treat' },
          { pair: ['play', 'treat'], chose: 'treat' },
          { pair: ['praise', 'treat'], chose: 'treat' },
          { pair: ['play', 'toy'], chose: 'play' },
          { pair: ['play', 'praise'], chose: 'play' },
          { pair: ['praise', 'toy'], chose: 'praise' },
        ]),
      ),
      'recorded',
    )
    expect(
      hierarchy.map((h) => [h.stimulusId, h.timesSelected, h.rank]),
    ).toEqual([
      ['treat', 3, 1],
      ['play', 2, 2],
      ['praise', 1, 3],
      ['toy', 0, 4],
    ])
    expect(hierarchy[0]?.selectionPercentage).toBe(1)
    expect(hierarchy[0]?.timesPresented).toBe(3)
  })

  it('counts a no-selection trial as an opportunity for both stimuli', () => {
    const hierarchy = deriveHierarchy(
      deriveAssessmentTrials(
        syntheticLog([
          { pair: ['toy', 'treat'], chose: 'treat' },
          { pair: ['play', 'treat'], chose: null, recorded: null },
        ]),
      ),
      'recorded',
    )
    const treat = hierarchy.find((h) => h.stimulusId === 'treat')
    expect(treat).toMatchObject({
      timesPresented: 2,
      timesSelected: 1,
      selectionPercentage: 0.5,
    })
    const play = hierarchy.find((h) => h.stimulusId === 'play')
    expect(play).toMatchObject({ timesPresented: 1, timesSelected: 0 })
  })

  it('gives tied stimuli a shared rank and stable stimulus-ID display order', () => {
    // treat and toy each win one of one; play and praise each win none.
    const hierarchy = deriveHierarchy(
      deriveAssessmentTrials(
        syntheticLog([
          { pair: ['play', 'treat'], chose: 'treat' },
          { pair: ['praise', 'toy'], chose: 'toy' },
        ]),
      ),
      'recorded',
    )
    expect(hierarchy.map((h) => [h.stimulusId, h.rank])).toEqual([
      // Ties keep STIMULUS_IDS order: toy before treat, play before praise.
      ['toy', 1],
      ['treat', 1],
      ['play', 3],
      ['praise', 3],
    ])
  })

  it('lists every stimulus, including one never presented', () => {
    const hierarchy = deriveHierarchy(
      deriveAssessmentTrials(
        syntheticLog([{ pair: ['toy', 'treat'], chose: 'treat' }]),
      ),
      'recorded',
    )
    expect(hierarchy.map((h) => h.stimulusId).sort()).toEqual(
      [...STIMULUS_IDS].sort(),
    )
    expect(
      hierarchy.find((h) => h.stimulusId === 'play')?.selectionPercentage,
    ).toBe(0)
  })

  it('excludes an unrecorded trial from the learner hierarchy but not the actual one', () => {
    const summary = deriveAssessmentSummary(
      syntheticLog([
        { pair: ['toy', 'treat'], chose: 'treat' },
        { pair: ['play', 'praise'], chose: 'play', skipRecord: true },
      ]),
    )
    expect(summary.trialsPresented).toBe(2)
    expect(summary.trialsRecorded).toBe(1)
    expect(
      summary.hierarchy.find((h) => h.stimulusId === 'play')?.timesPresented,
    ).toBe(0)
    expect(
      summary.actualHierarchy.find((h) => h.stimulusId === 'play')
        ?.timesPresented,
    ).toBe(1)
  })

  it('reflects a recording error in the learner hierarchy, not the actual one', () => {
    const summary = deriveAssessmentSummary(
      syntheticLog([
        { pair: ['toy', 'treat'], chose: 'treat', recorded: 'toy' },
        { pair: ['play', 'treat'], chose: 'treat' },
        { pair: ['praise', 'treat'], chose: 'treat' },
      ]),
    )
    // The single misrecorded trial is toy's only presentation, so it reads as
    // a perfect (1/1) selector in the learner's hierarchy and displaces the
    // creature's actual top preference -- exactly the kind of observation
    // error the recorded/creature split exists to make visible.
    expect(summary.hierarchy[0]?.stimulusId).toBe('toy')
    expect(summary.hierarchy[0]?.selectionPercentage).toBe(1)
    const recordedTreat = summary.hierarchy.find(
      (h) => h.stimulusId === 'treat',
    )
    expect(recordedTreat?.selectionPercentage).toBeCloseTo(2 / 3, 10)

    expect(summary.actualHierarchy[0]?.stimulusId).toBe('treat')
    expect(summary.actualHierarchy[0]?.selectionPercentage).toBe(1)
    const actualToy = summary.actualHierarchy.find(
      (h) => h.stimulusId === 'toy',
    )
    expect(actualToy?.selectionPercentage).toBe(0)

    expect(summary.recordingAccuracy.accuracy).toBeCloseTo(2 / 3, 10)
  })
})

describe('summary from a live session', () => {
  it('derives a complete, accurately recorded assessment from the log alone', () => {
    const summary = deriveAssessmentSummary(
      runAssessment(SEED).getSnapshot().events,
    )
    expect(summary.trialsPresented).toBe(6)
    expect(summary.trialsRecorded).toBe(6)
    expect(summary.recordingAccuracy.accuracy).toBe(1)
    expect(summary.hierarchy).toEqual(summary.actualHierarchy)
    expect(summary.hierarchy.map((h) => h.rank)).toEqual(
      [...summary.hierarchy.map((h) => h.rank)].sort((a, b) => a - b),
    )
  })
})
