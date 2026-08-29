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

  it('reaches the same conclusions in both modes, and never ends by pointing at the other one', () => {
    const { state, session } = debriefFixture()

    // The whole conclusion surface, not just the reinforcer line: ADR 0004
    // and the quality bar treat a Simple/Advanced conclusion mismatch as a
    // defect, so this compares every conclusion paragraph.
    const conclusions = () =>
      [
        '.debrief-conclusion',
        '.debrief-burst-conclusion',
        '.debrief-closing',
      ].map((selector) => document.querySelector(selector)?.textContent ?? null)

    const { rerender, unmount } = render(
      <DebriefScreen state={state} session={session} mode="simple" />,
    )
    const simple = conclusions()
    expect(simple.every((text) => text !== null && text.length > 0)).toBe(true)

    // Simple mode used to close with "Switch to Advanced detail ...", ending
    // the session on an instruction to change a setting.
    expect(screen.queryByText(/switch to advanced/i)).not.toBeInTheDocument()

    rerender(<DebriefScreen state={state} session={session} mode="advanced" />)
    expect(conclusions()).toEqual(simple)
    unmount()
  })

  it("closes on a line derived from the log, in the learner's units", () => {
    const { state, session } = debriefFixture()
    render(<DebriefScreen state={state} session={session} mode="simple" />)

    const closing =
      document.querySelector('.debrief-closing')?.textContent ?? ''
    expect(closing).toMatch(/nothing is saved/i)
    // No raw milliseconds, event ids, or unrounded floats (AGENTS.md).
    expect(closing).not.toMatch(/\bms\b|response-\d|\d\.\d{3}/)
  })

  it('states the educational boundary and does not invent an extinction result when skipped', () => {
    const { state, session } = debriefFixture()
    render(<DebriefScreen state={state} session={session} mode="simple" />)
    expect(screen.getByText(/skipped the optional/i)).toBeInTheDocument()
    expect(screen.getByText(/not clinical guidance/i)).toBeInTheDocument()
  })
})
