import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../tests/setup/axe'
import { AppShell } from './AppShell'

// The assessment screen adds its own `role="status"` regions (progress,
// record hints, hierarchy summary), so `role: 'status'` alone is ambiguous
// from Milestone 2 on. These tests care specifically about the session-level
// pause/speed announcement, which keeps its own class for that reason.
function sessionStatus(): HTMLElement {
  const el = document.querySelector('.session-status')
  if (el === null) throw new Error('session-status element not found')
  return el as HTMLElement
}

describe('AppShell', () => {
  it('states its educational boundary', () => {
    render(<AppShell seed="shell-test" />)
    expect(screen.getByText(/not clinical guidance/i)).toBeInTheDocument()
  })

  it('offers pause and speed controls, and announces state textually', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="shell-test" />)

    await user.click(screen.getByRole('button', { name: /pause/i }))
    expect(sessionStatus()).toHaveTextContent(/paused/i)

    await user.click(screen.getByRole('radio', { name: /0\.5/ }))
    expect(sessionStatus()).toHaveTextContent(/0\.5/)
  })

  it('switches presentation mode without resetting the simulation', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="shell-test" />)
    const before = sessionStatus().textContent

    await user.click(screen.getByRole('radio', { name: /advanced/i }))

    expect(screen.getByRole('radio', { name: /advanced/i })).toBeChecked()
    expect(screen.getByText(/current phase/i)).toHaveTextContent(/assessment/i)
    expect(before).toBeTruthy()
  })

  it('is operable by keyboard alone', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="shell-test" />)
    await user.tab()
    expect(screen.getByRole('button', { name: /pause/i })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(sessionStatus()).toHaveTextContent(/paused/i)
  })

  it('has no automatically detectable accessibility violations', async () => {
    const { container } = render(<AppShell seed="shell-test" />)
    await expectNoAxeViolations(container)
  })
})
