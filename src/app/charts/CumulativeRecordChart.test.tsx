import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { buildCumulativeRecordChartData } from '../../sim'
import { EMPTY_LOG, FULL_SESSION_LOG } from '../../sim/chart-fixtures'
import { CumulativeRecordChart } from './CumulativeRecordChart'

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
})
