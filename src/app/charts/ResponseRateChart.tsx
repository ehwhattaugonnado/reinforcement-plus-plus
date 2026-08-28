import { AxisBottom, AxisLeft } from '@visx/axis'
import { Group } from '@visx/group'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import {
  responseRateByRoundTable,
  responseRateSummaryText,
  type ResponseRateChartData,
} from '../../sim'

/**
 * Renders response rate by round as a bar chart (docs/architecture/
 * overview.md "Graphing"). The only place besides CumulativeRecordChart that
 * imports `@visx/*` (ADR 0007) — everywhere else consumes chart-data.
 *
 * Each bar carries a visible numeric label so rate differences are never
 * communicated by bar height/color alone (docs/accessibility.md).
 */
export function ResponseRateChart({
  data,
  title = 'Response rate by round',
  width = 420,
  height = 220,
}: {
  data: ResponseRateChartData
  title?: string
  width?: number
  height?: number
}) {
  const margin = { top: 20, right: 16, bottom: 32, left: 48 }
  const innerWidth = Math.max(0, width - margin.left - margin.right)
  const innerHeight = Math.max(0, height - margin.top - margin.bottom)

  const rows = responseRateByRoundTable(data)
  const text = responseRateSummaryText(data)

  const maxRate = Math.max(...rows.map((r) => r.ratePerMinute), 1)

  const xScale = scaleBand<string>({
    domain: rows.map((r) => r.round),
    range: [0, innerWidth],
    padding: 0.3,
  })
  const yScale = scaleLinear<number>({
    domain: [0, maxRate],
    range: [innerHeight, 0],
  })

  return (
    <figure className="chart response-rate-chart">
      <figcaption>{title}</figcaption>

      <svg
        width="100%"
        height="auto"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <Group left={margin.left} top={margin.top}>
          <AxisLeft scale={yScale} label="Responses per minute" numTicks={4} />
          <AxisBottom top={innerHeight} scale={xScale} label="Round" />
          {rows.map((row) => {
            const barWidth = xScale.bandwidth()
            const barHeight = innerHeight - yScale(row.ratePerMinute)
            const barX = xScale(row.round) ?? 0
            const barY = innerHeight - barHeight
            return (
              <Group key={row.round}>
                <Bar
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barHeight}
                  fill="currentColor"
                />
                <text
                  x={barX + barWidth / 2}
                  y={barY - 4}
                  textAnchor="middle"
                  fontSize={11}
                  fill="currentColor"
                >
                  {row.ratePerMinute.toFixed(1)}
                </text>
              </Group>
            )
          })}
        </Group>
      </svg>

      <p className="chart-text-summary">{text}</p>

      <details>
        <summary>Data table: response rate by round</summary>
        <table>
          <caption>Response rate by round</caption>
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">Responses</th>
              <th scope="col">Observed duration</th>
              <th scope="col">Rate (per minute)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.round}>
                <td>{row.round}</td>
                <td>{row.responseCount}</td>
                <td>{Math.round(row.observedDurationMs / 1000)}s</td>
                <td>{row.ratePerMinute.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
