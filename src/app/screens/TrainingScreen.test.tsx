import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import {
  buildCumulativeRecordChartData,
  buildResponseRateChartData,
  createSession,
  DEFAULT_SIM_CONFIG,
  type SessionState,
  type SimSession,
} from '../../sim'
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

function crfSession(seed: string): SimSession {
  const s = createSession({ seed })
  completeAssessment(s)
  s.startRound('baseline')
  for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++)
    s.tick(50)
  s.startRound('crf')
  return s
}

function tickUntilNextResponse(
  session: SimSession,
  stepMs: number,
  guard = 5000,
): void {
  const before = session
    .getSnapshot()
    .events.filter((e) => e.type === 'response-emitted').length
  let steps = 0
  while (
    session.getSnapshot().events.filter((e) => e.type === 'response-emitted')
      .length === before &&
    steps < guard
  ) {
    session.tick(stepMs)
    steps++
  }
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

  describe('Advanced mode live views', () => {
    it('does not render the advanced live view in Simple mode', () => {
      const session = baselineSession('training-screen-simple')
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="simple"
        />,
      )
      expect(
        screen.queryByRole('heading', { name: /advanced live view/i }),
      ).not.toBeInTheDocument()
    })

    it('renders the cumulative-record chart, response-rate chart, and event table in Advanced mode', () => {
      const session = baselineSession('training-screen-advanced-1')
      for (let i = 0; i < 40; i++) session.tick(50)
      const state = session.getSnapshot()
      render(<TrainingScreen state={state} session={session} mode="advanced" />)

      expect(
        screen.getByRole('heading', { name: /advanced live view/i }),
      ).toBeInTheDocument()
      expect(
        screen.getAllByText(/cumulative response record/i).length,
      ).toBeGreaterThan(0)
      expect(
        screen.getAllByText(/response rate by round/i).length,
      ).toBeGreaterThan(0)
      expect(
        screen.getByRole('table', { name: /raw session events/i }),
      ).toBeInTheDocument()
    })

    it('the live chart updates as events accrue', () => {
      const session = baselineSession('training-screen-advanced-2')
      const { rerender } = render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )
      const eventTableBefore = screen.getByRole('table', {
        name: /raw session events/i,
      })
      const rowsBefore = eventTableBefore.querySelectorAll('tbody tr').length

      // Tick until at least one new response has been logged. The response
      // process is a seeded hazard with a mean interarrival on the order of
      // 15-30 simulated seconds at baseline rates, so loop rather than pick
      // a fixed tick count.
      const initialResponses = session
        .getSnapshot()
        .events.filter((e) => e.type === 'response-emitted').length
      let guard = 0
      while (
        session
          .getSnapshot()
          .events.filter((e) => e.type === 'response-emitted').length ===
          initialResponses &&
        guard < 1000
      ) {
        session.tick(200)
        guard++
      }
      rerender(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      const eventTableAfter = screen.getByRole('table', {
        name: /raw session events/i,
      })
      const rowsAfter = eventTableAfter.querySelectorAll('tbody tr').length
      expect(rowsAfter).toBeGreaterThan(rowsBefore)
    })

    it('the event table and the charts are derived from the exact same event log', () => {
      const session = baselineSession('training-screen-advanced-3')
      for (let i = 0; i < 60; i++) session.tick(50)
      const state = session.getSnapshot()
      render(<TrainingScreen state={state} session={session} mode="advanced" />)

      const eventTable = screen.getByRole('table', {
        name: /raw session events/i,
      })
      const eventRows = eventTable.querySelectorAll('tbody tr')
      expect(eventRows).toHaveLength(state.events.length)

      const responseCountInLog = state.events.filter(
        (e) => e.type === 'response-emitted',
      ).length
      const cumulativeData = buildCumulativeRecordChartData(
        state.events,
        state.elapsedSimMs,
      )
      const totalInChart =
        cumulativeData.points[cumulativeData.points.length - 1]!
          .cumulativeResponses
      expect(totalInChart).toBe(responseCountInLog)

      // The response count rendered in the cumulative-record text summary
      // must match the count of response-emitted rows in the event table —
      // both trace back to the same `state.events` array, never a
      // separately recomputed copy.
      expect(
        screen.getByText(new RegExp(`${totalInChart} total responses?`, 'i')),
      ).toBeInTheDocument()
    })

    /**
     * Regression test for the "nowMs wiring for live charts" landmine
     * (docs/roadmap.md checkpoint table): `buildCumulativeRecordChartData`
     * and `buildResponseRateChartData` default their time extent to the
     * latest logged event, which understates an idle open round's duration
     * and overstates its displayed rate unless the caller passes
     * `state.elapsedSimMs` explicitly. This constructs a state where the
     * round has clearly gone idle — plenty of elapsed simulated time past
     * the last logged event — and asserts the rendered rate matches the
     * `elapsedSimMs`-aware calculation, not the bare/default one.
     */
    it('passes elapsedSimMs to the live chart-data builders so an idle open round does not overstate its rate', () => {
      const session = baselineSession('training-screen-idle')
      // Advance just enough, in small steps, to get one response logged and
      // then stop — leaving the round genuinely idle relative to a much
      // later `elapsedSimMs`.
      let guard = 0
      while (
        session
          .getSnapshot()
          .events.filter((e) => e.type === 'response-emitted').length === 0 &&
        guard < 1000
      ) {
        session.tick(200)
        guard++
      }
      const busyState = session.getSnapshot()
      expect(busyState.events.some((e) => e.type === 'response-emitted')).toBe(
        true,
      )

      // Simulate the round then sitting idle for two full minutes with no
      // further events, by advancing only `elapsedSimMs` on a captured
      // snapshot — isolating the wiring bug from the RNG-driven response
      // process itself.
      const idleState: SessionState = {
        ...busyState,
        elapsedSimMs: busyState.elapsedSimMs + 120_000,
      }

      render(
        <TrainingScreen state={idleState} session={session} mode="advanced" />,
      )

      const correct = buildResponseRateChartData(
        idleState.events,
        undefined,
        idleState.elapsedSimMs,
      )
      // The buggy computation a caller would get by forgetting to pass
      // `nowMs`: it silently falls back to the latest logged event instead
      // of the true current time.
      const buggy = buildResponseRateChartData(idleState.events)

      const correctRound = correct.byRound.find((r) => r.round === 'baseline')
      const buggyRound = buggy.byRound.find((r) => r.round === 'baseline')
      expect(correctRound).toBeDefined()
      expect(buggyRound).toBeDefined()
      // Sanity check that this scenario actually exercises the bug: the two
      // computations must disagree, or the test below would pass vacuously.
      expect(correctRound!.ratePerMinute).not.toBeCloseTo(
        buggyRound!.ratePerMinute,
        1,
      )

      const table = screen.getByRole('table', {
        name: /response rate by round/i,
      })
      const row = table.querySelector('tbody tr')!
      const cells = row.querySelectorAll('td')
      expect(cells[3]).toHaveTextContent(correctRound!.ratePerMinute.toFixed(1))
      expect(cells[3]).not.toHaveTextContent(
        buggyRound!.ratePerMinute.toFixed(1),
      )
    })

    it('has no automatically detectable accessibility violations in Advanced mode', async () => {
      const session = baselineSession('training-screen-advanced-a11y')
      for (let i = 0; i < 40; i++) session.tick(50)
      const { container } = render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )
      await expectNoAxeViolations(container)
    })
  })

  describe('CRF acquisition (Milestone 4)', () => {
    it('shows the stimulus picker and a large delivery target', () => {
      const session = crfSession('training-crf-1')
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)

      expect(
        screen.getByRole('group', { name: /what to deliver/i }),
      ).toBeInTheDocument()
      const deliverButton = screen.getByRole('button', { name: /deliver/i })
      expect(deliverButton).toBeInTheDocument()
      expect(deliverButton).toHaveClass('delivery-target')
      expect(
        screen.getByText(
          (_, element) =>
            element?.className === 'crf-shortcut-hint' &&
            /press d to deliver/i.test(element.textContent ?? ''),
        ),
      ).toBeInTheDocument()
    })

    it('clicking the delivery target calls deliverStimulus and the status announces the outcome', async () => {
      const user = userEvent.setup()
      const session = crfSession('training-crf-2')
      tickUntilNextResponse(session, 50)
      const { rerender } = render(
        <TrainingScreen state={session.getSnapshot()} session={session} />,
      )

      await user.click(screen.getByRole('button', { name: /deliver/i }))
      rerender(
        <TrainingScreen state={session.getSnapshot()} session={session} />,
      )

      const last = session.getSnapshot().events.at(-1)
      expect(last?.type).toBe('stimulus-delivered')
      expect(
        screen.getByText(/delivered promptly, on schedule/i),
      ).toBeInTheDocument()
    })

    it('the documented "D" keyboard shortcut delivers without needing focus on the button', () => {
      const session = crfSession('training-crf-3')
      tickUntilNextResponse(session, 50)
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)

      const before = session.getSnapshot().events.length
      fireEvent.keyDown(window, { key: 'd' })
      expect(session.getSnapshot().events.length).toBe(before + 1)
      expect(session.getSnapshot().events.at(-1)?.type).toBe(
        'stimulus-delivered',
      )
    })

    it('announces that reinforcement is due before any delivery is made', () => {
      const session = crfSession('training-crf-4')
      tickUntilNextResponse(session, 50)
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.getByText(/reinforcement is due/i, { exact: false }),
      ).toBeInTheDocument()
    })

    it('surfaces the corrective-coaching message once the pause elapses without meeting the acquisition gate', () => {
      // The production UI always reads DEFAULT_SIM_CONFIG (AGENTS.md,
      // "the production UI ... does not read, write, or override" config),
      // so this drives the session through the real default
      // `crfCoachingPauseMs` (180s simulated) rather than overriding it.
      const session = crfSession('training-crf-5')
      for (let i = 0; i < DEFAULT_SIM_CONFIG.crfCoachingPauseMs / 50 + 20; i++)
        session.tick(50)
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.getByText(/coaching/i, { exact: false }),
      ).toBeInTheDocument()
    })

    it('offers to advance to VR only once the acquisition gate is met', () => {
      const session = crfSession('training-crf-6')
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.queryByRole('button', { name: /advance to vr/i }),
      ).not.toBeInTheDocument()
    })

    it('has no automatically detectable accessibility violations in the CRF round', async () => {
      const session = crfSession('training-crf-a11y')
      tickUntilNextResponse(session, 50)
      const { container } = render(
        <TrainingScreen state={session.getSnapshot()} session={session} />,
      )
      await expectNoAxeViolations(container)
    })
  })
})
