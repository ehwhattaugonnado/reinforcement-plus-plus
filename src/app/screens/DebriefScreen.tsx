import { useMemo } from 'react'
import {
  STIMULUS_LABELS,
  type SessionState,
  type SimSession,
  type StimulusId,
} from '../../sim'
import { CumulativeRecordChart, ResponseRateChart } from '../charts'
import type { Mode } from '../hooks/useMode'

export function DebriefScreen({
  state,
  session,
  mode,
}: {
  state: SessionState
  session: SimSession
  mode: Mode
}) {
  const result = useMemo(() => session.getDebriefSummary(), [session, state])

  const reinforcerConclusion =
    result.demonstratedStimulusIds.length > 0
      ? `${result.demonstratedStimulusIds.map((id) => STIMULUS_LABELS[id as StimulusId]).join(', ')} met the event-derived evidence rule for functioning as a reinforcer in this session.`
      : 'No item met the event-derived evidence rule for calling it a reinforcer in this session. The assessment identified preferred stimuli, not guaranteed reinforcers.'

  const burstConclusion = (() => {
    switch (result.extinction.kind) {
      case 'burst':
        return 'The recorded response pattern met the configured extinction-burst rule in this run. This effect is not inevitable.'
      case 'no-burst-in-this-run':
        return 'No extinction burst was detected in this run. Bursts are not inevitable.'
      case 'indeterminate':
        return 'The extinction result was indeterminate because there was not enough stable evidence to characterize it.'
      case 'not-evaluable':
        return result.extinction.reason === 'no-extinction-round'
          ? 'You skipped the optional extinction-effects demonstration, so there is no extinction conclusion.'
          : 'The optional extinction result could not be evaluated from this event history.'
    }
  })()

  return (
    <section aria-labelledby="debrief-heading">
      <h2 id="debrief-heading">Session debrief</h2>
      <p className="debrief-conclusion">{reinforcerConclusion}</p>
      <p className="debrief-burst-conclusion">{burstConclusion}</p>
      <p>
        Reinforcement changed a future response pattern; it did not “reinforce
        the creature.” Preference and reinforcement are related questions, but
        they are not interchangeable.
      </p>
      <p>
        This short simulation is educational, not clinical guidance or a
        substitute for individualized assessment by a qualified professional.
      </p>

      {mode === 'advanced' ? (
        <section aria-labelledby="debrief-details-heading">
          <h3 id="debrief-details-heading">Advanced evidence details</h3>
          <p>{result.totalResponses} response events were recorded.</p>
          <CumulativeRecordChart data={result.cumulativeRecord} />
          <ResponseRateChart data={result.responseRates} />
        </section>
      ) : (
        <p>
          Switch to Advanced detail to inspect rates, graphs, and their data
          tables.
        </p>
      )}
    </section>
  )
}
