import { SessionControls } from './components/SessionControls'
import { useMode } from './hooks/useMode'
import { useSimState } from './hooks/useSimState'
import { TrainingScreen } from './screens/TrainingScreen'

const TRAINING_PHASES = new Set(['baseline', 'crf', 'vr', 'extinction'])

/**
 * Owns the sim instance, the presentation mode, and screen navigation.
 *
 * Screens are added per milestone: OnboardingScreen and AssessmentScreen
 * (Milestone 2), TrainingScreen (Milestones 3-6), DebriefScreen (Milestone 7).
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

      {/*
        No aria-live here: screens own their own targeted status regions
        (e.g. TrainingScreen's baseline-progress status) instead of one
        live region re-announcing the whole screen on every change.
      */}
      <main>
        {TRAINING_PHASES.has(state.phase) ? (
          <TrainingScreen state={state} session={session} />
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
