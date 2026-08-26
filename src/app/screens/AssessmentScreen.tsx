import { useMemo } from 'react'
import {
  deriveAssessmentSummary,
  STIMULUS_LABELS,
  type SessionState,
  type SimSession,
  type StimulusId,
} from '../../sim'

/**
 * Phase A: paired-stimulus preference assessment (Core Loop, Phase A).
 *
 * This is an observation task, not a guessing game: `presentNextPair` already
 * committed the creature's choice atomically with the pair, so it is visible
 * in state the instant the pair appears. The learner's job is to watch, then
 * actively record what happened -- recording is never inferred from
 * `creatureSelection`, because that split (observation error as a teaching
 * point, not a defect) is the point of this phase.
 *
 * Every control stays mounted for the whole phase. Trial-to-trial state is
 * expressed with `aria-disabled` plus a guarded no-op handler and a textual
 * status line, rather than the `disabled` attribute, so focus never drops
 * mid-flow for a keyboard-only learner (Accessibility, "Input and
 * interaction").
 */
export function AssessmentScreen({
  state,
  session,
}: {
  state: SessionState
  session: SimSession
}) {
  const { assessment, creature } = state
  const currentTrial = assessment.trials.at(-1)
  const pendingTrial =
    currentTrial !== undefined && !currentTrial.recorded
      ? currentTrial
      : undefined
  const canPresent = !assessment.complete && pendingTrial === undefined

  const summary = useMemo(
    () => deriveAssessmentSummary(state.events),
    [state.events],
  )

  const presentNext = () => {
    if (!canPresent) return
    void session.presentNextPair()
  }

  const record = (stimulusId: string | null) => {
    if (pendingTrial === undefined) return
    void session.recordObservedSelection(stimulusId)
  }

  return (
    <section aria-labelledby="assessment-heading">
      <h3 id="assessment-heading">Preference assessment</h3>
      <p>
        {creature.name} is offered two things, one pair at a time. Watch what{' '}
        {creature.name} does, then record what you saw. This builds a{' '}
        <strong>preference hierarchy</strong> of {creature.name}&rsquo;s
        preferred stimuli -- candidate (putative) reinforcers we can test later,
        once we see them actually change behavior.
      </p>

      <p role="status" className="assessment-progress">
        {assessment.complete
          ? `Assessment complete: all ${assessment.plannedPairs.length} pairs presented.`
          : `Trial ${Math.min(
              assessment.currentTrialIndex + 1,
              assessment.plannedPairs.length,
            )} of ${assessment.plannedPairs.length}.`}
      </p>

      <button type="button" onClick={presentNext} aria-disabled={!canPresent}>
        Show next pair
      </button>
      {!canPresent && !assessment.complete ? (
        <p role="status" className="assessment-hint">
          Record this trial before the next pair.
        </p>
      ) : null}

      <div aria-live="polite">
        {pendingTrial === undefined ? (
          <p>No pair is currently shown.</p>
        ) : (
          <>
            <p>
              {creature.name} was offered:{' '}
              <strong>
                {STIMULUS_LABELS[pendingTrial.leftId as StimulusId]}
              </strong>{' '}
              or{' '}
              <strong>
                {STIMULUS_LABELS[pendingTrial.rightId as StimulusId]}
              </strong>
              .
            </p>
            <p>
              {pendingTrial.creatureSelection === null
                ? `${creature.name} made no selection this trial.`
                : `${creature.name} approached: ${
                    STIMULUS_LABELS[
                      pendingTrial.creatureSelection as StimulusId
                    ]
                  }.`}
            </p>
          </>
        )}
      </div>

      <fieldset>
        <legend>Record what you observed</legend>
        {currentTrial === undefined ? (
          <p role="status">Nothing to record right now.</p>
        ) : (
          <div className="assessment-record-controls">
            <button
              type="button"
              aria-disabled={pendingTrial === undefined}
              onClick={() => record(currentTrial.leftId)}
            >
              {STIMULUS_LABELS[currentTrial.leftId as StimulusId]}
            </button>
            <button
              type="button"
              aria-disabled={pendingTrial === undefined}
              onClick={() => record(currentTrial.rightId)}
            >
              {STIMULUS_LABELS[currentTrial.rightId as StimulusId]}
            </button>
            <button
              type="button"
              aria-disabled={pendingTrial === undefined}
              onClick={() => record(null)}
            >
              Neither (no selection)
            </button>
          </div>
        )}
      </fieldset>

      {assessment.complete ? (
        <div className="assessment-summary">
          <h4>Preference hierarchy</h4>
          <p>
            Ranked by how often {creature.name} chose each item across the{' '}
            {assessment.plannedPairs.length} trials. Items are described as{' '}
            <strong>preferred stimuli</strong> or{' '}
            <strong>candidate (putative) reinforcers</strong> -- none of them is
            called a reinforcer yet. That claim is only earned later, once
            delivering one is shown to actually increase {creature.name}
            &rsquo;s behavior above baseline.
          </p>
          <table>
            <caption>
              {creature.name}&rsquo;s preference hierarchy from this assessment
            </caption>
            <thead>
              <tr>
                <th scope="col">Rank</th>
                <th scope="col">Stimulus</th>
                <th scope="col">Times selected</th>
                <th scope="col">Times presented</th>
                <th scope="col">Selection percentage</th>
              </tr>
            </thead>
            <tbody>
              {summary.hierarchy.map((row) => (
                <tr key={row.stimulusId}>
                  <td>{row.rank}</td>
                  <td>{STIMULUS_LABELS[row.stimulusId as StimulusId]}</td>
                  <td>{row.timesSelected}</td>
                  <td>{row.timesPresented}</td>
                  <td>{Math.round(row.selectionPercentage * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p role="status">
            {summary.recordingAccuracy.accuracy === null
              ? 'No comparable recorded trials.'
              : `You recorded ${summary.recordingAccuracy.matchingTrials} of ${
                  summary.recordingAccuracy.comparableTrials
                } observations to match what ${creature.name} actually did (${Math.round(
                  summary.recordingAccuracy.accuracy * 100,
                )}%).`}
          </p>

          <button
            type="button"
            onClick={() => void session.startRound('baseline')}
          >
            Continue to training
          </button>
        </div>
      ) : null}
    </section>
  )
}
