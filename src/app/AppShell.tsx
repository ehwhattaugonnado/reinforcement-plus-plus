import { AssessmentScreen } from './screens/AssessmentScreen'
import { SessionControls } from './components/SessionControls'
import { useMode } from './hooks/useMode'
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
  const { state, session } = useSimState(seed)
  const [mode, setMode] = useMode()

  return (
    <div className="app-shell">
      <header>
        <h1>Reinforcement++</h1>
        <p className="boundary-note">
          A short training simulation for learning preference assessment and
          positive reinforcement. It is an educational tool, not clinical
          guidance or decision support.
        </p>
      </header>

      <SessionControls
        state={state}
        session={session}
        mode={mode}
        onModeChange={setMode}
      />

      <main>
        {state.phase === 'assessment' ? (
          <AssessmentScreen state={state} session={session} />
        ) : state.phase === 'debrief' ? (
          <DebriefScreen state={state} session={session} mode={mode} />
        ) : TRAINING_PHASES.has(state.phase) ? (
          <TrainingScreen state={state} session={session} mode={mode} />
        ) : (
          <>
            <h2>Session</h2>
            <p>
              Current phase: <strong>{state.phase}</strong>.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
