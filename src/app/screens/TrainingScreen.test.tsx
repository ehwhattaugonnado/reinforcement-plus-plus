import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import {
  buildCumulativeRecordChartData,
  buildResponseRateChartData,
  createSession,
  crfAcquisitionMet,
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

/** Reaches VR through the real, default acquisition gate -- the production UI never overrides config (AGENTS.md). */
function vrSession(seed: string): SimSession {
  const s = crfSession(seed)
  let guard = 0
  while (
    !crfAcquisitionMet(
      s.getSnapshot().events,
      s.getSnapshot().elapsedSimMs,
      DEFAULT_SIM_CONFIG,
    ) &&
    guard < 30
  ) {
    tickUntilNextResponse(s, 50)
    const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
    s.deliverStimulus(stimulusId)
    guard++
  }
  s.startRound('vr')
  return s
}

/**
 * Ticks `gap` responses, then delivers in VR. Judged against the running
 * average (ADR 0010), not a hidden per-cycle target -- gap=2/4/3 repeating
 * (RELIABLE_VR_GAP_CYCLE) keeps every delivery's hypothetical average in
 * [2,4] and never repeats a gap enough times running to trip the
 * not-variable check, using only real default config values.
 */
function deliverAfterGap(session: SimSession, gap: number): void {
  for (let i = 0; i < gap; i++) tickUntilNextResponse(session, 50)
  // A coaching pause can land on the final tick of the gap. The core now
  // rejects a delivery made while paused (ADR 0011) — a paused session emits
  // no responses, so such a delivery could only be classified noncontingent
  // and counted against the learner. A real learner resumes before
  // delivering, so this helper does the same rather than losing the cycle.
  if (session.getSnapshot().paused) session.setPaused(false)
  const stimulusId = session.getSnapshot().creature.stimuli[0]!.stimulusId
  session.deliverStimulus(stimulusId)
}

const RELIABLE_VR_GAP_CYCLE = [2, 4, 3]

/** Credits `count` on-schedule VR cycles via RELIABLE_VR_GAP_CYCLE. */
function completeVrCycles(session: SimSession, count: number): void {
  for (let i = 0; i < count; i++) {
    deliverAfterGap(
      session,
      RELIABLE_VR_GAP_CYCLE[i % RELIABLE_VR_GAP_CYCLE.length] as number,
    )
  }
}

function tickUntilNextResponse(
  session: SimSession,
  stepMs: number,
  guard = 5000,
): void {
  if (session.getSnapshot().paused) session.setPaused(false)
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

  it('shows technical stimulus values only in Advanced mode', () => {
    const session = baselineSession('training-screen-2')
    const { rerender } = render(
      <TrainingScreen state={session.getSnapshot()} session={session} />,
    )
    expect(screen.queryByText(/current value/i)).not.toBeInTheDocument()
    rerender(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        mode="advanced"
      />,
    )
    expect(
      screen.getByRole('columnheader', { name: /stimulus/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByRole('row').length).toBeGreaterThan(1)
  })

  it('offers to advance only once baseline has run its full simulated duration', () => {
    const session = baselineSession('training-screen-3')
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)
    expect(
      screen.queryByRole('button', { name: /start training/i }),
    ).not.toBeInTheDocument()

    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++)
      session.tick(50)
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)
    expect(
      screen.getByRole('button', { name: /start training/i }),
    ).toBeInTheDocument()
  })

  it('advancing to CRF calls startRound and changes phase', async () => {
    const user = userEvent.setup()
    const session = baselineSession('training-screen-4')
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++)
      session.tick(50)
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)

    await user.click(screen.getByRole('button', { name: /start training/i }))
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
      // The live table is a capped window (newest first), so "it updated"
      // is the newest row's log position moving, not the row count growing.
      const newestRowNumber = () =>
        Number(
          screen
            .getByRole('table', { name: /raw session events/i })
            .querySelector('tbody tr th')?.textContent ?? '0',
        )
      const newestBefore = newestRowNumber()

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

      expect(newestRowNumber()).toBeGreaterThan(newestBefore)
    })

    it('the event table and the charts are derived from the exact same event log', () => {
      const session = baselineSession('training-screen-advanced-3')
      for (let i = 0; i < 60; i++) session.tick(50)
      const state = session.getSnapshot()
      render(<TrainingScreen state={state} session={session} mode="advanced" />)

      const eventTable = screen.getByRole('table', {
        name: /raw session events/i,
      })
      // The live view shows the most recent window of the log, and says so,
      // so a learner can see that nothing has been silently dropped.
      const eventRows = eventTable.querySelectorAll('tbody tr')
      expect(eventRows.length).toBe(Math.min(state.events.length, 10))
      if (state.events.length > 10) {
        expect(
          eventTable.querySelector('caption')?.textContent ?? '',
        ).toContain(`of ${state.events.length}`)
      }

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
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      await user.click(screen.getByRole('button', { name: /deliver/i }))
      rerender(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
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
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      const before = session.getSnapshot().events.length
      fireEvent.keyDown(window, { key: 'd' })
      expect(session.getSnapshot().events.length).toBe(before + 1)
      expect(session.getSnapshot().events.at(-1)?.type).toBe(
        'stimulus-delivered',
      )
    })

    it('ignores keyboard auto-repeat for the D shortcut', () => {
      const session = crfSession('training-crf-repeat')
      tickUntilNextResponse(session, 50)
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )
      const before = session.getSnapshot().events.length
      fireEvent.keyDown(window, { key: 'd', repeat: true })
      expect(session.getSnapshot().events).toHaveLength(before)
    })

    it('announces that reinforcement is due before any delivery is made', () => {
      const session = crfSession('training-crf-4')
      tickUntilNextResponse(session, 50)
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )
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
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )
      expect(document.querySelector('.crf-status')).toHaveTextContent(
        /coaching/i,
      )
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

  describe('VR-3 maintenance (Milestone 5)', () => {
    it('explains the varying running-average task without claiming a due cue exists', () => {
      const session = vrSession('training-vr-guidance')
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(screen.getByText(/there is no.*due.*cue/i)).toBeInTheDocument()
      expect(screen.queryByText(/watch for.*due/i)).not.toBeInTheDocument()
    })
    it('reuses the delivery target and keyboard shortcut for VR', () => {
      const session = vrSession('training-vr-1')
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)

      const deliverButton = screen.getByRole('button', { name: /deliver/i })
      expect(deliverButton).toHaveClass('delivery-target')
      expect(
        screen.getByText(
          (_, element) =>
            element?.className === 'crf-shortcut-hint' &&
            /press d to deliver/i.test(element.textContent ?? ''),
        ),
      ).toBeInTheDocument()
    })

    it('clicking after a few responses calls deliverStimulus and the status announces on-schedule', async () => {
      const user = userEvent.setup()
      const session = vrSession('training-vr-2')
      // gap=3 matches the seeded average exactly (see deliverAfterGap doc).
      for (let i = 0; i < 3; i++) tickUntilNextResponse(session, 50)
      const { rerender } = render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      await user.click(screen.getByRole('button', { name: /deliver/i }))
      rerender(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      const last = session.getSnapshot().events.at(-1)
      expect(last?.type).toBe('stimulus-delivered')
      expect(
        screen.getByText(/on schedule/i, { exact: false }),
      ).toBeInTheDocument()
    })

    it('the documented "D" keyboard shortcut delivers in VR too', () => {
      const session = vrSession('training-vr-3')
      for (let i = 0; i < 3; i++) tickUntilNextResponse(session, 50)
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      const before = session.getSnapshot().events.length
      fireEvent.keyDown(window, { key: 'd' })
      expect(session.getSnapshot().events.length).toBe(before + 1)
      expect(session.getSnapshot().events.at(-1)?.type).toBe(
        'stimulus-delivered',
      )
    })

    it('shows completed-cycle progress toward vrCyclesToComplete', () => {
      const session = vrSession('training-vr-4')
      completeVrCycles(session, 1)
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.getByText(
          new RegExp(`1 of ${DEFAULT_SIM_CONFIG.vrCyclesToComplete}`, 'i'),
        ),
      ).toBeInTheDocument()
    })

    it('offers to advance to extinction only once vrCyclesToComplete on-schedule cycles are done', () => {
      const session = vrSession('training-vr-5')
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.queryByRole('button', { name: /advance to.*extinction/i }),
      ).not.toBeInTheDocument()

      completeVrCycles(session, DEFAULT_SIM_CONFIG.vrCyclesToComplete)
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.getByRole('button', { name: /advance to.*extinction/i }),
      ).toBeInTheDocument()
    })

    it('surfaces the corrective-coaching message once vrCoachingPauseMs elapses without meeting vrCyclesToComplete', () => {
      const session = vrSession('training-vr-6')
      for (let i = 0; i < DEFAULT_SIM_CONFIG.vrCoachingPauseMs / 50 + 20; i++)
        session.tick(50)
      render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )
      expect(document.querySelector('.vr-status')).toHaveTextContent(
        /coaching/i,
      )
    })

    it('has no automatically detectable accessibility violations in the VR round', async () => {
      const session = vrSession('training-vr-a11y')
      completeVrCycles(session, 2)
      const { container } = render(
        <TrainingScreen state={session.getSnapshot()} session={session} />,
      )
      await expectNoAxeViolations(container)
    })

    it('renders a trial-by-trial reinforcement-history table with credited and blocked marks', () => {
      const session = vrSession('training-vr-history')
      // gap=2 lands in range against the seeded average (credited); a
      // second, much later delivery (gap=30) pushes the hypothetical
      // average well past 4 (blocked, overrun).
      deliverAfterGap(session, 2)
      deliverAfterGap(session, 30)
      const { getByRole } = render(
        <TrainingScreen
          state={session.getSnapshot()}
          session={session}
          mode="advanced"
        />,
      )

      const table = getByRole('table', { name: /reinforcement history/i })
      expect(table).toHaveTextContent('+')
      expect(table).toHaveTextContent('×')
    })

    it('offers both the optional observation and a skip-to-debrief path', () => {
      const session = vrSession('training-vr-choices')
      completeVrCycles(session, DEFAULT_SIM_CONFIG.vrCyclesToComplete)
      render(<TrainingScreen state={session.getSnapshot()} session={session} />)
      expect(
        screen.getByRole('button', { name: /optional extinction/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /skip.*debrief/i }),
      ).toBeInTheDocument()
    })
  })
})

describe('the stopped state is visible where the learner is looking', () => {
  it('says nothing at all while the session is running', () => {
    const session = crfSession('paused-ui-1')
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)
    expect(screen.queryByText(/^Paused\./)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /resume session/i }),
    ).not.toBeInTheDocument()
  })

  it('states the stop and offers an in-round resume, inside the trial content', () => {
    const session = crfSession('paused-ui-2')
    session.setPaused(true)
    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        pauseReason="user"
      />,
    )

    // The control margin is `position: static` below 50rem and scrolls out of
    // view during a round, so the round itself has to carry the state.
    const notice = screen.getByText(/the session is paused/i)
    expect(notice).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /resume session/i }),
    ).toBeInTheDocument()
  })

  it('explains an automatic stop rather than leaving the learner to guess', () => {
    const session = crfSession('paused-ui-3')
    session.setPaused(true)

    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        pauseReason="away"
      />,
    )
    expect(screen.getByText(/because you left this tab/i)).toBeInTheDocument()

    screen.getByRole('button', { name: /resume session/i })
  })

  it('names a coaching checkpoint as the cause when the sim paused itself', () => {
    const session = crfSession('paused-ui-4')
    session.setPaused(true)
    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        pauseReason="coaching"
      />,
    )
    expect(screen.getByText(/coaching checkpoint/i)).toBeInTheDocument()
  })

  it('resumes the simulation from the in-round button', async () => {
    const user = userEvent.setup()
    const session = crfSession('paused-ui-5')
    session.setPaused(true)
    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        pauseReason="user"
      />,
    )

    await user.click(screen.getByRole('button', { name: /resume session/i }))
    expect(session.getSnapshot().paused).toBe(false)
  })

  it('refuses the delivery target while paused, by pointer and by shortcut', async () => {
    const user = userEvent.setup()
    const session = crfSession('paused-ui-6')
    session.setPaused(true)
    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        pauseReason="user"
      />,
    )

    const target = screen.getByRole('button', { name: /^Deliver /i })
    expect(target).toHaveAttribute('aria-disabled', 'true')

    // A paused session emits no responses, so a delivery could only ever be
    // classified noncontingent and counted against the learner (ADR 0011).
    const before = session.getSnapshot().events.length
    await user.click(target)
    expect(session.getSnapshot().events.length).toBe(before)

    fireEvent.keyDown(window, { key: 'd' })
    expect(session.getSnapshot().events.length).toBe(before)
  })

  it('has no axe violations while paused', async () => {
    const session = crfSession('paused-ui-7')
    session.setPaused(true)
    const { container } = render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        pauseReason="away"
      />,
    )
    await expectNoAxeViolations(container)
  })
})

describe('learner-facing copy carries no system units', () => {
  it('never prints a raw millisecond latency in the creature state', () => {
    const session = crfSession('no-ms-1')
    // Land inside the two-second recency window, where the millisecond
    // readout used to live and re-render on every animation frame.
    tickUntilNextResponse(session, 50)
    render(<TrainingScreen state={session.getSnapshot()} session={session} />)

    const state = document.querySelector('.creature-state')
    expect(state).not.toBeNull()
    expect(state?.textContent ?? '').toMatch(/responded just now/i)
    expect(state?.textContent ?? '').not.toMatch(/\d+\s*ms/i)
  })
})

describe('coaching is derived from the event log, not from the clock', () => {
  /** Runs a CRF round past `crfCoachingPauseMs` delivering promptly every time. */
  function coachedCrfSession(seed: string): SimSession {
    const session = crfSession(seed)
    let guard = 0
    while (!session.getTrainingStatus().crfCoachingDue && guard < 200) {
      tickUntilNextResponse(session, 50)
      if (session.getSnapshot().paused) session.setPaused(false)
      const stimulusId = session.getSnapshot().creature.stimuli[0]!.stimulusId
      session.deliverStimulus(stimulusId)
      guard++
    }
    return session
  }

  it('does not accuse a learner whose deliveries the log shows were correct', () => {
    const session = coachedCrfSession('coaching-1')
    // The premise, asserted rather than assumed: a test that silently skips
    // when the seed does not reach a coaching pause proves nothing.
    expect(session.getTrainingStatus().crfCoachingDue).toBe(true)

    const metrics = session.getTrainingStatus().crfMetrics
    // Guard the premise: this run really did deliver cleanly.
    expect(metrics.noncontingentDeliveries).toBe(0)

    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        mode="advanced"
      />,
    )
    const status = document.querySelector('.crf-status')?.textContent ?? ''
    expect(status).toMatch(/no fidelity problem|needs more of them/i)
    expect(status).not.toMatch(/rather than the same number every time/i)
  })

  it('reaches the same conclusion in both presentation modes (ADR 0004)', () => {
    const session = coachedCrfSession('coaching-2')
    expect(session.getTrainingStatus().crfCoachingDue).toBe(true)

    const { unmount } = render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        mode="advanced"
      />,
    )
    const advanced = document.querySelector('.crf-status')?.textContent ?? ''
    unmount()

    render(
      <TrainingScreen
        state={session.getSnapshot()}
        session={session}
        mode="simple"
      />,
    )
    const simple = document.querySelector('.crf-status')?.textContent ?? ''

    // Different wording, same finding: both say nothing is wrong, or both
    // name a problem. A conclusion present in one mode and absent in the
    // other is a defect, not a presentation difference.
    const onTrack = (text: string) =>
      /no fidelity problem|nothing is going wrong|needs more of them|needs a few more/i.test(
        text,
      )
    expect(onTrack(simple)).toBe(onTrack(advanced))
  })
})
