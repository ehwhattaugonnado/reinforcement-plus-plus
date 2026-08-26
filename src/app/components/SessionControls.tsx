import type { SimSession, SessionState } from '../../sim'
import type { Mode } from '../hooks/useMode'

/**
 * Timing and presentation controls. These stay available in every phase so a
 * learner is never trapped in a timed round (accessibility).
 *
 * Speed is a simulation input (ADR 0005) because it changes simulated timing
 * windows; mode is not (ADR 0004).
 */
export function SessionControls({
  state,
  session,
  mode,
  onModeChange,
}: {
  state: SessionState
  session: SimSession
  mode: Mode
  onModeChange: (mode: Mode) => void
}) {
  return (
    <div className="session-controls">
      <button
        type="button"
        onClick={() => void session.setPaused(!state.paused)}
        aria-pressed={state.paused}
      >
        {state.paused ? 'Resume' : 'Pause'}
      </button>

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
            {speed}&times;
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

      {/* Status is announced textually and never carried by colour alone. */}
      <p role="status" className="session-status">
        {state.paused ? 'Paused.' : 'Running'} {state.speed}&times; speed.{' '}
        {Math.round(state.elapsedSimMs / 1000)} seconds elapsed in this session.
      </p>
    </div>
  )
}
