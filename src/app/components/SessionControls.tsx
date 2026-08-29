import type { SimSession, SessionState } from '../../sim'
import type { Mode } from '../hooks/useMode'
import type { PauseReason } from '../hooks/useSimState'

/** What stopped the session, in the learner's words. */
const PAUSE_REASON_TEXT: Record<PauseReason, string> = {
  away: 'Paused because you left this tab.',
  coaching: 'Paused for a coaching checkpoint.',
  user: 'Paused.',
}

/**
 * Timing and presentation controls. These stay available in every phase so a
 * learner is never trapped in a timed round (accessibility).
 *
 * Speed is a simulation input (ADR 0005) because it changes simulated timing
 * windows; mode is not (ADR 0004).
 */
export function SessionControls({
  rootRef,
  state,
  session,
  mode,
  onModeChange,
  pauseReason,
}: {
  /** Lets the shell measure the bar so layout can reserve its height. */
  rootRef?: ((node: HTMLDivElement | null) => void) | undefined
  state: SessionState
  session: SimSession
  mode: Mode
  onModeChange: (mode: Mode) => void
  pauseReason?: PauseReason | null | undefined
}) {
  const elapsedSeconds = Math.round(state.elapsedSimMs / 1000)

  return (
    <div className="session-controls" ref={rootRef}>
      <button
        type="button"
        className="session-pause"
        onClick={() => void session.setPaused(!state.paused)}
        aria-pressed={state.paused}
      >
        {state.paused ? 'Resume' : 'Pause'}
      </button>

      {/* The labels carry the unit ("1x speed", not "1x") because below
          50rem the legends are visually hidden to keep the control bar two
          rows tall. A programmatic-only group name would leave a sighted
          learner two unexplained numbers beside Simple/Advanced. */}
      <fieldset>
        <legend>Speed</legend>
        {([1, 0.5] as const).map((speed) => (
          <label key={speed}>
            <input
              type="radio"
              name="speed"
              checked={state.speed === speed}
              onChange={() => void session.setSpeed(speed)}
            />
            {speed}&times; speed
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Detail</legend>
        {(['simple', 'advanced'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="mode"
              checked={mode === value}
              onChange={() => onModeChange(value)}
            />
            {value === 'simple' ? 'Simple' : 'Advanced'}
          </label>
        ))}
      </fieldset>

      {/* Only command-driven state belongs in the live region. Elapsed time is
          deliberately separate so the clock cannot announce every second.

          The session can stop without the learner asking (a backgrounded tab,
          a coaching checkpoint), so this names the cause rather than only the
          state — "Paused." alone leaves them to work out what they did. */}
      <p role="status" className="session-status">
        {state.paused ? PAUSE_REASON_TEXT[pauseReason ?? 'user'] : 'Running.'}{' '}
        {state.speed}&times; speed.
      </p>
      <p className="session-elapsed">
        {elapsedSeconds} {elapsedSeconds === 1 ? 'second' : 'seconds'} elapsed.
      </p>
    </div>
  )
}
