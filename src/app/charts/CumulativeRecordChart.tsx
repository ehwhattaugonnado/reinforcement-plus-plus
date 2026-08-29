import { AxisBottom, AxisLeft } from '@visx/axis'
import { Group } from '@visx/group'
import { scaleLinear } from '@visx/scale'
import { LinePath } from '@visx/shape'
import {
  cumulativeRecordAnnotationsTable,
  cumulativeRecordPointsTable,
  cumulativeRecordSummaryText,
  type CumulativeRecordChartData,
} from '../../sim'
import {
  AXIS_BOTTOM_LABEL_OFFSET,
  AXIS_LEFT_LABEL_OFFSET,
  CHART_MARGIN,
  CHART_VIEWBOX_WIDTH,
  formatSimTime,
  wholeStepTicks,
} from './format'

/**
 * Live rounds grow `extentMs` every frame. Rounding the drawn x-domain up to
 * the next whole step keeps the axis stationary between steps.
 */
const X_DOMAIN_STEP_MS = 10_000

/**
 * Preferred x tick spacings, in `X_DOMAIN_STEP_MS` units: 10s, 20s, 30s, 1m,
 * 2m, 5m, 10m, 20m. Keeps a long session's labels on round times instead of
 * an exact-but-arbitrary division like 5:10.
 */
const X_TICK_STEP_LADDER = [1, 2, 3, 6, 12, 30, 60, 120]

function quantizeExtentMs(extentMs: number): number {
  const steps = Math.max(1, Math.ceil(extentMs / X_DOMAIN_STEP_MS))
  return steps * X_DOMAIN_STEP_MS
}

/**
 * Renders the cumulative response record: simulated time on x, cumulative
 * responses on y, with stimulus-delivery and phase-change annotations
 * overlaid (docs/architecture/overview.md "Graphing"). This is the only
 * place in `src/app/charts/` that touches `@visx/*` for this chart — the
 * eslint rule in eslint.config.js keeps it that way (ADR 0007).
 *
 * The svg is a redundant, decorative rendering of `data`: the visible text
 * summary and data table below are derived from the exact same `data` object
 * (docs/accessibility.md), so they cannot disagree with what is drawn here.
 */
export function CumulativeRecordChart({
  data,
  title = 'Cumulative response record',
  width = CHART_VIEWBOX_WIDTH,
  height = 260,
}: {
  data: CumulativeRecordChartData
  title?: string
  width?: number
  height?: number
}) {
  const margin = { ...CHART_MARGIN, top: 16 }
  const innerWidth = Math.max(0, width - margin.left - margin.right)
  const innerHeight = Math.max(0, height - margin.top - margin.bottom)

  // The x-domain is quantised to whole `X_DOMAIN_STEP_MS` buckets so a live
  // round advances the axis in discrete jumps instead of rescaling on every
  // animation frame (which made every tick drift leftwards continuously).
  const maxAtMs = quantizeExtentMs(data.extentMs)
  const maxCumulative = Math.max(
    ...data.points.map((p) => p.cumulativeResponses),
    1,
  )

  const xScale = scaleLinear<number>({
    domain: [0, maxAtMs],
    range: [0, innerWidth],
  })
  const yScale = scaleLinear<number>({
    domain: [0, maxCumulative],
    range: [innerHeight, 0],
  })
  const xTickValues = wholeStepTicks(
    maxAtMs,
    X_DOMAIN_STEP_MS,
    X_TICK_STEP_LADDER,
  )
  // A cumulative count of discrete events: ticks must be whole responses,
  // never d3's default 0.2/0.4/0.6/0.8 on a one-response domain.
  const yTickValues = wholeStepTicks(maxCumulative, 1)

  const stepPoints = toStepPath(data)
  const deliveries = data.annotations.filter((a) => a.kind === 'delivery')
  const phaseChanges = data.annotations.filter((a) => a.kind === 'phase-change')
  const text = cumulativeRecordSummaryText(data)
  const pointsRows = cumulativeRecordPointsTable(data)
  const annotationRows = cumulativeRecordAnnotationsTable(data)

  return (
    <figure className="chart cumulative-record-chart">
      <figcaption>{title}</figcaption>

      {/* Decorative: the text summary and table below carry the same facts. */}
      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <Group left={margin.left} top={margin.top}>
          <AxisLeft
            scale={yScale}
            label="Cumulative responses"
            labelOffset={AXIS_LEFT_LABEL_OFFSET}
            tickValues={yTickValues}
            tickFormat={(v) => String(Math.round(Number(v)))}
          />
          <AxisBottom
            top={innerHeight}
            scale={xScale}
            label="Simulated time"
            labelOffset={AXIS_BOTTOM_LABEL_OFFSET}
            tickFormat={(v) => formatSimTime(Number(v))}
            tickValues={xTickValues}
          />
          <LinePath
            data={stepPoints}
            x={(p) => xScale(p.atMs)}
            y={(p) => yScale(p.cumulativeResponses)}
            stroke="currentColor"
            strokeWidth={2}
          />
          {phaseChanges.map((a, i) => (
            <line
              key={`phase-${i}`}
              x1={xScale(a.atMs)}
              x2={xScale(a.atMs)}
              y1={0}
              y2={innerHeight}
              stroke="currentColor"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
            />
          ))}
          {deliveries.map((a, i) => (
            <circle
              key={`delivery-${i}`}
              cx={xScale(a.atMs)}
              cy={yScale(cumulativeAt(data, a.atMs))}
              r={4}
              fill={
                a.contingency === 'response-contingent'
                  ? 'currentColor'
                  : 'none'
              }
              stroke="currentColor"
              strokeWidth={1.5}
            />
          ))}
        </Group>
      </svg>

      <p className="chart-text-summary">{text}</p>

      <details>
        <summary>Data table: cumulative responses</summary>
        <table>
          <caption>Cumulative responses over simulated time</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Cumulative responses</th>
            </tr>
          </thead>
          <tbody>
            {pointsRows.map((row, i) => (
              <tr key={i}>
                <td>{formatSimTime(row.atMs)}</td>
                <td>{row.cumulativeResponses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details>
        <summary>
          Data table: annotations (stimulus deliveries and phase changes)
        </summary>
        <table>
          <caption>Stimulus deliveries and phase changes, in order</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Event</th>
            </tr>
          </thead>
          <tbody>
            {annotationRows.map((row, i) => (
              <tr key={i}>
                <td>{formatSimTime(row.atMs)}</td>
                <td>{row.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Expands step points into a staircase path, extended flat to `extentMs`. */
function toStepPath(
  data: CumulativeRecordChartData,
): { atMs: number; cumulativeResponses: number }[] {
  const out: { atMs: number; cumulativeResponses: number }[] = []
  const points = data.points
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    if (i > 0) {
      out.push({
        atMs: p.atMs,
        cumulativeResponses: points[i - 1]!.cumulativeResponses,
      })
    }
    out.push(p)
  }
  const last = points[points.length - 1]
  if (last !== undefined && last.atMs < data.extentMs) {
    out.push({
      atMs: data.extentMs,
      cumulativeResponses: last.cumulativeResponses,
    })
  }
  return out
}

/** Cumulative responses at a given time, for placing an annotation marker. */
function cumulativeAt(data: CumulativeRecordChartData, atMs: number): number {
  let value = 0
  for (const p of data.points) {
    if (p.atMs > atMs) break
    value = p.cumulativeResponses
  }
  return value
}
