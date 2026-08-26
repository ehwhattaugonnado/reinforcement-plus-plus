import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { createSession, DEFAULT_SIM_CONFIG, type SimSession } from '../../sim'
import { TrainingScreen } from './TrainingScreen'

function completeAssessment(session: SimSession) {
  for (let i = 0; i < 6; i++) {
    session.presentNextPair()
    const trials = session.getSnapshot().assessment.trials
    const current = trials[trials.length - 1]
    session.recordObservedSelection(current?.creatureSelection ?? null)
  }
}

function baselineSession(seed: string): SimSession {
  const s = createSession({ seed })
  completeAssessment(s)
  s.startRound('baseline')
  return s
}

describe('TrainingScreen', () => {
  it('announces creature state and response count as text, not color alone', () => {
    const session = baselineSession('training-screen-1')
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)

    expect(screen.getByText(/responded 0 times/i)).toBeInTheDocument()
    expect(screen.getByText(/mood: neutral/i)).toBeInTheDocument()
    expect(
      screen.getByText(/baseline in progress/i, { exact: false }),
    ).toBeInTheDocument()
  })

  it('shows a stimulus-value table as the accessible alternative to any graphic', () => {
    const session = baselineSession('training-screen-2')
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)
    expect(
      screen.getByRole('columnheader', { name: /stimulus/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('offers to advance only once baseline has run its full simulated duration', () => {
    const session = baselineSession('training-screen-3')
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)
    expect(
      screen.queryByRole('button', { name: /start crf/i }),
    ).not.toBeInTheDocument()

    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++)
      session.tick(50)
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)
    expect(
      screen.getByRole('button', { name: /start crf/i }),
    ).toBeInTheDocument()
  })

  it('advancing to CRF calls startRound and changes phase', async () => {
    const user = userEvent.setup()
    const session = baselineSession('training-screen-4')
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++)
      session.tick(50)
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)

    await user.click(screen.getByRole('button', { name: /start crf/i }))
    expect(session.getSnapshot().phase).toBe('crf')
  })

  it('has no automatically detectable accessibility violations', async () => {
    const session = baselineSession('training-screen-5')
    const { container } = render(
      <TrainingScreen state={session.getSnapshot()} session={session} />,
    )
    await expectNoAxeViolations(container)
  })
})
