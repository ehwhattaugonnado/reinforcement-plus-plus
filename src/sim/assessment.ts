/**
 * Paired-stimulus preference assessment: the creature's choice model and the
 * event-derived hierarchy/accuracy summaries (Core Loop, Phase A).
 *
 * Two responsibilities, deliberately kept in one module because they are two
 * halves of one teaching point:
 *
 * 1. `chooseInPair` decides what the creature actually does. It draws from the
 *    seeded RNG and therefore runs in the command handler, never in the
 *    projector. Its outcome is recorded in `creature-selected` so that
 *    `project.ts` stays a pure function of (state, event, config).
 * 2. The `derive*` functions read the append-only event log and produce the
 *    hierarchy, selection percentages, and recording accuracy. They hold no
 *    state; there is no parallel mutable summary (ADR 0001).
 *
 * Terminology: the result of this phase is a **preference hierarchy** of
 * **preferred stimuli** — candidate (putative) reinforcers. Nothing here may
 * be called a reinforcer; that claim is earned later, from the event-derived
 * evidence rule in the data model, and it is a claim about a behaviour rather
 * than about the creature.
 */

import type { SimConfig } from './config'
import type { SimEvent } from './events'
import type { Rng } from './rng'
import { STIMULUS_IDS } from './stimuli'
import type { StimulusState } from './types'

/** Selection source for a hierarchy: what happened, or what was written down. */
export type SelectionSource = 'creature' | 'recorded'

/**
 * One assessment trial reconstructed from the log.
 *
 * `creatureSelection` (what happened) and `recordedSelection` (what the
 * learner wrote down) stay separate on purpose: a mismatch is an observation
 * error, which is a teaching point rather than a defect.
 */
export type AssessmentTrialRecord = {
  readonly leftId: string
  readonly rightId: string
  readonly observed: boolean
  readonly creatureSelection: string | null
  readonly recorded: boolean
  readonly recordedSelection: string | null
}

export type StimulusRanking = {
  readonly stimulusId: string
  readonly timesPresented: number
  readonly timesSelected: number
  /** Selections divided by presentations, 0-1. 0 when never presented. */
  readonly selectionPercentage: number
  /** Shared ("competition") rank: 1, 2, 2, 4. Ties keep stimulus-ID order. */
  readonly rank: number
}

export type RecordingAccuracy = {
  readonly comparableTrials: number
  readonly matchingTrials: number
  /** Matches divided by comparable trials. `null` when nothing is comparable. */
  readonly accuracy: number | null
}

export type AssessmentSummary = {
  readonly trials: readonly AssessmentTrialRecord[]
  readonly trialsPresented: number
  readonly trialsRecorded: number
  readonly noSelectionTrials: number
  readonly recordingAccuracy: RecordingAccuracy
  /** The learner's hierarchy, built from recorded data, as a real one would be. */
  readonly hierarchy: readonly StimulusRanking[]
  /** What the creature actually did, for the debrief comparison (Milestone 7). */
  readonly actualHierarchy: readonly StimulusRanking[]
}

// ---------------------------------------------------------------------------
// Choice model
// ---------------------------------------------------------------------------

/**
 * Decides what the creature does when a pair is offered.
 *
 * Choice follows a ratio rule on current stimulus value raised to
 * `assessmentChoiceSensitivity`: a clearly preferred item usually wins, but no
 * trial is a certainty, so a six-trial assessment stays a noisy sample rather
 * than a lookup of the latent ranking.
 *
 * Returns the chosen stimulus ID, or `null` for a no-selection trial. Approach
 * becomes less likely as both items in the pair lose value, which is how
 * repeated access shows up in the assessment.
 *
 * Draws **exactly two** values from `rng` on every call, whatever the outcome,
 * so that adding a short-circuit later cannot shift the seeded stream.
 */
export function chooseInPair(
  stimuli: readonly StimulusState[],
  leftId: string,
  rightId: string,
  rng: Rng,
  config: SimConfig,
): string | null {
  const left = valueOf(stimuli, leftId)
  const right = valueOf(stimuli, rightId)

  const noSelectionRoll = rng.next()
  const choiceRoll = rng.next()

  const best = Math.max(left, right)
  const noSelectionProbability = clamp01(
    config.assessmentNoSelectionScale * (1 - clamp01(best)),
  )
  if (noSelectionRoll < noSelectionProbability) return null

  const k = config.assessmentChoiceSensitivity
  const leftWeight = Math.pow(Math.max(left, 0), k)
  const rightWeight = Math.pow(Math.max(right, 0), k)
  const total = leftWeight + rightWeight
  // Guard the ratio rule: with two valueless items the choice is a coin flip
  // rather than a NaN that would silently favour one side.
  if (!(total > 0)) return choiceRoll < 0.5 ? leftId : rightId
  return choiceRoll < leftWeight / total ? leftId : rightId
}

/**
 * Applies the satiation from one brief, equal period of post-selection access.
 *
 * The reduction is proportional and floored at
 * `assessmentSatiationFloorFraction` of the stimulus's `basePreference`, which
 * is what keeps the effect *bounded*: a stimulus can be selected at most three
 * times in a six-trial assessment, so accumulated satiation can never be large
 * enough for trial order to dominate the resulting hierarchy (Core Loop,
 * Phase A).
 *
 * Pure, so the projector can fold it straight from `creature-selected`.
 */
export function applyAccessSatiation(
  stimuli: readonly StimulusState[],
  stimulusId: string,
  config: SimConfig,
): readonly StimulusState[] {
  return stimuli.map((stimulus) => {
    if (stimulus.stimulusId !== stimulusId) return stimulus
    const floor =
      stimulus.basePreference * config.assessmentSatiationFloorFraction
    const decayed =
      stimulus.currentValue * (1 - config.assessmentSatiationPerAccess)
    return { ...stimulus, currentValue: Math.max(floor, decayed) }
  })
}

function valueOf(stimuli: readonly StimulusState[], id: string): number {
  return stimuli.find((s) => s.stimulusId === id)?.currentValue ?? 0
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

// ---------------------------------------------------------------------------
// Event-derived summaries
// ---------------------------------------------------------------------------

/** Rebuilds the assessment trials from the log alone. */
export function deriveAssessmentTrials(
  events: readonly SimEvent[],
): readonly AssessmentTrialRecord[] {
  const trials: AssessmentTrialRecord[] = []
  for (const event of events) {
    if (event.type === 'pair-presented') {
      trials.push({
        leftId: event.leftId,
        rightId: event.rightId,
        observed: false,
        creatureSelection: null,
        recorded: false,
        recordedSelection: null,
      })
      continue
    }
    const current = trials[trials.length - 1]
    if (current === undefined) continue
    if (event.type === 'creature-selected') {
      trials[trials.length - 1] = {
        ...current,
        observed: true,
        creatureSelection: event.stimulusId,
      }
    } else if (event.type === 'selection-recorded') {
      trials[trials.length - 1] = {
        ...current,
        recorded: true,
        recordedSelection: event.stimulusId,
      }
    }
  }
  return trials
}

/**
 * Ranks stimuli by selection percentage.
 *
 * The denominator is the number of times a stimulus was *presented* in a
 * resolved trial, so a no-selection trial still counts as an opportunity for
 * both of its stimuli and lowers both percentages. Ties share a rank and are
 * listed in stable stimulus-ID order, so the display never reshuffles between
 * renders (Core Loop, Phase A).
 */
export function deriveHierarchy(
  trials: readonly AssessmentTrialRecord[],
  source: SelectionSource,
): readonly StimulusRanking[] {
  const presented = new Map<string, number>()
  const selected = new Map<string, number>()
  for (const id of STIMULUS_IDS) {
    presented.set(id, 0)
    selected.set(id, 0)
  }

  for (const trial of trials) {
    const resolved = source === 'recorded' ? trial.recorded : trial.observed
    if (!resolved) continue
    for (const id of [trial.leftId, trial.rightId]) {
      presented.set(id, (presented.get(id) ?? 0) + 1)
    }
    const choice =
      source === 'recorded' ? trial.recordedSelection : trial.creatureSelection
    if (choice !== null) selected.set(choice, (selected.get(choice) ?? 0) + 1)
  }

  const ids = [...new Set([...presented.keys()])]
  const rows = ids.map((stimulusId) => {
    const timesPresented = presented.get(stimulusId) ?? 0
    const timesSelected = selected.get(stimulusId) ?? 0
    return {
      stimulusId,
      timesPresented,
      timesSelected,
      selectionPercentage:
        timesPresented === 0 ? 0 : timesSelected / timesPresented,
    }
  })

  // Stable display order: percentage descending, then stimulus-ID order.
  const order = new Map(STIMULUS_IDS.map((id, i) => [id as string, i]))
  const sorted = [...rows].sort((a, b) => {
    if (b.selectionPercentage !== a.selectionPercentage) {
      return b.selectionPercentage - a.selectionPercentage
    }
    const ai = order.get(a.stimulusId) ?? Number.MAX_SAFE_INTEGER
    const bi = order.get(b.stimulusId) ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    return a.stimulusId < b.stimulusId ? -1 : 1
  })

  return sorted.map((row) => ({
    ...row,
    rank:
      1 +
      sorted.filter(
        (other) => other.selectionPercentage > row.selectionPercentage,
      ).length,
  }))
}

/**
 * Recording accuracy: recorded selections that match what the creature did,
 * divided by the trials where both are available. A trial where the creature
 * made no selection and the learner recorded "no selection" is a match.
 */
export function deriveRecordingAccuracy(
  trials: readonly AssessmentTrialRecord[],
): RecordingAccuracy {
  const comparable = trials.filter((t) => t.observed && t.recorded)
  const matching = comparable.filter(
    (t) => t.creatureSelection === t.recordedSelection,
  )
  return {
    comparableTrials: comparable.length,
    matchingTrials: matching.length,
    accuracy:
      comparable.length === 0 ? null : matching.length / comparable.length,
  }
}

/** One event-derived summary of the assessment phase. */
export function deriveAssessmentSummary(
  events: readonly SimEvent[],
): AssessmentSummary {
  const trials = deriveAssessmentTrials(events)
  return {
    trials,
    trialsPresented: trials.length,
    trialsRecorded: trials.filter((t) => t.recorded).length,
    noSelectionTrials: trials.filter(
      (t) => t.observed && t.creatureSelection === null,
    ).length,
    recordingAccuracy: deriveRecordingAccuracy(trials),
    hierarchy: deriveHierarchy(trials, 'recorded'),
    actualHierarchy: deriveHierarchy(trials, 'creature'),
  }
}
