import type { SimEvent } from '../../sim'
import { formatSimTime } from './format'

/**
 * Renders the raw session event log as a plain accessible table
 * (docs/roadmap.md Milestone 7, "Add the Advanced live event table without
 * exposing mutable simulation state").
 *
 * This takes `events` straight from `SessionState.events` — the same
 * append-only log the chart-data projectors in `src/sim/chart-data.ts`
 * consume — and never recomputes or caches anything of its own. There is no
 * parallel summary state here: every row is a read-only projection of one
 * logged event, not a mutable reference into the running simulation.
 */
export function EventLogTable({
  events,
  title = 'Session event log',
}: {
  events: readonly SimEvent[]
  title?: string
}) {
  return (
    <section aria-labelledby="event-log-heading">
      <h3 id="event-log-heading">{title}</h3>
      <table>
        <caption>Raw session events, in the order they were recorded</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Time</th>
            <th scope="col">Event</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, i) => (
            <tr key={i}>
              <th scope="row">{i + 1}</th>
              <td>{formatSimTime(event.at)}</td>
              <td>{event.type}</td>
              <td>{eventDetails(event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length === 0 && <p>No events recorded yet.</p>}
    </section>
  )
}

/**
 * A plain-text rendering of every field on an event besides `type`/`at`,
 * which already have their own columns. Purely presentational: it does not
 * classify, aggregate, or otherwise reinterpret the event.
 */
function eventDetails(event: SimEvent): string {
  const { type: _type, at: _at, ...rest } = event
  const entries = Object.entries(rest)
  if (entries.length === 0) return ''
  return entries
    .map(([key, value]) => `${key}: ${value === null ? 'none' : String(value)}`)
    .join(', ')
}
