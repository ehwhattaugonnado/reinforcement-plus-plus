/**
 * The append-only event log is the sole source of truth for graphs, tables,
 * metrics, debrief text, and deterministic replay (ADR 0001). Nothing derives
 * a displayed fact from a parallel mutable summary.
 *
 * See docs/architecture/data-model.md section 3.
 */

export type Phase =
  'assessment' | 'baseline' | 'crf' | 'vr' | 'extinction' | 'debrief'

/** Rounds a learner can start. `assessment` and `debrief` are not rounds. */
export type Round = 'baseline' | 'crf' | 'vr' | 'extinction'

export type Speed = 0.5 | 1

export type DeliveryContingency = 'response-contingent' | 'noncontingent'
export type DeliveryTiming = 'prompt' | 'delayed' | 'no-response'
export type ScheduleFidelity =
  'on-schedule' | 'premature' | 'overrun' | 'not-variable' | 'not-applicable'

export type SimEvent =
  | {
      type: 'session-started'
      at: 0
      seed: string
      speed: Speed
      configVersion: string
    }
  | { type: 'paused'; at: number }
  | { type: 'resumed'; at: number }
  | { type: 'speed-changed'; at: number; speed: Speed }
  | { type: 'pair-presented'; at: number; leftId: string; rightId: string }
  | { type: 'creature-selected'; at: number; stimulusId: string | null }
  | { type: 'selection-recorded'; at: number; stimulusId: string | null }
  | { type: 'response-emitted'; at: number; responseId: string }
  | {
      type: 'criterion-met'
      at: number
      responseId: string
      schedule: 'CRF' | 'VR'
    }
  | {
      type: 'stimulus-delivered'
      at: number
      stimulusId: string
      responseId: string | null
      latencyMs: number | null
      contingency: DeliveryContingency
      timing: DeliveryTiming
      scheduleFidelity: ScheduleFidelity
      /**
       * Which schedule governed this delivery's classification, stamped
       * directly from the active phase at commit time; `null` for a
       * noncontingent delivery or one outside a scheduled round (ADR 0010).
       */
      schedule: 'CRF' | 'VR' | null
    }
  | { type: 'criterion-missed'; at: number; responseId: string }
  | {
      type: 'cycle-abandoned'
      at: number
      reason: 'due-window-elapsed' | 'round-ended'
    }
  | { type: 'phase-changed'; at: number; phase: Phase }

export type SimEventOfType<T extends SimEvent['type']> = Extract<
  SimEvent,
  { type: T }
>

export function eventsOfType<T extends SimEvent['type']>(
  events: readonly SimEvent[],
  type: T,
): SimEventOfType<T>[] {
  return events.filter((e): e is SimEventOfType<T> => e.type === type)
}
