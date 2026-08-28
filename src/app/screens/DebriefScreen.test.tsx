import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createSession } from '../../sim'
import { DebriefScreen } from './DebriefScreen'

function debriefFixture() {
  const session = createSession({ seed: 'debrief-screen' })
  const state = session.getSnapshot()
  return {
    session,
    state: {
      ...state,
      phase: 'debrief',
      events: [
        ...state.events,
        { type: 'phase-changed', at: 0, phase: 'debrief' },
      ],
    } as typeof state,
  }
}

describe('DebriefScreen', () => {
  it('keeps the evidence-based conclusion identical across presentation modes', () => {
    const { state, session } = debriefFixture()
    const { rerender } = render(
      <DebriefScreen state={state} session={session} mode="simple" />,
    )
    const conclusion = screen.getByText(
      /no item met the event-derived/i,
    ).textContent

    rerender(<DebriefScreen state={state} session={session} mode="advanced" />)
    expect(screen.getByText(conclusion)).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: /advanced evidence details/i }),
    ).toBeInTheDocument()
  })

  it('states the educational boundary and does not invent an extinction result when skipped', () => {
    const { state, session } = debriefFixture()
    render(<DebriefScreen state={state} session={session} mode="simple" />)
    expect(screen.getByText(/skipped the optional/i)).toBeInTheDocument()
    expect(screen.getByText(/not clinical guidance/i)).toBeInTheDocument()
  })
})
