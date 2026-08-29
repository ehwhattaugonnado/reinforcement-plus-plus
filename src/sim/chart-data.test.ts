import { describe, expect, it } from 'vitest'
import {
  buildCumulativeRecordChartData,
  buildResponseRateChartData,
  cumulativeRecordAnnotationsTable,
  cumulativeRecordPointsTable,
  cumulativeRecordSummaryText,
  responseRateByRoundTable,
  responseRateSummaryText,
  responseRateWindowsTable,
} from './chart-data'
import {
  EMPTY_LOG,
  FULL_SESSION_LOG,
  PAUSED_STRETCH_LOG,
  SINGLE_RESPONSE_LOG,
  ZERO_RESPONSE_ROUND_LOG,
} from './chart-fixtures'

describe('buildCumulativeRecordChartData', () => {
  it('always includes a fixed origin point, even for an empty log', () => {
    const data = buildCumulativeRecordChartData(EMPTY_LOG)
    expect(data.points).toEqual([{ atMs: 0, cumulativeResponses: 0 }])
    expect(data.annotations).toEqual([])
    expect(data.extentMs).toBe(0)
  })

  it('steps cumulative responses at each response-emitted event', () => {
    const data = buildCumulativeRecordChartData(SINGLE_RESPONSE_LOG)
    expect(data.points).toEqual([
      { atMs: 0, cumulativeResponses: 0 },
      { atMs: 12000, cumulativeResponses: 1 },
    ])
    expect(data.extentMs).toBe(45500)
  })

  it('extends extentMs to an explicit nowMs for a live, still-idle session', () => {
    const data = buildCumulativeRecordChartData(SINGLE_RESPONSE_LOG, 90000)
    expect(data.extentMs).toBe(90000)
  })

  it('never lets an explicit nowMs shrink extentMs below the latest event', () => {
    const data = buildCumulativeRecordChartData(SINGLE_RESPONSE_LOG, 100)
    expect(data.extentMs).toBe(45500)
  })

  it('never decrements — the record is monotonically nondecreasing', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    for (let i = 1; i < data.points.length; i++) {
      expect(data.points[i]!.cumulativeResponses).toBeGreaterThanOrEqual(
        data.points[i - 1]!.cumulativeResponses,
      )
      expect(data.points[i]!.atMs).toBeGreaterThanOrEqual(
        data.points[i - 1]!.atMs,
      )
    }
    const responseCount = FULL_SESSION_LOG.filter(
      (e) => e.type === 'response-emitted',
    ).length
    expect(data.points[data.points.length - 1]!.cumulativeResponses).toBe(
      responseCount,
    )
  })

  it('annotates only stimulus deliveries and phase changes, at their event time', () => {
    const data = buildCumulativeRecordChartData(ZERO_RESPONSE_ROUND_LOG)
    expect(data.annotations).toEqual([
      { kind: 'phase-change', atMs: 0, phase: 'assessment' },
      { kind: 'phase-change', atMs: 1000, phase: 'baseline' },
      { kind: 'phase-change', atMs: 46000, phase: 'crf' },
      {
        kind: 'delivery',
        atMs: 50200,
        stimulusId: 'treat',
        responseId: 'r1',
        contingency: 'response-contingent',
        timing: 'prompt',
        scheduleFidelity: 'on-schedule',
      },
      { kind: 'phase-change', atMs: 90000, phase: 'debrief' },
    ])
  })

  it('carries raw delivery facts without ever asserting a reinforcer label', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const deliveries = data.annotations.filter((a) => a.kind === 'delivery')
    expect(deliveries.length).toBeGreaterThan(0)
    for (const d of deliveries) {
      expect(Object.keys(d)).not.toContain('isReinforcer')
    }
  })
})

describe('buildResponseRateChartData', () => {
  it('returns no rounds and no windows for an empty log', () => {
    const data = buildResponseRateChartData(EMPTY_LOG)
    expect(data.byRound).toEqual([])
    expect(data.windows).toEqual([])
  })

  it('reports zero rate, not NaN, for a round with zero responses', () => {
    const data = buildResponseRateChartData(ZERO_RESPONSE_ROUND_LOG)
    const baseline = data.byRound.find((r) => r.round === 'baseline')
    expect(baseline).toEqual({
      round: 'baseline',
      startMs: 1000,
      endMs: 46000,
      responseCount: 0,
      observedDurationMs: 45000,
      ratePerMinute: 0,
    })
  })

  it('computes rate correctly for a single response', () => {
    const data = buildResponseRateChartData(SINGLE_RESPONSE_LOG)
    const baseline = data.byRound.find((r) => r.round === 'baseline')
    expect(baseline?.responseCount).toBe(1)
    expect(baseline?.observedDurationMs).toBe(45000)
    expect(baseline?.ratePerMinute).toBeCloseTo((1 / 45000) * 60000)
  })

  it('is unaffected by a zero-duration paused stretch (no second time path)', () => {
    const data = buildResponseRateChartData(PAUSED_STRETCH_LOG)
    const baseline = data.byRound.find((r) => r.round === 'baseline')
    // Round spans 1000..46000 = 45000ms regardless of the paused/resumed
    // pair at 8000/8000, which contributes zero simulated-time width.
    expect(baseline?.observedDurationMs).toBe(45000)
    expect(baseline?.responseCount).toBe(2)
    expect(baseline?.ratePerMinute).toBeCloseTo((2 / 45000) * 60000)
  })

  it('windows a round into fixed-size simulated-time bins', () => {
    const data = buildResponseRateChartData(SINGLE_RESPONSE_LOG, 15000)
    const baselineWindows = data.windows.filter((w) => w.round === 'baseline')
    // 500..45500 windowed at 15000ms => [500,15500) [15500,30500) [30500,45500)
    expect(baselineWindows).toHaveLength(3)
    expect(baselineWindows[0]).toEqual({
      round: 'baseline',
      windowStartMs: 500,
      windowEndMs: 15500,
      responseCount: 1,
      observedDurationMs: 15000,
      ratePerMinute: (1 / 15000) * 60000,
    })
    expect(baselineWindows[1]?.responseCount).toBe(0)
    expect(baselineWindows[2]?.responseCount).toBe(0)
  })

  it('extends an in-progress final round to an explicit nowMs instead of the last event', () => {
    // SINGLE_RESPONSE_LOG's baseline round never gets a closing phase-changed
    // in this trimmed variant — simulate a live session idle since the
    // response at 12000ms by passing the current simulated time explicitly.
    const live = SINGLE_RESPONSE_LOG.slice(0, -1) // drop the debrief transition
    const withoutNow = buildResponseRateChartData(live, 15000)
    const withNow = buildResponseRateChartData(live, 15000, 60000)

    const baselineWithoutNow = withoutNow.byRound.find(
      (r) => r.round === 'baseline',
    )
    const baselineWithNow = withNow.byRound.find((r) => r.round === 'baseline')

    // Without an explicit "now", the round appears to end at the last event
    // (12000ms), understating duration and overstating rate.
    expect(baselineWithoutNow?.endMs).toBe(12000)
    expect(baselineWithoutNow?.ratePerMinute).toBeCloseTo((1 / 11500) * 60000)

    // With an explicit "now", duration correctly reflects the idle stretch.
    expect(baselineWithNow?.endMs).toBe(60000)
    expect(baselineWithNow?.ratePerMinute).toBeCloseTo((1 / 59500) * 60000)
  })

  it('sums per-round response counts to the total responses in the log', () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    const totalFromRounds = data.byRound.reduce(
      (sum, r) => sum + r.responseCount,
      0,
    )
    const totalInLog = FULL_SESSION_LOG.filter(
      (e) => e.type === 'response-emitted',
    ).length
    expect(totalFromRounds).toBe(totalInLog)
  })

  it('sums windowed response counts to the per-round total', () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    for (const round of data.byRound) {
      const windowSum = data.windows
        .filter((w) => w.round === round.round)
        .reduce((sum, w) => sum + w.responseCount, 0)
      expect(windowSum).toBe(round.responseCount)
    }
  })
})

describe('graph/table/text consistency', () => {
  it('derives the cumulative-record table and text from one chart-data object', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const pointsTable = cumulativeRecordPointsTable(data)
    const annotationsTable = cumulativeRecordAnnotationsTable(data)
    const text = cumulativeRecordSummaryText(data)

    // The table is literally the chart-data points/annotations arrays — not
    // a recomputation — so it cannot diverge from what the chart renders.
    expect(pointsTable).toBe(data.points)
    expect(annotationsTable).toHaveLength(data.annotations.length)

    const lastPoint = data.points[data.points.length - 1]!
    expect(text).toContain(`${lastPoint.cumulativeResponses} total response`)
    expect(text).toContain(
      `${data.annotations.filter((a) => a.kind === 'delivery').length} stimulus deliver`,
    )
  })

  it('states the cumulative record extent as human time, not raw milliseconds', () => {
    // This string is the spoken alternative to the graph: a screen reader
    // must not read out "through 46231.474ms". Format matches the chart
    // axis/table's `M:SS` so the two alternatives agree.
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const text = cumulativeRecordSummaryText(data)

    expect(text).not.toMatch(/\d+(\.\d+)?ms/)
    const totalSeconds = Math.round(data.extentMs / 1000)
    const expected = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
    expect(text).toContain(`through ${expected}:`)
  })

  it('derives the response-rate table and text from one chart-data object', () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    const byRoundTable = responseRateByRoundTable(data)
    const windowsTable = responseRateWindowsTable(data)
    const text = responseRateSummaryText(data)

    expect(byRoundTable).toBe(data.byRound)
    expect(windowsTable).toBe(data.windows)

    for (const row of byRoundTable) {
      expect(text).toContain(`${row.round}: ${row.responseCount} response`)
      expect(text).toContain(`${row.ratePerMinute.toFixed(1)} per minute`)
    }
  })

  it('reports "no data yet" text for an empty log without crashing', () => {
    const cumulative = buildCumulativeRecordChartData(EMPTY_LOG)
    const rate = buildResponseRateChartData(EMPTY_LOG)
    expect(cumulativeRecordSummaryText(cumulative)).toMatch(/no responses/i)
    expect(responseRateSummaryText(rate)).toMatch(/no completed rounds/i)
  })

  it('never uses the word "reinforcer" in chart-data text (evidence rule lives elsewhere)', () => {
    const cumulative = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const rate = buildResponseRateChartData(FULL_SESSION_LOG)
    expect(cumulativeRecordSummaryText(cumulative).toLowerCase()).not.toContain(
      'reinforcer',
    )
    expect(responseRateSummaryText(rate).toLowerCase()).not.toContain(
      'reinforcer',
    )
    for (const row of cumulativeRecordAnnotationsTable(cumulative)) {
      expect(row.label.toLowerCase()).not.toContain('reinforcer')
    }
  })
})
