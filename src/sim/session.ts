import { chooseInPair } from './assessment'
import { deriveAssessmentSummary } from './assessment'
import {
  buildCumulativeRecordChartData,
  buildResponseRateChartData,
} from './chart-data'
import { resolveConfig, type SimConfig } from './config'
import {
  classifyDelivery,
  crfAcquisitionMet,
  crfCoachingDue,
  crfCoachingPauseRecorded,
  crfRoundWindow,
  deriveOutstandingCycle,
  deriveCrfMetrics,
  type OutstandingCycle,
} from './crf'
import type { Phase, Round, SimEvent, Speed } from './events'
import { detectExtinctionBurst, evaluateReinforcerEvidence } from './evidence'
import { createInitialState } from './initial-state'
import {
  RESPONDING_PHASES,
  isBaselineComplete,
  meanInterarrivalMs,
} from './learning'
import { applyEvent } from './project'
import { createRng, type Rng } from './rng'
import {
  classifyVrDelivery,
  vrCoachingDue,
  vrCoachingPauseRecorded,
  vrCyclesCompleted,
  vrRoundWindow,
  vrTrialHistory,
} from './vr'
import { isStimulusId } from './stimuli'
import {
  ok,
  reject,
  type CommandResult,
  type SessionState,
  type SimSession,
} from './types'

export type CreateSessionOptions = {
  seed?: string
  speed?: Speed
  /** Test/fixture only. The production UI always uses documented defaults. */
  config?: Partial<SimConfig>
}

const PHASE_FOR_ROUND: Record<Round, Phase> = {
  baseline: 'baseline',
  crf: 'crf',
  vr: 'vr',
  extinction: 'extinction',
}

/** Rounds must be entered in this order; extinction is optional. */
const ROUND_PREREQUISITE: Record<Round, Phase[]> = {
  baseline: ['assessment'],
  crf: ['baseline'],
  vr: ['crf'],
  extinction: ['vr'],
}

export function createSession(
  options: CreateSessionOptions = {},
): SimSession & { readonly rng: Rng } {
  const seed = options.seed ?? 'default-seed'
  const speed = options.speed ?? 1
  const { config, configVersion } = resolveConfig(options.config)

  const behaviorRng = createRng(seed, 'behavior')
  // A separate, namespaced stream drives only response timing (rng.ts's
  // `label`), so a future draw elsewhere (e.g. the Milestone 2 assessment,
  // which uses `behaviorRng`) can never shift the response-timestamp
  // sequence this milestone's known-seed tests pin down.
  const responseRng = createRng(seed, 'responses')
  const listeners = new Set<() => void>()

  let state: SessionState = createInitialState(seed, speed, config)
  let nextResponseDueMs: number | undefined
  let responseSeq = 0

  /**
   * The single commit point. A command validates fully, builds its candidate
   * events, and commits them here in one step; there is no path that mutates
   * incrementally and unwinds on error. A rejected command therefore appends
   * nothing, notifies nobody, and draws no randomness (ADR 0008).
   */
  function commit(events: readonly SimEvent[]): CommandResult {
    if (events.length === 0) return ok(events)
    for (const event of events) state = applyEvent(state, event, config)
    for (const listener of listeners) listener()
    return ok(events)
  }

  /**
   * Advances the controlled clock. The clock is not a summary of the log and
   * so is not a parallel data path: every event a tick produces is recorded
   * with its simulated timestamp, and replay restores time from those
   * timestamps. Ticks that produce no events are not themselves recorded,
   * because reconstructing state as of the last event is exactly what replay
   * needs.
   */
  function advanceClock(simDtMs: number): void {
    state = { ...state, elapsedSimMs: state.elapsedSimMs + simDtMs }
  }

  commit([
    { type: 'session-started', at: 0, seed, speed, configVersion },
    { type: 'phase-changed', at: 0, phase: 'assessment' },
  ])

  const session: SimSession & { readonly rng: Rng } = {
    rng: behaviorRng,

    getSnapshot: () => state,

    getTrainingStatus() {
      const extinctionStart = [...state.events]
        .reverse()
        .find((e) => e.type === 'phase-changed' && e.phase === 'extinction')?.at
      const extinctionElapsed =
        extinctionStart === undefined ? 0 : state.elapsedSimMs - extinctionStart
      const credited = vrCyclesCompleted(state.events)
      const crfWindow = crfRoundWindow(state.events)
      return {
        baselineComplete: isBaselineComplete(
          state.events,
          state.elapsedSimMs,
          config,
        ),
        outstandingCycle:
          state.phase === 'crf'
            ? deriveOutstandingCycle(state.events, config)
            : null,
        crfMetrics:
          crfWindow === null
            ? deriveCrfMetrics([])
            : deriveCrfMetrics(
                state.events,
                crfWindow.startMs,
                crfWindow.endMs ?? state.elapsedSimMs,
              ),
        acquisitionMet: crfAcquisitionMet(
          state.events,
          state.elapsedSimMs,
          config,
        ),
        crfCoachingDue: crfCoachingDue(
          state.events,
          state.elapsedSimMs,
          config,
        ),
        vrCoachingDue: vrCoachingDue(state.events, state.elapsedSimMs, config),
        vrCredited: credited,
        vrRequired: config.vrCyclesToComplete,
        vrRemaining: Math.max(0, config.vrCyclesToComplete - credited),
        vrHistory: vrTrialHistory(state.events),
        extinctionComplete:
          extinctionStart !== undefined &&
          extinctionElapsed >= config.extinctionDurationMs,
        extinctionRemainingMs:
          extinctionStart === undefined
            ? config.extinctionDurationMs
            : Math.max(0, config.extinctionDurationMs - extinctionElapsed),
      }
    },

    getDebriefSummary() {
      const evidenceByStimulus = state.creature.stimuli.map((stimulus) =>
        evaluateReinforcerEvidence(state.events, config, stimulus.stimulusId),
      )
      return {
        assessment: deriveAssessmentSummary(state.events),
        evidenceByStimulus,
        demonstratedStimulusIds: evidenceByStimulus
          .filter((result) => result.kind === 'evidence-met')
          .map((result) => result.stimulusId),
        extinction: detectExtinctionBurst(state.events, config),
        totalResponses: state.events.filter(
          (event) => event.type === 'response-emitted',
        ).length,
        crfMetrics: session.getTrainingStatus().crfMetrics,
        vrCredited: vrCyclesCompleted(state.events),
        vrRequired: config.vrCyclesToComplete,
        cumulativeRecord: buildCumulativeRecordChartData(
          state.events,
          state.elapsedSimMs,
        ),
        responseRates: buildResponseRateChartData(
          state.events,
          undefined,
          state.elapsedSimMs,
        ),
      }
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    /**
     * Advances the controlled clock. `realDtMs` is elapsed wall-clock time; the
     * core caps unexpected deltas and applies the speed setting to produce
     * simulated time, so a backgrounded tab cannot silently advance a round.
     *
     * A tick while paused is accepted and advances nothing, because the shell
     * drives ticks from an animation frame that does not stop on pause
     * (ADR 0008).
     */
    tick(realDtMs) {
      if (!Number.isFinite(realDtMs) || realDtMs < 0) {
        return reject('invalid-argument', `realDtMs=${String(realDtMs)}`)
      }
      if (state.paused) return ok([])

      const cappedMs = Math.min(realDtMs, config.maxTickDeltaMs)
      const simDtMs = cappedMs * state.speed
      if (simDtMs <= 0) return ok([])

      const windowStart = state.elapsedSimMs
      const requestedWindowEnd = windowStart + simDtMs
      let coachingRound: 'crf' | 'vr' | null = null
      let coachingAtMs: number | null = null
      if (state.phase === 'crf' && !crfCoachingPauseRecorded(state.events)) {
        const round = crfRoundWindow(state.events)
        const threshold =
          (round?.startMs ?? Infinity) + config.crfCoachingPauseMs
        if (
          threshold <= requestedWindowEnd &&
          !crfAcquisitionMet(state.events, threshold, config)
        ) {
          coachingRound = 'crf'
          coachingAtMs = Math.max(windowStart, threshold)
        }
      } else if (
        state.phase === 'vr' &&
        !vrCoachingPauseRecorded(state.events)
      ) {
        const round = vrRoundWindow(state.events)
        const threshold =
          (round?.startMs ?? Infinity) + config.vrCoachingPauseMs
        if (
          threshold <= requestedWindowEnd &&
          vrCyclesCompleted(state.events) < config.vrCyclesToComplete
        ) {
          coachingRound = 'vr'
          coachingAtMs = Math.max(windowStart, threshold)
        }
      }
      const windowEnd = coachingAtMs ?? requestedWindowEnd
      advanceClock(windowEnd - windowStart)

      // Seeded free-operant response process: responses are drawn as an
      // interval-based hazard (exponential inter-response time), not a
      // per-frame coin flip, so a 30 Hz and a 120 Hz browser produce exactly
      // the same sequence of response timestamps for the same simulated-time
      // interval (ADR 0005). The rate is re-read from state after each
      // response, since `applyEvent` (via `applyBehavioralEvent`) just
      // recomputed it from the event log the response is now part of.
      //
      // Due-window expiry (Milestone 4) is merged into the same forward walk
      // as a second, independent candidate: whichever of "next response due"
      // or "outstanding cycle's due-by instant" comes first within this
      // tick's window is processed next. Abandonment never redraws
      // `responseRng` or perturbs `nextResponseDueMs` -- an unreinforced
      // cycle timing out does not change the creature's behavior (ADR 0003),
      // so it must not shift the response-timestamp sequence known-seed
      // tests and replay pin down.
      const generated: SimEvent[] = []
      if (RESPONDING_PHASES.has(state.phase)) {
        if (nextResponseDueMs === undefined) {
          const rate = state.creature.targetBehavior.currentRatePerMinute
          nextResponseDueMs =
            windowStart + responseRng.nextExponential(meanInterarrivalMs(rate))
        }

        for (;;) {
          const outstanding = deriveOutstandingCycle(state.events, config)
          const abandonAtMs = outstanding?.dueByMs

          const respondFirst =
            abandonAtMs === undefined || nextResponseDueMs <= abandonAtMs
          const candidateAtMs = respondFirst ? nextResponseDueMs : abandonAtMs

          if (candidateAtMs === undefined || candidateAtMs > windowEnd) break

          if (respondFirst) {
            const event: SimEvent = {
              type: 'response-emitted',
              at: nextResponseDueMs,
              responseId: `response-${++responseSeq}`,
            }
            state = applyEvent(state, event, config)
            generated.push(event)

            // CRF: every response meets the schedule criterion (core-loop.md
            // Round 1). VR no longer opens a criterion at all (ADR 0010):
            // there is no discrete "the schedule is now due" instant under a
            // no-floor running-average model, only a continuous judgment
            // made at the instant of each delivery (see vr.ts's
            // `classifyVrDelivery`). Extinction intentionally opens none
            // either: withheld reinforcement is the whole point of the
            // round. Extinction records the response as a VR eligibility
            // criterion whose consequence was withheld, providing the
            // event-derived anchor used by burst detection. CRF's outstanding
            // cycle projector deliberately ignores these VR-stamped anchors.
            const opensCrfCriterion = state.phase === 'crf'
            if (
              opensCrfCriterion &&
              deriveOutstandingCycle(state.events, config) === null
            ) {
              const criterionMetEvent: SimEvent = {
                type: 'criterion-met',
                at: event.at,
                responseId: event.responseId,
                schedule: 'CRF',
              }
              state = applyEvent(state, criterionMetEvent, config)
              generated.push(criterionMetEvent)
            }
            if (state.phase === 'extinction') {
              const withheldCriterionEvent: SimEvent = {
                type: 'criterion-met',
                at: event.at,
                responseId: event.responseId,
                schedule: 'VR',
              }
              state = applyEvent(state, withheldCriterionEvent, config)
              generated.push(withheldCriterionEvent)
            }

            const rate = state.creature.targetBehavior.currentRatePerMinute
            nextResponseDueMs =
              event.at + responseRng.nextExponential(meanInterarrivalMs(rate))
          } else {
            const due = outstanding as OutstandingCycle
            const missedEvent: SimEvent = {
              type: 'criterion-missed',
              at: due.dueByMs,
              responseId: due.responseId,
            }
            state = applyEvent(state, missedEvent, config)
            generated.push(missedEvent)

            const abandonedEvent: SimEvent = {
              type: 'cycle-abandoned',
              at: due.dueByMs,
              reason: 'due-window-elapsed',
            }
            state = applyEvent(state, abandonedEvent, config)
            generated.push(abandonedEvent)
          }
        }
      }

      if (coachingRound !== null && coachingAtMs !== null) {
        const pauseEvent: SimEvent = {
          type: 'paused',
          at: coachingAtMs,
          reason: 'coaching',
          round: coachingRound,
        }
        state = applyEvent(state, pauseEvent, config)
        generated.push(pauseEvent)
      }

      for (const listener of listeners) listener()
      return ok(generated)
    },

    setPaused(paused) {
      if (paused === state.paused) {
        return reject('duplicate-command', `already paused=${String(paused)}`)
      }
      return commit([
        paused
          ? { type: 'paused', at: state.elapsedSimMs, reason: 'user' }
          : { type: 'resumed', at: state.elapsedSimMs },
      ])
    },

    setSpeed(speed) {
      if (speed !== 0.5 && speed !== 1) {
        return reject('invalid-argument', `speed=${String(speed)}`)
      }
      if (speed === state.speed) {
        return reject('duplicate-command', `already at ${String(speed)}x`)
      }
      return commit([{ type: 'speed-changed', at: state.elapsedSimMs, speed }])
    },

    startRound(round) {
      const allowed = ROUND_PREREQUISITE[round]
      if (allowed === undefined) {
        return reject('invalid-argument', `round=${String(round)}`)
      }
      if (round === 'baseline' && !state.assessment.complete) {
        return reject('not-started', 'assessment is not complete')
      }
      if (state.phase === PHASE_FOR_ROUND[round]) {
        return reject('duplicate-command', `already in ${round}`)
      }
      if (!allowed.includes(state.phase)) {
        return reject(
          'wrong-phase',
          `in ${state.phase}, need ${allowed.join('|')}`,
        )
      }
      if (
        round === 'crf' &&
        !isBaselineComplete(state.events, state.elapsedSimMs, config)
      ) {
        return reject(
          'baseline-not-complete',
          `${config.baselineDurationMs} simulated ms of baseline are required`,
        )
      }
      if (
        round === 'vr' &&
        !crfAcquisitionMet(state.events, state.elapsedSimMs, config)
      ) {
        return reject(
          'acquisition-not-met',
          'CRF acquisition gate (min on-schedule deliveries and response-rate ' +
            'increase over baseline) is not yet met',
        )
      }
      if (
        round === 'extinction' &&
        vrCyclesCompleted(state.events) < config.vrCyclesToComplete
      ) {
        return reject(
          'vr-cycles-not-met',
          `${config.vrCyclesToComplete} completed on-schedule VR cycles are required`,
        )
      }

      // A round can end with a criterion outstanding (reinforcement due but
      // not yet delivered or timed out). Abandon it here, before the phase
      // change, so the fidelity denominator never has a dangling cycle
      // (data-model section 5). No `criterion-missed` accompanies this:
      // that diagnostic event is reserved for an elapsed due window, not for
      // a learner-initiated round transition (core-loop.md Round 2 -- "the
      // only way a criterion is missed").
      const events: SimEvent[] = []
      if (deriveOutstandingCycle(state.events, config) !== null) {
        events.push({
          type: 'cycle-abandoned',
          at: state.elapsedSimMs,
          reason: 'round-ended',
        })
      }
      events.push({
        type: 'phase-changed',
        at: state.elapsedSimMs,
        phase: PHASE_FOR_ROUND[round],
      })
      return commit(events)
    },

    finishSession() {
      if (state.phase === 'vr') {
        if (vrCyclesCompleted(state.events) < config.vrCyclesToComplete) {
          return reject(
            'vr-cycles-not-met',
            `${config.vrCyclesToComplete} completed on-schedule VR cycles are required`,
          )
        }
      } else if (state.phase === 'extinction') {
        const extinctionStart = [...state.events]
          .reverse()
          .find(
            (e) => e.type === 'phase-changed' && e.phase === 'extinction',
          )?.at
        if (
          extinctionStart === undefined ||
          state.elapsedSimMs - extinctionStart < config.extinctionDurationMs
        ) {
          return reject(
            'extinction-not-complete',
            `${config.extinctionDurationMs} simulated ms of extinction are required`,
          )
        }
      } else {
        return reject('wrong-phase', `in ${state.phase}`)
      }
      return commit([
        { type: 'phase-changed', at: state.elapsedSimMs, phase: 'debrief' },
      ])
    },

    presentNextPair() {
      if (state.phase !== 'assessment') {
        return reject('wrong-phase', `in ${state.phase}`)
      }
      if (state.assessment.complete) return reject('already-complete')

      const trials = state.assessment.trials
      const last = trials[trials.length - 1]
      if (last !== undefined && !last.recorded) {
        return reject('duplicate-command', 'current trial is not recorded yet')
      }

      const pair =
        state.assessment.plannedPairs[state.assessment.currentTrialIndex]
      if (pair === undefined) return reject('already-complete')

      // Every validation above has passed, so the draws below are on the
      // committed path: a rejected command still consumes no randomness
      // (ADR 0008). The choice is made here, not in the projector, and is
      // written into the event so replay folds it without an RNG.
      const stimulusId = chooseInPair(
        state.creature.stimuli,
        pair[0],
        pair[1],
        behaviorRng,
        config,
      )
      return commit([
        {
          type: 'pair-presented',
          at: state.elapsedSimMs,
          leftId: pair[0],
          rightId: pair[1],
        },
        {
          type: 'creature-selected',
          at: state.elapsedSimMs,
          stimulusId,
        },
      ])
    },

    recordObservedSelection(stimulusId) {
      if (state.phase !== 'assessment') {
        return reject('wrong-phase', `in ${state.phase}`)
      }
      if (stimulusId !== null && !isStimulusId(stimulusId)) {
        return reject('unknown-stimulus', stimulusId)
      }
      const trials = state.assessment.trials
      const current = trials[trials.length - 1]
      if (current === undefined)
        return reject('not-started', 'no pair presented')
      if (current.recorded)
        return reject('duplicate-command', 'trial already recorded')

      return commit([
        { type: 'selection-recorded', at: state.elapsedSimMs, stimulusId },
      ])
    },

    deliverStimulus(stimulusId) {
      if (!isStimulusId(stimulusId))
        return reject('unknown-stimulus', stimulusId)
      if (state.phase !== 'crf' && state.phase !== 'vr') {
        return reject('wrong-phase', `in ${state.phase}`)
      }

      // Classification happens here, on the committed path, so the
      // resulting event carries its own contingency/timing/schedule-fidelity
      // dimensions and replay never needs to re-derive them (crf.ts, vr.ts).
      // VR judges every delivery independently against the round's running
      // average (ADR 0010); CRF and extinction keep the exact-match cycle
      // classifier.
      const classification =
        state.phase === 'vr'
          ? classifyVrDelivery(state.events, state.elapsedSimMs, config)
          : classifyDelivery(state.events, state.elapsedSimMs, config)
      const schedule =
        state.phase === 'crf' ? 'CRF' : state.phase === 'vr' ? 'VR' : null
      return commit([
        {
          type: 'stimulus-delivered',
          at: state.elapsedSimMs,
          stimulusId,
          responseId: classification.responseId,
          latencyMs: classification.latencyMs,
          contingency: classification.contingency,
          timing: classification.timing,
          scheduleFidelity: classification.scheduleFidelity,
          schedule,
        },
      ])
    },
  }

  return session
}
