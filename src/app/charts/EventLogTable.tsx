import type { SimEvent } from '../../sim'
import { formatSimTime } from './format'

/**
 * Renders the session event log as a plain accessible table
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
  limit,
}: {
  events: readonly SimEvent[]
  title?: string
  /**
   * Show only the most recent `limit` events, newest first.
   *
   * The live view during a round is a monitor, not an archive: unbounded and
   * oldest-first it grew past 4,500px mid-CRF and pushed the delivery target
   * off screen, so the learner had to scroll the whole session history to
   * reach the control they needed. Omit it — as the debrief does — to render
   * the complete log in recorded order.
   */
  limit?: number
}) {
  // Index by position in the real log, so the numbering still reads as "the
  // 27th thing that happened" even when only a window of rows is shown.
  const rows = events.map((event, index) => ({ event, index }))
  const windowed = limit !== undefined && rows.length > limit
  const shown = windowed ? rows.slice(-limit).reverse() : rows

  return (
    <section aria-labelledby="event-log-heading">
      <h3 id="event-log-heading">{title}</h3>
      <div className="table-scroll">
        <table>
          {/* The caption is the table's accessible name, so it keeps a
              stable prefix and only qualifies itself — a name that changed
              the moment the log crossed the limit would rename the table
              out from under anyone navigating by it. */}
          <caption>
            {windowed
              ? `Raw session events — the ${limit} most recent of ${events.length}, newest first`
              : 'Raw session events, in the order they were recorded'}
          </caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Time</th>
              <th scope="col">Event</th>
              <th scope="col">Details</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ event, index }) => (
              <tr key={index}>
                <th scope="row">{index + 1}</th>
                <td>{formatSimTime(event.at)}</td>
                <td>{event.type}</td>
                <td>{eventDetails(event)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {events.length === 0 && <p>No events recorded yet.</p>}
    </section>
  )
}

/**
 * A plain-text rendering of every field on an event besides `type`/`at`,
 * which already have their own columns. Purely presentational: it does not
 * classify, aggregate, or otherwise reinterpret the event.
 *
 * Millisecond values are rounded for display. The core keeps full precision
 * and every metric derives from that; a 14-decimal float in a table read by
 * an RBT trainee reads as a debug dump, and costs credibility with exactly
 * the audience the rigour is meant to earn.
 */
function eventDetails(event: SimEvent): string {
  const { type: _type, at: _at, ...rest } = event
  const entries = Object.entries(rest)
  if (entries.length === 0) return ''
  return entries
    .map(([key, value]) => `${key}: ${formatValue(value)}`)
    .join(', ')
}

function formatValue(value: string | number | boolean | null): string {
  if (value === null) return 'none'
  if (typeof value === 'number' && !Number.isInteger(value)) {
    return String(Math.round(value))
  }
  return String(value)
}
