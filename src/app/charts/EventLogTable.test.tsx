import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { EMPTY_LOG, FULL_SESSION_LOG } from '../../sim/chart-fixtures'
import type { SimEvent } from '../../sim'
import { EventLogTable } from './EventLogTable'

describe('EventLogTable', () => {
  it('renders an accessible table with a caption and one row per event', () => {
    render(<EventLogTable events={FULL_SESSION_LOG} />)

    const table = screen.getByRole('table', { name: /raw session events/i })
    expect(table.querySelector('caption')).toBeInTheDocument()
    const headers = table.querySelectorAll('thead th')
    expect(headers.length).toBeGreaterThan(0)

    const rows = table.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(FULL_SESSION_LOG.length)
  })

  it('renders each event type and its raw fields, in log order', () => {
    render(<EventLogTable events={FULL_SESSION_LOG} />)
    const table = screen.getByRole('table', { name: /raw session events/i })
    const rows = table.querySelectorAll('tbody tr')

    FULL_SESSION_LOG.forEach((event, i) => {
      const row = rows[i]!
      expect(row).toHaveTextContent(event.type)
    })
  })

  it('renders without crashing and states there are no events for an empty log', () => {
    render(<EventLogTable events={EMPTY_LOG} />)
    const table = screen.getByRole('table', { name: /raw session events/i })
    expect(table.querySelectorAll('tbody tr')).toHaveLength(0)
    expect(screen.getByText(/no events recorded yet/i)).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<EventLogTable events={FULL_SESSION_LOG} />)
    await expectNoAxeViolations(container)
  })

  it('has no automatically detectable accessibility violations for an empty log', async () => {
    const { container } = render(<EventLogTable events={EMPTY_LOG} />)
    await expectNoAxeViolations(container)
  })
})

describe('live window', () => {
  const many: SimEvent[] = Array.from({ length: 24 }, (_, i) => ({
    type: 'response-emitted',
    at: i * 1000,
    responseId: `response-${i + 1}`,
  }))

  it('shows only the most recent events, newest first, when limited', () => {
    render(<EventLogTable events={many} limit={10} />)
    const rowHeaders = screen
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
    expect(rowHeaders).toHaveLength(10)
    // Newest first, numbered by position in the real log.
    expect(rowHeaders[0]).toBe('24')
    expect(rowHeaders.at(-1)).toBe('15')
  })

  it('says the table is a window, so no row is silently missing', () => {
    render(<EventLogTable events={many} limit={10} />)
    expect(
      screen.getByText(/the 10 most recent of 24, newest first/),
    ).toBeInTheDocument()
  })

  it('renders the complete log in recorded order when unlimited', () => {
    render(<EventLogTable events={many} />)
    const rowHeaders = screen
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent)
    expect(rowHeaders).toHaveLength(24)
    expect(rowHeaders[0]).toBe('1')
  })

  it('does not window a log shorter than the limit', () => {
    render(<EventLogTable events={many.slice(0, 3)} limit={10} />)
    expect(screen.getAllByRole('rowheader')).toHaveLength(3)
    expect(
      screen.getByText(/in the order they were recorded/),
    ).toBeInTheDocument()
  })

  it('rounds millisecond floats rather than printing a debug dump', () => {
    const withLatency: SimEvent[] = [
      {
        type: 'stimulus-delivered',
        at: 1000,
        stimulusId: 'play',
        contingency: 'response-contingent',
        timing: 'prompt',
        scheduleFidelity: 'on-schedule',
        schedule: 'CRF',
        responseId: 'r1',
        latencyMs: 36.39059920317231,
      },
    ]
    render(<EventLogTable events={withLatency} />)
    expect(screen.getByText(/latencyMs: 36\b/)).toBeInTheDocument()
    expect(screen.queryByText(/36\.39/)).not.toBeInTheDocument()
  })
})
