import type { SimConfig } from './config'
import type { Phase, SimEvent } from './events'
import {
  computeResponseRatePerMinute,
  deriveLearnedStrength,
  deriveStimuliValues,
} from './learning'
import type { AssessmentTrial, SchedulePlan, SessionState } from './types'

/**
 * The single projector: folds one event onto an immutable snapshot.
 *
 * This is the only place session state changes. Live play and replay both go
 * through it, which is what makes replay equivalence a property of the design
 * rather than something a second code path has to keep in sync (ADR 0001).
 *
 * It must stay a pure function of (state, event, config): no RNG, no clock, no
 * IO. Anything an event's consequences depend on has to be *in* the event.
 */
export function applyEvent(
  state: SessionState,
  event: SimEvent,
  config: SimConfig,
): SessionState {
  const next = applyToFields(state, event, config)
  return {
    ...next,
    // `at` is simulated time, so folding a log restores the clock without a
    // parallel data path. Guard against a non-monotonic log lowering it.
    elapsedSimMs: Math.max(next.elapsedSimMs, event.at),
    events: [...state.events, event],
  }
}

export function applyEvents(
  state: SessionState,
  events: readonly SimEvent[],
  config: SimConfig,
): SessionState {
  return events.reduce((acc, e) => applyEvent(acc, e, config), state)
}

function applyToFields(
  state: SessionState,
  event: SimEvent,
  config: SimConfig,
): SessionState {
  switch (event.type) {
    case 'session-started':
      return { ...state, speed: event.speed }

    case 'paused':
      return { ...state, paused: true }

    case 'resumed':
      return { ...state, paused: false }

    case 'speed-changed':
      return { ...state, speed: event.speed }

    case 'phase-changed':
      return {
        ...state,
        phase: event.phase,
        schedulePlan: planFor(event.phase, config),
      }

    case 'pair-presented':
      return {
        ...state,
        assessment: {
          ...state.assessment,
          trials: [
            ...state.assessment.trials,
            {
              leftId: event.leftId,
              rightId: event.rightId,
              creatureSelection: null,
              recordedSelection: null,
              recorded: false,
            },
          ],
        },
      }

    case 'creature-selected':
      return withCurrentTrial(state, (trial) => ({
        ...trial,
        creatureSelection: event.stimulusId,
      }))

    case 'selection-recorded': {
      const recorded = withCurrentTrial(state, (trial) => ({
        ...trial,
        recordedSelection: event.stimulusId,
        recorded: true,
      }))
      const nextIndex = recorded.assessment.currentTrialIndex + 1
      return {
        ...recorded,
        assessment: {
          ...recorded.assessment,
          currentTrialIndex: nextIndex,
          complete: nextIndex >= recorded.assessment.plannedPairs.length,
        },
      }
    }

    // Response, criterion, and delivery effects on the creature belong to the
    // learning model (see learning.ts). Routing them through one function keeps
    // the causal invariant in a single reviewable place: the selected schedule
    // never appears among its inputs (ADR 0003).
    case 'response-emitted':
    case 'criterion-met':
    case 'criterion-missed':
    case 'cycle-abandoned':
    case 'stimulus-delivered':
      return applyBehavioralEvent(state, event, config)
  }
}

function applyBehavioralEvent(
  state: SessionState,
  event: SimEvent,
  config: SimConfig,
): SessionState {
  if (
    event.type === 'stimulus-delivered' ||
    event.type === 'response-emitted'
  ) {
    // Every field below is re-derived from the event log (including `event`
    // itself, not yet appended to `state.events` at this point) rather than
    // updated incrementally, so live play and replay can never drift apart
    // and no schedule-dependent shortcut can sneak in (ADR 0003).
    const eventsSoFar = [...state.events, event]
    const atMs = event.at
    const learnedStrength = deriveLearnedStrength(eventsSoFar, atMs, config)
    const stimuli = deriveStimuliValues(
      eventsSoFar,
      state.creature.stimuli,
      atMs,
      config,
    )
    const creatureWithUpdates = {
      ...state.creature,
      stimuli,
      targetBehavior: { ...state.creature.targetBehavior, learnedStrength },
    }
    const currentRatePerMinute = computeResponseRatePerMinute(
      eventsSoFar,
      atMs,
      config,
      creatureWithUpdates,
    )
    return {
      ...state,
      creature: {
        ...creatureWithUpdates,
        targetBehavior: {
          ...creatureWithUpdates.targetBehavior,
          currentRatePerMinute,
        },
      },
    }
  }
  if (event.type === 'criterion-met' && state.schedulePlan?.type === 'VR') {
    return {
      ...state,
      schedulePlan: { ...state.schedulePlan, responsesSinceReinforcement: 0 },
    }
  }
  return state
}

function withCurrentTrial(
  state: SessionState,
  update: (trial: AssessmentTrial) => AssessmentTrial,
): SessionState {
  const trials = state.assessment.trials
  const index = trials.length - 1
  const current = trials[index]
  if (current === undefined) return state
  const nextTrials = [...trials]
  nextTrials[index] = update(current)
  return { ...state, assessment: { ...state.assessment, trials: nextTrials } }
}

function planFor(phase: Phase, config: SimConfig): SchedulePlan | null {
  switch (phase) {
    case 'crf':
      return { type: 'CRF', responsesRequired: 1 }
    case 'vr':
      return {
        type: 'VR',
        meanRatio: 3,
        // TODO(Milestone 5): seeded shuffled requirement blocks. The first
        // requirement must come from the log, not from a fresh draw here,
        // because this projector is pure.
        currentRequirement: config.vrMeanRatio,
        responsesSinceReinforcement: 0,
        generatedRequirements: [],
      }
    default:
      return null
  }
}
