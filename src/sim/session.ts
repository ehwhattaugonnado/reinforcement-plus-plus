import { resolveConfig, type SimConfig } from './config'
import type { Phase, Round, SimEvent, Speed } from './events'
import { createInitialState } from './initial-state'
import { applyEvent } from './project'
import { createRng, type Rng } from './rng'
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
  const listeners = new Set<() => void>()

  let state: SessionState = createInitialState(seed, speed, config)

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

      advanceClock(simDtMs)

      // TODO(Milestone 3): emit seeded response events across this interval,
      // and TODO(Milestone 4): expire due windows. Both must be driven by the
      // simulated-time interval rather than by tick count, so a 30 Hz and a
      // 120 Hz browser produce the same behavior. Draw from `behaviorRng`.
      const generated: SimEvent[] = []
      if (generated.length > 0) return commit(generated)

      for (const listener of listeners) listener()
      return ok([])
    },

    setPaused(paused) {
      if (paused === state.paused) {
        return reject('duplicate-command', `already paused=${String(paused)}`)
      }
      return commit([
        paused
          ? { type: 'paused', at: state.elapsedSimMs }
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
      return commit([
        {
          type: 'phase-changed',
          at: state.elapsedSimMs,
          phase: PHASE_FOR_ROUND[round],
        },
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

      // TODO(Milestone 2): model the creature's choice from current stimulus
      // values, including no-selection trials and bounded satiation, via a
      // dedicated assessment module. It must draw only from `behaviorRng`.
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
          stimulusId: pair[0],
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
      if (
        state.phase !== 'crf' &&
        state.phase !== 'vr' &&
        state.phase !== 'extinction'
      ) {
        return reject('wrong-phase', `in ${state.phase}`)
      }

      // TODO(Milestone 4): classify contingency, timing, and schedule fidelity
      // as three independent dimensions against the active response and the
      // outstanding criterion.
      return commit([
        {
          type: 'stimulus-delivered',
          at: state.elapsedSimMs,
          stimulusId,
          responseId: null,
          latencyMs: null,
          contingency: 'noncontingent',
          timing: 'no-response',
          scheduleFidelity: 'not-applicable',
        },
      ])
    },
  }

  return session
}
