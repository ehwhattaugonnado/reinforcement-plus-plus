/**
 * Deterministic fixture event logs for chart-data and chart-view tests.
 *
 * Scoped, per Milestone 7, to be independent of the live behavior model:
 * everything here is a hand-built `SimEvent[]`, not the output of
 * `createSession`. Times are simulated milliseconds (`at`), matching the
 * shape `applyEvent`/`session.ts` produce, but no session is constructed.
 */

import { CONFIG_VERSION } from './config'
import type { SimEvent } from './events'

export const EMPTY_LOG: readonly SimEvent[] = []

/** One response in an otherwise-uneventful baseline round. */
export const SINGLE_RESPONSE_LOG: readonly SimEvent[] = [
  {
    type: 'session-started',
    at: 0,
    seed: 'fixture-single-response',
    speed: 1,
    configVersion: CONFIG_VERSION,
  },
  { type: 'phase-changed', at: 0, phase: 'assessment' },
  { type: 'phase-changed', at: 500, phase: 'baseline' },
  { type: 'response-emitted', at: 12000, responseId: 'r1' },
  { type: 'phase-changed', at: 45500, phase: 'debrief' },
]

/** A baseline round with zero responses, followed by a CRF round with one. */
export const ZERO_RESPONSE_ROUND_LOG: readonly SimEvent[] = [
  {
    type: 'session-started',
    at: 0,
    seed: 'fixture-zero-response-round',
    speed: 1,
    configVersion: CONFIG_VERSION,
  },
  { type: 'phase-changed', at: 0, phase: 'assessment' },
  { type: 'phase-changed', at: 1000, phase: 'baseline' },
  { type: 'phase-changed', at: 46000, phase: 'crf' },
  { type: 'response-emitted', at: 50000, responseId: 'r1' },
  {
    type: 'stimulus-delivered',
    at: 50200,
    stimulusId: 'treat',
    responseId: 'r1',
    latencyMs: 200,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
    schedule: 'CRF',
  },
  { type: 'phase-changed', at: 90000, phase: 'debrief' },
]

/**
 * A pause/resume pair with no simulated time between them (`elapsedSimMs`
 * only advances while unpaused), bracketing two responses in one baseline
 * round. Response-rate windowing must not be widened or otherwise disturbed
 * by the paused stretch — there is nothing to subtract in simulated time.
 */
export const PAUSED_STRETCH_LOG: readonly SimEvent[] = [
  {
    type: 'session-started',
    at: 0,
    seed: 'fixture-paused-stretch',
    speed: 1,
    configVersion: CONFIG_VERSION,
  },
  { type: 'phase-changed', at: 0, phase: 'assessment' },
  { type: 'phase-changed', at: 1000, phase: 'baseline' },
  { type: 'response-emitted', at: 5000, responseId: 'r1' },
  { type: 'paused', at: 8000 },
  { type: 'resumed', at: 8000 },
  { type: 'response-emitted', at: 20000, responseId: 'r2' },
  { type: 'phase-changed', at: 46000, phase: 'debrief' },
]

/**
 * A fuller session: assessment stub, baseline, CRF with a mix of delivery
 * classifications, VR-3, and an extinction round. Covers annotation variety
 * (prompt/delayed/no-response timing, response-contingent/noncontingent,
 * on-schedule/premature/overrun fidelity) and multiple windows per round for
 * response-rate trend tests.
 */
export const FULL_SESSION_LOG: readonly SimEvent[] = [
  {
    type: 'session-started',
    at: 0,
    seed: 'fixture-full-session',
    speed: 1,
    configVersion: CONFIG_VERSION,
  },
  { type: 'phase-changed', at: 0, phase: 'assessment' },

  { type: 'phase-changed', at: 2000, phase: 'baseline' },
  { type: 'response-emitted', at: 10000, responseId: 'b1' },
  { type: 'response-emitted', at: 20000, responseId: 'b2' },
  { type: 'response-emitted', at: 30000, responseId: 'b3' },

  { type: 'phase-changed', at: 47000, phase: 'crf' },
  { type: 'response-emitted', at: 50000, responseId: 'c1' },
  {
    type: 'stimulus-delivered',
    at: 50300,
    stimulusId: 'treat',
    responseId: 'c1',
    latencyMs: 300,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
    schedule: 'CRF',
  },
  { type: 'response-emitted', at: 62000, responseId: 'c2' },
  {
    type: 'stimulus-delivered',
    at: 65000,
    stimulusId: 'treat',
    responseId: 'c2',
    latencyMs: 3000,
    contingency: 'response-contingent',
    timing: 'delayed',
    scheduleFidelity: 'overrun',
    schedule: 'CRF',
  },
  { type: 'response-emitted', at: 78000, responseId: 'c3' },
  { type: 'response-emitted', at: 79500, responseId: 'c4' },
  {
    type: 'stimulus-delivered',
    at: 79800,
    stimulusId: 'toy',
    responseId: null,
    latencyMs: null,
    contingency: 'noncontingent',
    timing: 'no-response',
    scheduleFidelity: 'not-applicable',
    schedule: 'CRF',
  },

  { type: 'phase-changed', at: 107000, phase: 'vr' },
  { type: 'response-emitted', at: 112000, responseId: 'v1' },
  { type: 'response-emitted', at: 116000, responseId: 'v2' },
  {
    type: 'stimulus-delivered',
    at: 116400,
    stimulusId: 'treat',
    responseId: 'v2',
    latencyMs: 400,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'premature',
    schedule: 'VR',
  },
  { type: 'response-emitted', at: 130000, responseId: 'v3' },
  { type: 'response-emitted', at: 131000, responseId: 'v4' },
  { type: 'response-emitted', at: 132000, responseId: 'v5' },
  {
    type: 'stimulus-delivered',
    at: 132300,
    stimulusId: 'praise',
    responseId: 'v5',
    latencyMs: 300,
    contingency: 'response-contingent',
    timing: 'prompt',
    scheduleFidelity: 'on-schedule',
    schedule: 'VR',
  },

  { type: 'phase-changed', at: 167000, phase: 'extinction' },
  { type: 'response-emitted', at: 170000, responseId: 'e1' },
  { type: 'response-emitted', at: 172000, responseId: 'e2' },
  { type: 'response-emitted', at: 173000, responseId: 'e3' },
  { type: 'response-emitted', at: 190000, responseId: 'e4' },

  { type: 'phase-changed', at: 197000, phase: 'debrief' },
]
