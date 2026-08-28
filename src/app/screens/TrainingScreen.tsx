import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_SIM_CONFIG,
  STIMULUS_LABELS,
  buildCumulativeRecordChartData,
  buildResponseRateChartData,
  crfAcquisitionMet,
  crfCoachingDue,
  deriveCrfMetrics,
  deriveOutstandingCycle,
  isBaselineComplete,
  vrCoachingDue,
  vrCyclesCompleted,
  vrTrialHistory,
  type SessionState,
  type SimSession,
  type StimulusId,
} from '../../sim'
import {
  CumulativeRecordChart,
  EventLogTable,
  ResponseRateChart,
} from '../charts'
import type { Mode } from '../hooks/useMode'

const PHASE_COPY: Record<string, string> = {
  baseline: 'Baseline: watching Pip on their own, before any training.',
  crf: 'CRF acquisition: reinforce every response.',
  vr: 'VR-3 maintenance: reinforce on a varying schedule.',
  extinction: 'Optional extinction demonstration.',
}

/**
 * Renders the baseline/CRF/VR/extinction rounds. Owns no simulation rules:
 * it reads the snapshot and sends commands, per ADR 0002. Response events
 * and creature state are announced as text, never by color alone, so this
 * stays usable without sight and under reduced motion.
 */
export function TrainingScreen({
  state,
  session,
  mode = 'simple',
}: {
  state: SessionState
  session: SimSession
  mode?: Mode
}) {
  const responseCount = useMemo(
    () => state.events.filter((e) => e.type === 'response-emitted').length,
    [state.events],
  )
  const lastResponseAgoMs = useMemo(() => {
    for (let i = state.events.length - 1; i >= 0; i--) {
      const e = state.events[i]
      if (e?.type === 'response-emitted') return state.elapsedSimMs - e.at
      if (e !== undefined && e.at < state.elapsedSimMs - 10_000) break
    }
    return null
  }, [state.events, state.elapsedSimMs])

  const baselineDone =
    state.phase === 'baseline' &&
    isBaselineComplete(state.events, state.elapsedSimMs, DEFAULT_SIM_CONFIG)

  // --- CRF acquisition (Milestone 4) ---

  const stimuli = state.creature.stimuli
  const [selectedStimulusId, setSelectedStimulusId] = useState<StimulusId>(
    () =>
      stimuli.reduce((best, s) =>
        s.currentValue > best.currentValue ? s : best,
      ).stimulusId as StimulusId,
  )

  const outstandingCycle = useMemo(
    () => deriveOutstandingCycle(state.events, DEFAULT_SIM_CONFIG),
    [state.events],
  )
  const crfMetrics = useMemo(
    () => deriveCrfMetrics(state.events),
    [state.events],
  )
  const acquisitionMet = useMemo(
    () =>
      crfAcquisitionMet(state.events, state.elapsedSimMs, DEFAULT_SIM_CONFIG),
    [state.events, state.elapsedSimMs],
  )
  const coachingDue = useMemo(
    () => crfCoachingDue(state.events, state.elapsedSimMs, DEFAULT_SIM_CONFIG),
    [state.events, state.elapsedSimMs],
  )

  const deliver = useCallback(() => {
    if (state.phase !== 'crf' && state.phase !== 'vr') return
    void session.deliverStimulus(selectedStimulusId)
  }, [session, state.phase, selectedStimulusId])

  // Documented keyboard shortcut for the delivery target: "D", so a
  // keyboard-only learner does not have to tab to the button after every
  // response. Deliberately not Space/Enter (those already activate the
  // focused button) and not a browser-reserved chord (no Ctrl/Cmd/Alt).
  useEffect(() => {
    if (state.phase !== 'crf' && state.phase !== 'vr') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() === 'd' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault()
        deliver()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [state.phase, deliver])

  const lastEvent = state.events[state.events.length - 1]
  const lastDelivery =
    lastEvent?.type === 'stimulus-delivered' ? lastEvent : undefined

  const crfStatusText = (() => {
    if (coachingDue) {
      return (
        `Coaching: acquisition has not been reached yet. Deliver right ` +
        `after ${state.creature.name} responds, every time, for the ` +
        `steadiest results.`
      )
    }
    if (lastDelivery !== undefined) {
      if (lastDelivery.contingency === 'noncontingent') {
        return 'Delivered with no response to credit it to -- noncontingent.'
      }
      const timingText =
        lastDelivery.timing === 'prompt'
          ? 'promptly'
          : 'later than the prompt window'
      const fidelityText =
        lastDelivery.scheduleFidelity === 'on-schedule'
          ? 'on schedule'
          : lastDelivery.scheduleFidelity === 'overrun'
            ? 'after extra responses piled up (a schedule overrun)'
            : 'before the schedule criterion was met (premature)'
      return `Delivered ${timingText}, ${fidelityText}.`
    }
    if (outstandingCycle !== null) {
      return `Reinforcement is due -- ${state.creature.name} just met the criterion. Deliver now.`
    }
    return `Waiting for ${state.creature.name} to respond.`
  })()

  // --- VR-3 maintenance (Milestone 5) ---

  const vrCyclesCompletedCount = useMemo(
    () => vrCyclesCompleted(state.events),
    [state.events],
  )
  const vrCoachingDueFlag = useMemo(
    () => vrCoachingDue(state.events, state.elapsedSimMs, DEFAULT_SIM_CONFIG),
    [state.events, state.elapsedSimMs],
  )
  const vrCyclesRemaining =
    DEFAULT_SIM_CONFIG.vrCyclesToComplete - vrCyclesCompletedCount
  const vrTrialHistoryList = useMemo(
    () => vrTrialHistory(state.events),
    [state.events],
  )

  // VR-3 has no discrete "the schedule is now due" instant (ADR 0010): every
  // delivery is judged independently against the round's running average of
  // responses-per-delivery, so there is nothing to wait for the way CRF's
  // outstandingCycle is -- the status below always reflects the last
  // delivery's outcome or the live count/average.
  const vrStatusText = (() => {
    if (vrCoachingDueFlag) {
      return (
        `Coaching: the ${DEFAULT_SIM_CONFIG.vrCyclesToComplete} on-schedule cycles have not been reached yet. ` +
        `${state.creature.name}'s reinforcement history is judged by a ` +
        `running average, not a fixed count -- try delivering after a ` +
        `varying number of responses rather than the same number every time.`
      )
    }
    if (lastDelivery !== undefined) {
      if (lastDelivery.contingency === 'noncontingent') {
        return 'Delivered with no response to credit it to -- noncontingent.'
      }
      const timingText =
        lastDelivery.timing === 'prompt'
          ? 'promptly'
          : 'later than the prompt window'
      const fidelityText =
        lastDelivery.scheduleFidelity === 'on-schedule'
          ? 'on schedule'
          : lastDelivery.scheduleFidelity === 'overrun'
            ? 'after extra responses piled up (a schedule overrun)'
            : lastDelivery.scheduleFidelity === 'not-variable'
              ? 'too predictable a pattern to count as variable (not credited)'
              : 'too soon for the running average to accept (premature)'
      return `Delivered ${timingText}, ${fidelityText}.`
    }
    const schedulePlan = state.schedulePlan
    if (schedulePlan?.type === 'VR') {
      return (
        `${schedulePlan.responsesSinceReinforcement} responses since the ` +
        `last reinforcement. Running average: ` +
        `${schedulePlan.runningAverage.toFixed(1)} (target 2-4).`
      )
    }
    return `Waiting for ${state.creature.name} to respond.`
  })()

  // The current round is still open while training is in progress, so `now`
  // must be passed explicitly as `state.elapsedSimMs` rather than left to
  // default to the latest logged event — otherwise an idle open round
  // understates its own duration and overstates its displayed rate (see
  // `buildCumulativeRecordChartData`/`buildResponseRateChartData` in
  // src/sim/chart-data.ts and docs/roadmap.md's Milestone 7 checkpoint).
  const cumulativeRecordData = useMemo(
    () => buildCumulativeRecordChartData(state.events, state.elapsedSimMs),
    [state.events, state.elapsedSimMs],
  )
  const responseRateData = useMemo(
    () =>
      buildResponseRateChartData(state.events, undefined, state.elapsedSimMs),
    [state.events, state.elapsedSimMs],
  )

  return (
    <section aria-labelledby="training-heading">
      <h2 id="training-heading">Training</h2>
      <p>{PHASE_COPY[state.phase] ?? state.phase}</p>

      {/*
        Deliberately not a live region: it changes on every response (every
        few seconds at typical rates), and a status announcement that fires
        that often is noise, not an accessibility win. The one status region
        below (baseline progress/complete) changes once and is where an
        announcement earns its place; this text alternative is always
        available to a screen reader on request instead.
      */}
      <p className="creature-state">
        {state.creature.name} has responded {responseCount}{' '}
        {responseCount === 1 ? 'time' : 'times'} so far
        {lastResponseAgoMs !== null && lastResponseAgoMs < 2000
          ? ` — just responded (${Math.round(lastResponseAgoMs)}ms ago).`
          : '.'}{' '}
        Mood: {state.creature.moodState}.
      </p>

      {state.phase === 'baseline' && (
        <p role="status">
          {baselineDone
            ? 'Baseline complete. Choose a stimulus informed by the preference hierarchy, then start CRF.'
            : 'Baseline in progress: this is a reference measurement and is not scored.'}
        </p>
      )}

      {state.phase === 'baseline' && baselineDone && (
        <button type="button" onClick={() => void session.startRound('crf')}>
          Start CRF acquisition
        </button>
      )}

      {state.phase === 'crf' && (
        <section aria-labelledby="crf-heading" className="crf-round">
          <h3 id="crf-heading">CRF acquisition</h3>
          <p>
            Every response from {state.creature.name} earns reinforcement.
            Choose what to deliver, then deliver it right after{' '}
            {state.creature.name} responds -- promptness and consistency are
            what build the association.
          </p>

          <fieldset>
            <legend>What to deliver</legend>
            {stimuli.map((s) => (
              <label key={s.stimulusId}>
                <input
                  type="radio"
                  name="crf-stimulus"
                  checked={selectedStimulusId === s.stimulusId}
                  onChange={() =>
                    setSelectedStimulusId(s.stimulusId as StimulusId)
                  }
                />
                {STIMULUS_LABELS[s.stimulusId as StimulusId]}
              </label>
            ))}
          </fieldset>

          <p role="status" className="crf-status">
            {crfStatusText}
          </p>

          <button type="button" className="delivery-target" onClick={deliver}>
            Deliver {STIMULUS_LABELS[selectedStimulusId]} to{' '}
            {state.creature.name}
          </button>
          <p className="crf-shortcut-hint">
            Keyboard shortcut: press <kbd>D</kbd> to deliver.
          </p>

          <p className="crf-progress">
            On-schedule deliveries: {crfMetrics.onScheduleDeliveries} of{' '}
            {DEFAULT_SIM_CONFIG.crfMinOnScheduleDeliveries} needed.{' '}
            {crfMetrics.contingentDeliveryRate === null
              ? 'No deliveries yet.'
              : `Contingent-delivery rate: ${Math.round(
                  crfMetrics.contingentDeliveryRate * 100,
                )}%. Prompt-delivery rate: ${
                  crfMetrics.promptDeliveryRate === null
                    ? 'n/a'
                    : `${Math.round(crfMetrics.promptDeliveryRate * 100)}%`
                }.`}{' '}
            Missed criteria: {crfMetrics.missedCriteria}. Premature deliveries:{' '}
            {crfMetrics.prematureDeliveries}. Noncontingent deliveries:{' '}
            {crfMetrics.noncontingentDeliveries}. Overruns:{' '}
            {crfMetrics.overrunDeliveries}.
          </p>

          {acquisitionMet && (
            <button type="button" onClick={() => void session.startRound('vr')}>
              Advance to VR-3 maintenance
            </button>
          )}
        </section>
      )}

      {state.phase === 'vr' && (
        <section aria-labelledby="vr-heading" className="vr-round">
          <h3 id="vr-heading">VR-3 maintenance</h3>
          <p>
            Reinforcement is now due on a varying schedule -- watch for the
            "reinforcement due" cue, then deliver right after{' '}
            {state.creature.name} meets it.
          </p>

          <fieldset>
            <legend>What to deliver</legend>
            {stimuli.map((s) => (
              <label key={s.stimulusId}>
                <input
                  type="radio"
                  name="vr-stimulus"
                  checked={selectedStimulusId === s.stimulusId}
                  onChange={() =>
                    setSelectedStimulusId(s.stimulusId as StimulusId)
                  }
                />
                {STIMULUS_LABELS[s.stimulusId as StimulusId]}
              </label>
            ))}
          </fieldset>

          <p role="status" className="vr-status">
            {vrStatusText}
          </p>

          <button type="button" className="delivery-target" onClick={deliver}>
            Deliver {STIMULUS_LABELS[selectedStimulusId]} to{' '}
            {state.creature.name}
          </button>
          <p className="crf-shortcut-hint">
            Keyboard shortcut: press <kbd>D</kbd> to deliver.
          </p>

          <p className="vr-progress">
            Completed on-schedule cycles: {vrCyclesCompletedCount} of{' '}
            {DEFAULT_SIM_CONFIG.vrCyclesToComplete} needed
            {vrCyclesRemaining > 0 ? ` (${vrCyclesRemaining} to go)` : ''}.
          </p>

          {vrTrialHistoryList.length > 0 && (
            <table className="vr-trial-history">
              <caption>
                Reinforcement history: one column per response, in order.
                &quot;+&quot; means that response earned credited reinforcement;
                &quot;&times;&quot; means a delivery was attempted but not
                credited (too soon, too late, or too predictable a pattern);
                blank means no delivery followed that response.
              </caption>
              <thead>
                <tr>
                  {vrTrialHistoryList.map((_, i) => (
                    <th key={i} scope="col">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {vrTrialHistoryList.map((trial, i) => (
                    <td key={i}>
                      {trial.mark === 'credited'
                        ? '+'
                        : trial.mark === 'blocked'
                          ? '×'
                          : ''}
                      <span className="sr-only">
                        {trial.mark === 'credited'
                          ? ' credited'
                          : trial.mark === 'blocked'
                            ? ' not credited'
                            : ' no delivery'}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}

          {vrCyclesCompletedCount >= DEFAULT_SIM_CONFIG.vrCyclesToComplete && (
            <button
              type="button"
              onClick={() => void session.startRound('extinction')}
            >
              Advance to the optional extinction demonstration
            </button>
          )}
        </section>
      )}

      <h3>Stimulus values</h3>
      <table>
        <caption className="visually-hidden">
          Current motivating value of each stimulus, for {state.creature.name}
        </caption>
        <thead>
          <tr>
            <th scope="col">Stimulus</th>
            <th scope="col">Current value</th>
          </tr>
        </thead>
        <tbody>
          {state.creature.stimuli.map((s) => (
            <tr key={s.stimulusId}>
              <th scope="row">{STIMULUS_LABELS[s.stimulusId as StimulusId]}</th>
              <td>{Math.round(s.currentValue * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {mode === 'advanced' && (
        <section aria-labelledby="advanced-view-heading">
          <h3 id="advanced-view-heading">Advanced live view</h3>
          <CumulativeRecordChart data={cumulativeRecordData} />
          <ResponseRateChart data={responseRateData} />
          <EventLogTable events={state.events} />
        </section>
      )}
    </section>
  )
}
