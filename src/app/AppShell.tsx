import { AssessmentScreen } from './screens/AssessmentScreen'
import { SessionControls } from './components/SessionControls'
import { useMode } from './hooks/useMode'
import { useReservedHeight } from './hooks/useReservedHeight'
import { useSimState } from './hooks/useSimState'
import { TrainingScreen } from './screens/TrainingScreen'
import { DebriefScreen } from './screens/DebriefScreen'

const TRAINING_PHASES = new Set(['baseline', 'crf', 'vr', 'extinction'])

/**
 * Owns the sim instance, the presentation mode, and screen navigation.
 *
 * Screens are added per milestone: AssessmentScreen (Milestone 2),
 * TrainingScreen (Milestones 3-6), DebriefScreen (Milestone 7).
 *
 * `<main>` deliberately carries no `aria-live` region: the sim clock notifies
 * on every animation frame (see `useSimClock`), and a live region on a
 * container that re-renders that often would re-announce the whole screen
 * continuously. Screens instead scope `role="status"` to the small element
 * that actually changed (Accessibility, "Perception").
 */
export function AppShell({ seed }: { seed?: string } = {}) {
  const { state, session, pauseReason } = useSimState(seed)
  const [mode, setMode] = useMode()

  // Below 50rem the controls are a fixed bar over the bottom of the sheet.
  // Its height depends on the viewport and on which pause message the
  // simulation is showing, so the space reserved for it is measured rather
  // than predicted (see `useReservedHeight`).
  const { containerRef, measuredRef } = useReservedHeight('--control-bar-h')

  return (
    <div
      ref={containerRef}
      className="app-shell"
      // The sheet itself carries the stopped state, so a pause is legible
      // from anywhere on the page rather than only from the control margin
      // — which scrolls out of view entirely below the 50rem breakpoint.
      data-paused={state.paused ? '' : undefined}
    >
      <header>
        <h1>Reinforcement++</h1>
        <p className="boundary-note">
          A short training simulation for learning preference assessment and
          positive reinforcement. It is an educational tool, not clinical
          guidance or decision support.
        </p>
      </header>

      <main>
        {state.phase === 'assessment' ? (
          <AssessmentScreen state={state} session={session} />
        ) : state.phase === 'debrief' ? (
          <DebriefScreen state={state} session={session} mode={mode} />
        ) : TRAINING_PHASES.has(state.phase) ? (
          <TrainingScreen
            state={state}
            session={session}
            mode={mode}
            pauseReason={pauseReason}
          />
        ) : (
          <>
            <h2>Session</h2>
            <p>
              Current phase: <strong>{state.phase}</strong>.
            </p>
          </>
        )}
      </main>

      {/*
       * After `<main>` in the DOM, positioned by `grid-area` (the sheet's
       * margin at >=50rem, a fixed bar below it). Rendered first, the Pause
       * button was the document's first focusable element on every screen,
       * so one Tab from a cold start landed on it and Space stopped a
       * session the learner had not begun — a third path to an unintended
       * stop, on a product that already pauses itself. Focus order now
       * follows reading order: heading, then the task, then the controls.
       */}
      <SessionControls
        rootRef={measuredRef}
        state={state}
        session={session}
        mode={mode}
        onModeChange={setMode}
        pauseReason={pauseReason}
      />
    </div>
  )
}
