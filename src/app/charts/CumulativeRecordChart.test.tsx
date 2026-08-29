import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { buildCumulativeRecordChartData } from '../../sim'
import {
  EMPTY_LOG,
  FULL_SESSION_LOG,
  SINGLE_RESPONSE_LOG,
} from '../../sim/chart-fixtures'
import { CumulativeRecordChart } from './CumulativeRecordChart'
import { CHART_MARGIN, CHART_VIEWBOX_WIDTH } from './format'

/** Rendered tick labels of one axis, in document order. */
function tickLabels(container: HTMLElement, axis: 'left' | 'bottom'): string[] {
  return Array.from(
    container.querySelectorAll(`.visx-axis-${axis} .visx-axis-tick text`),
  ).map((t) => t.textContent ?? '')
}

/** X positions of the bottom axis ticks, in document order. */
function bottomTickPositions(container: HTMLElement): string[] {
  return Array.from(
    container.querySelectorAll('.visx-axis-bottom .visx-axis-tick line'),
  ).map((l) => l.getAttribute('x1') ?? '')
}

describe('CumulativeRecordChart', () => {
  it('renders a text summary and a data table alternative derived from the same chart-data', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    render(<CumulativeRecordChart data={data} />)

    const totalResponses =
      data.points[data.points.length - 1]!.cumulativeResponses
    expect(
      screen.getByText(new RegExp(`${totalResponses} total responses?`, 'i')),
    ).toBeInTheDocument()

    const table = screen.getByRole('table', { name: /cumulative responses/i })
    const rows = table.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(data.points.length)

    // Row-count parity isn't enough on its own — pin down that a specific
    // cell renders the exact chart-data value it came from, closing the
    // graph -> table -> text chain end-to-end rather than stopping at the
    // sim-layer identity check.
    const lastPoint = data.points[data.points.length - 1]!
    const lastRow = rows[rows.length - 1]!
    const cells = lastRow.querySelectorAll('td')
    expect(cells[1]).toHaveTextContent(String(lastPoint.cumulativeResponses))
  })

  it('lists every annotation in the accessible annotations table', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    render(<CumulativeRecordChart data={data} />)

    const table = screen.getByRole('table', {
      name: /stimulus deliveries and phase changes/i,
    })
    const rows = table.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(data.annotations.length)
  })

  it('renders without crashing for an empty log', () => {
    const data = buildCumulativeRecordChartData(EMPTY_LOG)
    render(<CumulativeRecordChart data={data} />)
    expect(screen.getByText(/no responses/i)).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations', async () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)
    await expectNoAxeViolations(container)
  })

  it('has no accessibility violations with the table alternatives expanded', async () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)
    // The tables live inside <details>; open them so axe actually inspects
    // the table markup rather than just the figcaption/text-summary siblings.
    for (const details of container.querySelectorAll('details')) {
      details.setAttribute('open', '')
    }
    await expectNoAxeViolations(container)
  })

  it('marks the decorative svg as hidden so screen readers use the text/table instead', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('data tables are reachable and expandable by keyboard via native <details>', () => {
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)
    const details = container.querySelectorAll('details')
    expect(details.length).toBeGreaterThan(0)
    for (const d of details) {
      expect(d.querySelector('summary')).toBeInTheDocument()
    }
  })

  it('labels the cumulative-count axis in whole responses only', () => {
    // A cumulative count of discrete events has no fractional values: with a
    // single response logged, d3's default ticks would read 0.2/0.4/0.6/0.8.
    const data = buildCumulativeRecordChartData(SINGLE_RESPONSE_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)

    const labels = tickLabels(container, 'left')
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(label).toMatch(/^\d+$/)
    }
    // No duplicate labels once the small domain is snapped to whole steps.
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('holds the time axis still while a live round grows the extent', () => {
    // The x-domain is quantised, so an extent that grows within one bucket
    // must not move a single tick — previously every frame rescaled the axis
    // and every label drifted leftwards continuously.
    const a = buildCumulativeRecordChartData(SINGLE_RESPONSE_LOG, 41_000)
    const b = buildCumulativeRecordChartData(SINGLE_RESPONSE_LOG, 48_500)
    expect(b.extentMs).not.toBe(a.extentMs)

    const first = render(<CumulativeRecordChart data={a} />)
    const positionsA = bottomTickPositions(first.container)
    const labelsA = tickLabels(first.container, 'bottom')
    const second = render(<CumulativeRecordChart data={b} />)

    expect(bottomTickPositions(second.container)).toEqual(positionsA)
    expect(tickLabels(second.container, 'bottom')).toEqual(labelsA)
    // And the labels themselves are whole seconds, not 0:03/0:08 rounding
    // artefacts of d3's default tick placement.
    for (const label of labelsA) {
      expect(label).toMatch(/^\d+:[0-5]\d$/)
    }
  })

  it('keeps both axis labels inside the clipping viewBox', () => {
    // The svg has a viewBox and therefore clips: an axis label placed past
    // the margin is not merely cramped, it disappears entirely.
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)
    const svg = container.querySelector('svg')!
    const [, , , viewBoxHeight] = svg
      .getAttribute('viewBox')!
      .split(' ')
      .map(Number)

    const left = container.querySelector('.visx-axis-left .visx-axis-label')!
    // Rotated -90, so its `y` is the distance left of the plot area.
    expect(Number(left.getAttribute('y'))).toBeGreaterThan(-CHART_MARGIN.left)

    const bottomAxis = container.querySelector('.visx-axis-bottom')!
    const axisTop = Number(
      /translate\(0, ([\d.]+)\)/.exec(
        bottomAxis.getAttribute('transform') ?? '',
      )?.[1],
    )
    const bottomLabelY = Number(
      bottomAxis.querySelector('.visx-axis-label')!.getAttribute('y'),
    )
    expect(CHART_MARGIN.top + axisTop + bottomLabelY).toBeLessThan(
      viewBoxHeight!,
    )
  })

  it('uses the shared viewBox width so it scales with the other chart', () => {
    // Both charts render at width="100%"; an equal viewBox width is what
    // makes them scale by the same factor, so their plot areas align and
    // their tick text ends up the same on-screen size.
    const data = buildCumulativeRecordChartData(FULL_SESSION_LOG)
    const { container } = render(<CumulativeRecordChart data={data} />)
    const viewBox = container.querySelector('svg')!.getAttribute('viewBox')!
    expect(viewBox.split(' ')[2]).toBe(String(CHART_VIEWBOX_WIDTH))
  })
})
