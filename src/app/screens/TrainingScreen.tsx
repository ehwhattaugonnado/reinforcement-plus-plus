import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  STIMULUS_LABELS,
  buildCumulativeRecordChartData,
  buildResponseRateChartData,
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

const SIMPLE_PHASE_COPY: Record<string, string> = {
  baseline: 'First, watch Pip on their own before training begins.',
  crf: 'Now deliver the chosen item after every response.',
  vr: 'Now vary how many responses happen before each delivery.',
  extinction: 'Optional: watch what happens when deliveries stop.',
}

const ADVANCED_PHASE_COPY: Record<string, string> = {
  baseline: 'Baseline: watching Pip on their own, before any training.',
  crf: 'CRF acquisition: reinforce every response.',
  vr: 'VR-3 maintenance: use a varying responses-per-delivery pattern.',
  extinction: 'Optional extinction-effects demonstration.',
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

  const trainingStatus = useMemo(
    () => session.getTrainingStatus(),
    [session, state],
  )
  const baselineDone =
    state.phase === 'baseline' && trainingStatus.baselineComplete

  // --- CRF acquisition (Milestone 4) ---

  const stimuli = state.creature.stimuli
  const assessmentSummary = useMemo(
    () => session.getDebriefSummary().assessment,
    [session, state.events],
  )
  const preferenceOrder = assessmentSummary.hierarchy
  const [selectedStimulusId, setSelectedStimulusId] = useState<StimulusId>(
    () =>
      (preferenceOrder[0]?.stimulusId ?? stimuli[0]?.stimulusId) as StimulusId,
  )

  const outstandingCycle = trainingStatus.outstandingCycle
  const crfMetrics = trainingStatus.crfMetrics
  const acquisitionMet = trainingStatus.acquisitionMet
  const coachingDue = trainingStatus.crfCoachingDue

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
        !event.repeat &&
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

  const vrCyclesCompletedCount = trainingStatus.vrCredited
  const vrCoachingDueFlag = trainingStatus.vrCoachingDue
  const vrCyclesRemaining = trainingStatus.vrRemaining
  const vrTrialHistoryList = trainingStatus.vrHistory
  const extinctionComplete = trainingStatus.extinctionComplete

  // VR-3 has no discrete "the schedule is now due" instant (ADR 0010): every
  // delivery is judged independently against the round's running average of
  // responses-per-delivery, so there is nothing to wait for the way CRF's
  // outstandingCycle is -- the status below always reflects the last
  // delivery's outcome or the live count/average.
  const vrStatusText = (() => {
    if (vrCoachingDueFlag) {
      return (
        `Coaching: the ${trainingStatus.vrRequired} on-schedule cycles have not been reached yet. ` +
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

  const simpleCrfStatusText = coachingDue
    ? `Pause and refocus: deliver right after every response from ${state.creature.name}.`
    : lastDelivery !== undefined
      ? lastDelivery.contingency === 'noncontingent'
        ? 'That delivery did not follow a response, so it cannot strengthen that response.'
        : lastDelivery.timing === 'prompt'
          ? 'Delivered promptly after a response.'
          : 'That delivery came too late after the response.'
      : outstandingCycle !== null
        ? `${state.creature.name} just responded. Deliver now.`
        : `Waiting for ${state.creature.name} to respond.`
  const simpleVrStatusText = vrCoachingDueFlag
    ? 'Try changing the number of responses between deliveries instead of repeating one pattern.'
    : lastDelivery !== undefined
      ? lastDelivery.contingency === 'noncontingent'
        ? 'That delivery did not follow a response.'
        : lastDelivery.scheduleFidelity === 'on-schedule'
          ? 'That delivery fit the varied pattern.'
          : 'Keep varying the response count while averaging about three.'
      : 'Choose changing response counts, such as two, then four, then three.'

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
      <p>
        {(mode === 'simple' ? SIMPLE_PHASE_COPY : ADVANCED_PHASE_COPY)[
          state.phase
        ] ?? state.phase}
      </p>

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
            ? mode === 'simple'
              ? 'Watching complete. Choose an item informed by the preference hierarchy, then start training.'
              : 'Baseline complete. Choose a stimulus informed by the preference hierarchy, then start CRF.'
            : 'Baseline in progress: this is a reference measurement and is not scored.'}
        </p>
      )}

      {state.phase === 'baseline' && baselineDone && (
        <section aria-labelledby="training-choice-heading">
          <h3 id="training-choice-heading">Choose an item to test</h3>
          <p>
            The assessment ranked these items from most to least often chosen.
            The ranking makes the choice informed, but the item is still only a
            preferred stimulus until future responding shows whether it
            functioned as a reinforcer.
          </p>
          <StimulusPicker
            name="baseline-stimulus"
            selected={selectedStimulusId}
            onSelect={setSelectedStimulusId}
            hierarchy={preferenceOrder}
          />
          <button type="button" onClick={() => void session.startRound('crf')}>
            {mode === 'simple' ? 'Start training' : 'Start CRF acquisition'}
          </button>
        </section>
      )}

      {state.phase === 'crf' && (
        <section aria-labelledby="crf-heading" className="crf-round">
          <h3 id="crf-heading">
            {mode === 'simple'
              ? 'Deliver after every response'
              : 'CRF acquisition'}
          </h3>
          <p>
            Every response from {state.creature.name} should be followed by a
            delivery. Choose a preferred item, then deliver it right after{' '}
            {state.creature.name} responds. Promptness and consistency are what
            let us test whether the item increases future responding.
          </p>

          <StimulusPicker
            name="crf-stimulus"
            selected={selectedStimulusId}
            onSelect={setSelectedStimulusId}
            hierarchy={preferenceOrder}
          />

          <p role="status" className="crf-status">
            {mode === 'simple' ? simpleCrfStatusText : crfStatusText}
          </p>

          <button type="button" className="delivery-target" onClick={deliver}>
            Deliver {STIMULUS_LABELS[selectedStimulusId]} to{' '}
            {state.creature.name}
          </button>
          <p className="crf-shortcut-hint">
            Keyboard shortcut: press <kbd>D</kbd> to deliver.
          </p>

          {mode === 'advanced' ? (
            <p className="crf-progress">
              On-schedule deliveries: {crfMetrics.onScheduleDeliveries}.{' '}
              {crfMetrics.contingentDeliveryRate === null
                ? 'No deliveries yet.'
                : `Contingent-delivery rate: ${Math.round(
                    crfMetrics.contingentDeliveryRate * 100,
                  )}%. Prompt-delivery rate: ${
                    crfMetrics.promptDeliveryRate === null
                      ? 'n/a'
                      : `${Math.round(crfMetrics.promptDeliveryRate * 100)}%`
                  }.`}{' '}
              Missed criteria: {crfMetrics.missedCriteria}. Premature
              deliveries: {crfMetrics.prematureDeliveries}. Noncontingent
              deliveries: {crfMetrics.noncontingentDeliveries}. Overruns:{' '}
              {crfMetrics.overrunDeliveries}.
            </p>
          ) : (
            <p>
              Keep delivering promptly after each response. You can continue
              when the response pattern has increased reliably.
            </p>
          )}

          {acquisitionMet && (
            <button type="button" onClick={() => void session.startRound('vr')}>
              {mode === 'simple'
                ? 'Continue to varied practice'
                : 'Advance to VR-3 maintenance'}
            </button>
          )}
        </section>
      )}

      {state.phase === 'vr' && (
        <section aria-labelledby="vr-heading" className="vr-round">
          <h3 id="vr-heading">
            {mode === 'simple'
              ? 'Vary the number of responses'
              : 'VR-3 maintenance'}
          </h3>
          <p>
            Vary how many responses happen before each delivery. There is no
            “due” cue or hidden exact count: use a changing pattern while
            keeping the average near three responses per delivery.
          </p>

          <StimulusPicker
            name="vr-stimulus"
            selected={selectedStimulusId}
            onSelect={setSelectedStimulusId}
            hierarchy={preferenceOrder}
          />

          <p role="status" className="vr-status">
            {mode === 'simple' ? simpleVrStatusText : vrStatusText}
          </p>

          <button type="button" className="delivery-target" onClick={deliver}>
            Deliver {STIMULUS_LABELS[selectedStimulusId]} to{' '}
            {state.creature.name}
          </button>
          <p className="crf-shortcut-hint">
            Keyboard shortcut: press <kbd>D</kbd> to deliver.
          </p>

          <p className="vr-progress">
            {mode === 'simple'
              ? 'Credited deliveries'
              : 'Credited on-schedule deliveries'}
            : {vrCyclesCompletedCount} of {trainingStatus.vrRequired} needed
            {vrCyclesRemaining > 0 ? ` (${vrCyclesRemaining} to go)` : ''}.
          </p>

          {mode === 'advanced' && vrTrialHistoryList.length > 0 && (
            <div className="table-scroll">
              <table className="vr-trial-history">
                <caption>
                  Reinforcement history: one column per response, in order.
                  &quot;+&quot; means that response earned credited
                  reinforcement; &quot;&times;&quot; means a delivery was
                  attempted but not credited (too soon, too late, or too
                  predictable a pattern); blank means no delivery followed that
                  response.
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
            </div>
          )}

          {vrCyclesCompletedCount >= trainingStatus.vrRequired && (
            <div className="round-actions">
              <button
                type="button"
                onClick={() => void session.startRound('extinction')}
              >
                Advance to the optional extinction-effects demonstration
              </button>
              <button
                type="button"
                onClick={() => void session.finishSession()}
              >
                Skip demonstration and see debrief
              </button>
            </div>
          )}
        </section>
      )}

      {state.phase === 'extinction' && (
        <section
          aria-labelledby="extinction-heading"
          className="extinction-round"
        >
          <h3 id="extinction-heading">Observe when deliveries stop</h3>
          <p>
            Do not deliver an item in this optional demonstration. Just watch
            the response pattern after a previously reinforced response no
            longer produces the item. A temporary increase may happen, but it is
            seeded and probabilistic—not inevitable.
          </p>
          <p>
            Ordinary decreases, satiation, and a response returning later are
            not an extinction burst. The debrief will describe only what the
            event-derived evidence supports in this run.
          </p>
          {extinctionComplete ? (
            <p role="status">Observation complete. The debrief is ready.</p>
          ) : (
            <p>
              {Math.ceil(trainingStatus.extinctionRemainingMs / 1000)} simulated
              seconds of observation remain.
            </p>
          )}
          {extinctionComplete && (
            <button type="button" onClick={() => void session.finishSession()}>
              Finish demonstration and see debrief
            </button>
          )}
        </section>
      )}

      {mode === 'advanced' && (
        <>
          <h3>Stimulus values</h3>
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">
                Current motivating value of each stimulus, for{' '}
                {state.creature.name}
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
                    <th scope="row">
                      {STIMULUS_LABELS[s.stimulusId as StimulusId]}
                    </th>
                    <td>{Math.round(s.currentValue * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

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

function StimulusPicker({
  name,
  selected,
  onSelect,
  hierarchy,
}: {
  name: string
  selected: StimulusId
  onSelect: (id: StimulusId) => void
  hierarchy: readonly { readonly stimulusId: string; readonly rank: number }[]
}) {
  return (
    <fieldset>
      <legend>What to deliver</legend>
      <div className="stimulus-options">
        {hierarchy.map((row) => {
          const id = row.stimulusId as StimulusId
          return (
            <label key={id}>
              <input
                type="radio"
                name={name}
                checked={selected === id}
                onChange={() => onSelect(id)}
              />
              Rank {row.rank}: {STIMULUS_LABELS[id]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
