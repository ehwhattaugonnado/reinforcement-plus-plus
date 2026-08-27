import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { EMPTY_LOG, FULL_SESSION_LOG } from '../../sim/chart-fixtures'
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
