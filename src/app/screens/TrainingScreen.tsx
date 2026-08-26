import { useMemo } from 'react'
import {
  DEFAULT_SIM_CONFIG,
  STIMULUS_LABELS,
  isBaselineComplete,
  type SessionState,
  type SimSession,
  type StimulusId,
} from '../../sim'

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
}: {
  state: SessionState
  session: SimSession
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
    </section>
  )
}
