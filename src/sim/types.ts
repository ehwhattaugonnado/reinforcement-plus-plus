import type { Phase, Round, SimEvent, Speed } from './events'
import type { CrfMetrics, OutstandingCycle } from './crf'
import type { VrTrialMark } from './vr'
import type { AssessmentSummary } from './assessment'
import type {
  CumulativeRecordChartData,
  ResponseRateChartData,
} from './chart-data'
import type { BurstDetectionResult, ReinforcerEvidenceResult } from './evidence'

/**
 * Immutable snapshot of session state. Every field is derivable by folding the
 * event log over a seeded initial state, which is what makes replay a pure
 * function (ADR 0001, ADR 0009).
 *
 * Note that the seeded RNG stream is deliberately *not* part of the snapshot:
 * it drives live event generation, and every event it produces is recorded, so
 * replay never needs to reproduce its internal position.
 *
 * See docs/architecture/data-model.md section 2.
 */
export type SessionState = {
  readonly id: string
  readonly seed: string
  readonly phase: Phase
  /**
   * Simulated milliseconds elapsed. Advances only while unpaused and is scaled
   * by `speed`, so paused wall-clock time is already excluded here — rate
   * calculations need no second data path to subtract it.
   */
  readonly elapsedSimMs: number
  readonly speed: Speed
  readonly paused: boolean
  readonly creature: CreatureState
  readonly assessment: AssessmentState
  readonly schedulePlan: SchedulePlan | null
  readonly events: readonly SimEvent[]
}

export type MoodState = 'content' | 'neutral' | 'disinterested' | 'frustrated'

export type StimulusState = {
  readonly stimulusId: string
  readonly basePreference: number
  readonly currentValue: number
}

export type CreatureState = {
  readonly id: string
  readonly name: string
  readonly moodState: MoodState
  readonly stimuli: readonly StimulusState[]
  readonly targetBehavior: {
    readonly behaviorId: string
    readonly baselineRatePerMinute: number
    readonly learnedStrength: number
    readonly currentRatePerMinute: number
    /**
     * Seeded once at session creation (`initial-state.ts`): whether this
     * creature's extinction-transition state includes a genuine transient
     * response-rate increase after reinforcement stops. Read only by
     * `computeResponseRatePerMinute`; the burst *detector* (`evidence.ts`)
     * never sees this field and must derive its verdict from the resulting
     * events alone (AGENTS.md: no narrative burst flag).
     */
    readonly extinctionBurstPrimed: boolean
    /** Seeded [0.5, 1.5] multiplier on a primed creature's burst magnitude. */
    readonly extinctionBurstMagnitudeScale: number
  }
}

export type AssessmentTrial = {
  readonly leftId: string
  readonly rightId: string
  /** What the creature actually did. */
  readonly creatureSelection: string | null
  /** What the learner recorded. Kept separate so observation errors surface. */
  readonly recordedSelection: string | null
  readonly recorded: boolean
}

export type AssessmentState = {
  /** Seeded order of the six unique pairs, generated once at session start. */
  readonly plannedPairs: readonly (readonly [string, string])[]
  readonly trials: readonly AssessmentTrial[]
  readonly currentTrialIndex: number
  readonly complete: boolean
}

/** V1 runtime types contain only CRF and VR. */
export type SchedulePlan =
  | { readonly type: 'CRF'; readonly responsesRequired: 1 }
  | {
      readonly type: 'VR'
      readonly meanRatio: 3
      readonly responsesSinceReinforcement: number
      readonly acceptedGaps: readonly number[]
      readonly runningAverage: number
    }

/**
 * Why a command was refused. A closed union owned by the simulation core; the
 * React shell maps these to learner-facing copy, and the core never produces
 * display strings (ADR 0008).
 */
export type CommandRejectionReason =
  | 'wrong-phase'
  | 'duplicate-command'
  | 'not-started'
  | 'already-complete'
  | 'unknown-stimulus'
  | 'invalid-argument'
  | 'baseline-not-complete'
  /**
   * CRF -> VR only (Milestone 4): rejected until both
   * `crfMinOnScheduleDeliveries` on-schedule deliveries and the
   * acquisition-rate threshold are met (data-model section 6). See
   * `crfAcquisitionMet` in `crf.ts`.
   */
  | 'acquisition-not-met'
  /**
   * VR -> extinction only (Milestone 5): rejected until
   * `vrCyclesToComplete` on-schedule VR cycles have completed
   * (data-model section 6). See `vrCyclesCompleted` in `vr.ts`.
   */
  | 'vr-cycles-not-met'
  | 'extinction-not-complete'

export type CommandResult =
  | { readonly ok: true; readonly events: readonly SimEvent[] }
  | {
      readonly ok: false
      readonly reason: CommandRejectionReason
      /** Developer diagnostic only; never rendered verbatim to a learner. */
      readonly detail?: string
    }

export type ReplayRejectionReason =
  'config-version-mismatch' | 'empty-log' | 'malformed-log'

export type ReplayResult =
  | { readonly ok: true; readonly state: SessionState }
  | {
      readonly ok: false
      readonly reason: ReplayRejectionReason
      readonly detail?: string
    }

export type SimSession = {
  presentNextPair(): CommandResult
  recordObservedSelection(stimulusId: string | null): CommandResult
  startRound(round: Round): CommandResult
  finishSession(): CommandResult
  deliverStimulus(stimulusId: string): CommandResult
  tick(realDtMs: number): CommandResult
  setPaused(paused: boolean): CommandResult
  setSpeed(speed: Speed): CommandResult
  getSnapshot(): SessionState
  getTrainingStatus(): TrainingStatus
  getDebriefSummary(): DebriefSummary
  subscribe(listener: () => void): () => void
}

export type DebriefSummary = {
  readonly assessment: AssessmentSummary
  readonly evidenceByStimulus: readonly ReinforcerEvidenceResult[]
  readonly demonstratedStimulusIds: readonly string[]
  readonly extinction: BurstDetectionResult
  readonly totalResponses: number
  readonly crfMetrics: CrfMetrics
  readonly vrCredited: number
  readonly vrRequired: number
  readonly cumulativeRecord: CumulativeRecordChartData
  readonly responseRates: ResponseRateChartData
}

export type TrainingStatus = {
  readonly baselineComplete: boolean
  readonly outstandingCycle: OutstandingCycle | null
  readonly crfMetrics: CrfMetrics
  readonly acquisitionMet: boolean
  readonly crfCoachingDue: boolean
  readonly vrCoachingDue: boolean
  readonly vrCredited: number
  readonly vrRequired: number
  readonly vrRemaining: number
  readonly vrHistory: ReadonlyArray<{
    readonly responseId: string
    readonly mark: VrTrialMark
  }>
  readonly extinctionComplete: boolean
  readonly extinctionRemainingMs: number
}

export const ok = (events: readonly SimEvent[]): CommandResult => ({
  ok: true,
  events,
})

export const reject = (
  reason: CommandRejectionReason,
  detail?: string,
): CommandResult =>
  detail === undefined ? { ok: false, reason } : { ok: false, reason, detail }
