/**
 * Project-owned chart-data layer (ADR 0007, roadmap Milestone 7).
 *
 * Pure derivations from `readonly SimEvent[]`: no React, no DOM, no
 * `@visx/*` import may appear in this file or anywhere under `src/sim/`
 * (enforced by the `no-restricted-imports` rule in eslint.config.js). The
 * chart-view layer under `src/app/charts/` is the only place visx renders
 * these shapes, and the accessible tables/text summaries below are derived
 * from the exact same objects the chart-view layer draws — never a second,
 * independently recomputed copy (see docs/accessibility.md, ADR 0001).
 *
 * V1 implements exactly two graphs, per docs/architecture/overview.md
 * "Graphing": a cumulative response record and a response-rate-by-round/
 * window series. This module must never grow a Standard Celeration Chart or
 * any partial emulation of one — that is explicitly deferred out of v1
 * scope.
 */

import type {
  DeliveryContingency,
  DeliveryTiming,
  Phase,
  Round,
  ScheduleFidelity,
  SimEvent,
} from './events'
import { eventsOfType } from './events'

const ROUNDS: readonly Round[] = ['baseline', 'crf', 'vr', 'extinction']

function isRound(phase: Phase): phase is Round {
  return (ROUNDS as readonly Phase[]).includes(phase)
}

function maxAtMs(events: readonly SimEvent[]): number {
  return events.reduce((max, e) => Math.max(max, e.at), 0)
}

// ---------------------------------------------------------------------------
// Cumulative response record
// ---------------------------------------------------------------------------

/**
 * One step of the cumulative record: cumulative responses emitted by
 * `atMs` simulated milliseconds. Points exist only where the count changes
 * (plus a fixed origin at `atMs: 0`), so the chart-view layer draws a step
 * line, not an interpolated curve.
 */
export type CumulativeRecordPoint = {
  readonly atMs: number
  readonly cumulativeResponses: number
}

/**
 * An overlaid annotation on the cumulative record. Only stimulus deliveries
 * and phase changes are annotated (docs/architecture/overview.md
 * "Graphing"). This carries the raw, event-derived facts about a delivery —
 * never a "reinforcer" label, since that classification requires the
 * event-derived evidence rule that lives outside this chart-data layer (see
 * docs/aba-glossary.md).
 */
export type CumulativeRecordAnnotation =
  | {
      readonly kind: 'delivery'
      readonly atMs: number
      readonly stimulusId: string
      readonly responseId: string | null
      readonly contingency: DeliveryContingency
      readonly timing: DeliveryTiming
      readonly scheduleFidelity: ScheduleFidelity
    }
  | {
      readonly kind: 'phase-change'
      readonly atMs: number
      readonly phase: Phase
    }

export type CumulativeRecordChartData = {
  readonly points: readonly CumulativeRecordPoint[]
  readonly annotations: readonly CumulativeRecordAnnotation[]
  /** Latest simulated timestamp present in the source log; extends the line. */
  readonly extentMs: number
}

/**
 * Derives the cumulative-record chart data from an event log alone.
 *
 * `nowMs` is the current simulated time to extend the record to, for a
 * session that is still in progress. It defaults to the latest event
 * timestamp in the log, which is exactly right for a closed/replayed log
 * (all fixtures, all tests) but understates the true extent for a *live*
 * session sitting idle mid-round: the caller wiring this into `AppShell`
 * should pass `state.elapsedSimMs` explicitly rather than relying on the
 * default.
 */
export function buildCumulativeRecordChartData(
  events: readonly SimEvent[],
  nowMs?: number,
): CumulativeRecordChartData {
  const points: CumulativeRecordPoint[] = [{ atMs: 0, cumulativeResponses: 0 }]
  let cumulative = 0

  const annotations: CumulativeRecordAnnotation[] = []

  for (const event of events) {
    switch (event.type) {
      case 'response-emitted':
        cumulative += 1
        points.push({ atMs: event.at, cumulativeResponses: cumulative })
        break
      case 'stimulus-delivered':
        annotations.push({
          kind: 'delivery',
          atMs: event.at,
          stimulusId: event.stimulusId,
          responseId: event.responseId,
          contingency: event.contingency,
          timing: event.timing,
          scheduleFidelity: event.scheduleFidelity,
        })
        break
      case 'phase-changed':
        annotations.push({
          kind: 'phase-change',
          atMs: event.at,
          phase: event.phase,
        })
        break
      default:
        break
    }
  }

  const extentMs = Math.max(maxAtMs(events), nowMs ?? 0)
  return { points, annotations, extentMs }
}

// ---------------------------------------------------------------------------
// Response rate by round / window
// ---------------------------------------------------------------------------

/**
 * Response rate aggregated over one entire round. `observedDurationMs` is
 * taken directly from simulated-time event timestamps: `elapsedSimMs` only
 * advances while unpaused, so paused wall-clock time is already excluded and
 * no second pause-subtraction path is needed here (docs/architecture/
 * data-model.md section 5; see `SessionState.elapsedSimMs`).
 */
export type RoundResponseRate = {
  readonly round: Round
  readonly startMs: number
  readonly endMs: number
  readonly responseCount: number
  readonly observedDurationMs: number
  readonly ratePerMinute: number
}

/** Response rate within one fixed-size simulated-time window of a round. */
export type ResponseRateWindow = {
  readonly round: Round
  readonly windowStartMs: number
  readonly windowEndMs: number
  readonly responseCount: number
  readonly observedDurationMs: number
  readonly ratePerMinute: number
}

export type ResponseRateChartData = {
  readonly byRound: readonly RoundResponseRate[]
  readonly windows: readonly ResponseRateWindow[]
  readonly windowSizeMs: number
}

function ratePerMinute(
  responseCount: number,
  observedDurationMs: number,
): number {
  if (observedDurationMs <= 0) return 0
  return (responseCount / observedDurationMs) * 60000
}

/**
 * Derives response-rate-by-round and windowed-trend chart data from an event
 * log alone. `windowSizeMs` defaults to 15,000 simulated ms, a granularity
 * fine enough to show an acquisition trend inside a single CRF/VR round
 * without being noise-dominated by single responses.
 *
 * `nowMs`, like in `buildCumulativeRecordChartData`, is the current
 * simulated time and defaults to the latest event timestamp. For a *live*
 * session, pass `state.elapsedSimMs` explicitly — otherwise the current
 * (still-open) round's `observedDurationMs` is understated by however long
 * it's been idle, which overstates its `ratePerMinute`.
 */
export function buildResponseRateChartData(
  events: readonly SimEvent[],
  windowSizeMs = 15000,
  nowMs?: number,
): ResponseRateChartData {
  const phaseChanges = eventsOfType(events, 'phase-changed')
  const responses = eventsOfType(events, 'response-emitted')
  const extentMs = Math.max(maxAtMs(events), nowMs ?? 0)

  const byRound: RoundResponseRate[] = []
  const windows: ResponseRateWindow[] = []

  for (let i = 0; i < phaseChanges.length; i++) {
    const change = phaseChanges[i]
    if (change === undefined || !isRound(change.phase)) continue

    const startMs = change.at
    const next = phaseChanges[i + 1]
    // A round bounded by a following phase-changed event uses a half-open
    // [start, end) window so a response exactly at the boundary is counted
    // in the round it starts, never double-counted in the one it ends. The
    // last, still-open round has no such boundary event — `endMs` there is
    // just "now" (an observation cutoff, not a state transition) — so its
    // window is closed, [start, end], or a response landing exactly on
    // `nowMs`/the latest logged event would be silently dropped.
    const bounded = next !== undefined
    const endMs = bounded ? next.at : extentMs
    const observedDurationMs = Math.max(0, endMs - startMs)
    const responseCount = responses.filter(
      (r) => r.at >= startMs && (bounded ? r.at < endMs : r.at <= endMs),
    ).length

    byRound.push({
      round: change.phase,
      startMs,
      endMs,
      responseCount,
      observedDurationMs,
      ratePerMinute: ratePerMinute(responseCount, observedDurationMs),
    })

    for (let w = startMs; w < endMs; w += windowSizeMs) {
      const windowEndMs = Math.min(w + windowSizeMs, endMs)
      const isLastWindow = windowEndMs === endMs
      const windowDurationMs = windowEndMs - w
      const windowResponseCount = responses.filter(
        (r) =>
          r.at >= w &&
          (bounded || !isLastWindow ? r.at < windowEndMs : r.at <= windowEndMs),
      ).length

      windows.push({
        round: change.phase,
        windowStartMs: w,
        windowEndMs,
        responseCount: windowResponseCount,
        observedDurationMs: windowDurationMs,
        ratePerMinute: ratePerMinute(windowResponseCount, windowDurationMs),
      })
    }
  }

  return { byRound, windows, windowSizeMs }
}

// ---------------------------------------------------------------------------
// Accessible tables and text summaries — derived from the chart-data shapes
// above, never recomputed from the raw event log. This is what makes
// graph/table/text disagreement structurally impossible: every function
// below takes only the chart-data object as input.
// ---------------------------------------------------------------------------

export type CumulativeRecordPointRow = CumulativeRecordPoint

export type CumulativeRecordAnnotationRow = {
  readonly atMs: number
  readonly label: string
}

/** The step-line data as an accessible table (docs/accessibility.md). */
export function cumulativeRecordPointsTable(
  data: CumulativeRecordChartData,
): readonly CumulativeRecordPointRow[] {
  return data.points
}

function annotationLabel(annotation: CumulativeRecordAnnotation): string {
  if (annotation.kind === 'phase-change') {
    return `Phase changed to ${annotation.phase}`
  }
  const contingencyLabel =
    annotation.contingency === 'response-contingent'
      ? 'response-contingent'
      : 'noncontingent'
  return `Stimulus delivered (${annotation.stimulusId}, ${contingencyLabel}, ${annotation.timing}, schedule ${annotation.scheduleFidelity})`
}

/** The overlaid annotations as an accessible table. */
export function cumulativeRecordAnnotationsTable(
  data: CumulativeRecordChartData,
): readonly CumulativeRecordAnnotationRow[] {
  return data.annotations.map((a) => ({
    atMs: a.atMs,
    label: annotationLabel(a),
  }))
}

/**
 * A textual alternative to the cumulative-record graph. Deliberately avoids
 * the word "reinforcer" — this chart-data layer never has the event-derived
 * evidence needed to justify that label (docs/aba-glossary.md).
 */
export function cumulativeRecordSummaryText(
  data: CumulativeRecordChartData,
): string {
  if (data.points.length <= 1 && data.annotations.length === 0) {
    return 'No responses or stimulus deliveries have been recorded yet.'
  }

  const lastPoint = data.points[data.points.length - 1]
  const totalResponses =
    lastPoint === undefined ? 0 : lastPoint.cumulativeResponses
  const deliveries = data.annotations.filter((a) => a.kind === 'delivery')
  const phaseChanges = data.annotations.filter((a) => a.kind === 'phase-change')

  return (
    `Cumulative response record through ${data.extentMs}ms: ${totalResponses} ` +
    `total response${totalResponses === 1 ? '' : 's'} recorded, with ` +
    `${deliveries.length} stimulus deliver${deliveries.length === 1 ? 'y' : 'ies'} ` +
    `and ${phaseChanges.length} phase change${phaseChanges.length === 1 ? '' : 's'} annotated.`
  )
}

export type RoundResponseRateRow = RoundResponseRate

/** Per-round response rate as an accessible table. */
export function responseRateByRoundTable(
  data: ResponseRateChartData,
): readonly RoundResponseRateRow[] {
  return data.byRound
}

export type ResponseRateWindowRow = ResponseRateWindow

/** Windowed response-rate trend as an accessible table. */
export function responseRateWindowsTable(
  data: ResponseRateChartData,
): readonly ResponseRateWindowRow[] {
  return data.windows
}

/** A textual alternative to the response-rate-by-round graph. */
export function responseRateSummaryText(data: ResponseRateChartData): string {
  if (data.byRound.length === 0) {
    return 'No completed rounds have been recorded yet.'
  }

  const parts = data.byRound.map(
    (r) =>
      `${r.round}: ${r.responseCount} response${r.responseCount === 1 ? '' : 's'} ` +
      `at ${r.ratePerMinute.toFixed(1)} per minute`,
  )
  return `Response rate by round — ${parts.join('; ')}.`
}
