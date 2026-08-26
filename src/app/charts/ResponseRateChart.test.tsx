import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { buildResponseRateChartData } from '../../sim'
import { EMPTY_LOG, FULL_SESSION_LOG } from '../../sim/chart-fixtures'
import { ResponseRateChart } from './ResponseRateChart'

describe('ResponseRateChart', () => {
  it('renders one table row per round, matching chart-data exactly', () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    render(<ResponseRateChart data={data} />)

    const table = screen.getByRole('table', { name: /response rate by round/i })
    const rows = table.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(data.byRound.length)

    for (const round of data.byRound) {
      expect(
        screen.getByText(
          new RegExp(`${round.round}:.*${round.responseCount} response`, 'i'),
        ),
      ).toBeInTheDocument()
    }

    // Pin a specific rendered cell to its exact chart-data value, so a wrong
    // column mapping or formatting bug would fail even though the row count
    // and loose text-content checks above still pass.
    const firstRound = data.byRound[0]!
    const firstDataRow = table.querySelectorAll('tbody tr')[0]!
    const cells = firstDataRow.querySelectorAll('td')
    expect(cells[0]).toHaveTextContent(firstRound.round)
    expect(cells[1]).toHaveTextContent(String(firstRound.responseCount))
    expect(cells[3]).toHaveTextContent(firstRound.ratePerMinute.toFixed(1))
  })

  it('labels each bar with its numeric rate, not color alone', () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    const { container } = render(<ResponseRateChart data={data} />)
    const labels = container.querySelectorAll('svg text')
    // one axis label + per-bar numeric labels
    expect(labels.length).toBeGreaterThanOrEqual(data.byRound.length)
  })

  it('renders without crashing for an empty log', () => {
    const data = buildResponseRateChartData(EMPTY_LOG)
    render(<ResponseRateChart data={data} />)
    expect(screen.getByText(/no completed rounds/i)).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations', async () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    const { container } = render(<ResponseRateChart data={data} />)
    await expectNoAxeViolations(container)
  })

  it('has no accessibility violations with the table alternative expanded', async () => {
    const data = buildResponseRateChartData(FULL_SESSION_LOG)
    const { container } = render(<ResponseRateChart data={data} />)
    for (const details of container.querySelectorAll('details')) {
      details.setAttribute('open', '')
    }
    await expectNoAxeViolations(container)
  })

  it('has no automatically detectable accessibility violations on an empty log', async () => {
    const data = buildResponseRateChartData(EMPTY_LOG)
    const { container } = render(<ResponseRateChart data={data} />)
    await expectNoAxeViolations(container)
  })
})
