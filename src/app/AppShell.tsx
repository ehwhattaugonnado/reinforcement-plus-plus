import { SessionControls } from './components/SessionControls'
import { useMode } from './hooks/useMode'
import { useSimState } from './hooks/useSimState'

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

      <main aria-live="polite">
        <h2>Session</h2>
        <p>
          Current phase: <strong>{state.phase}</strong>.
        </p>
      </main>
    </div>
  )
}
