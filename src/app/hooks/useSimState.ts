import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { createSession, type SessionState, type SimSession } from '../../sim'
import type { PauseReason } from '../components/pause-copy'

// The reason vocabulary and its wording live together in `pause-copy.ts`,
// which has no imports so the end-to-end project can read the strings
// without pulling in the simulation core. Re-exported here because this is
// where the reason is derived, and where every consumer already looks.
export type { PauseReason } from '../components/pause-copy'

/**
 * Presentation cadence for the snapshot bridge, in simulated milliseconds.
 *
 * The core advances on every animation frame, so the raw snapshot changes
 * identity ~60 times a second and every consumer re-renders that often. No
 * display in this app is finer-grained than a tenth of a second, so the
 * bridge collapses the clock to this quantum and lets React bail out in
 * between. This is presentation-only: `elapsedSimMs` inside the core keeps
 * full precision, commands still read live state, and no simulated timing
 * window is affected (ADR 0005).
 */
const RENDER_QUANTUM_MS = 250

/**
 * The identity of a snapshot *as far as the UI is concerned*. Two snapshots
 * with the same key render identically, so the bridge can hand React the
 * older one and skip the re-render entirely.
 */
function presentationKey(state: SessionState): string {
  return [
    state.phase,
    String(state.paused),
    String(state.speed),
    String(state.events.length),
    String(Math.floor(state.elapsedSimMs / RENDER_QUANTUM_MS)),
  ].join('|')
}

/**
 * The only bridge between the simulation core and React (ADR 0002).
 *
 * Components render the snapshot and send commands. No simulation rule lives
 * in a hook or a component, and the shell never constructs a session with a
 * config override — the production UI always uses documented defaults.
 */
export function useSimState(seed?: string): {
  state: SessionState
  session: SimSession
  pauseReason: PauseReason | null
} {
  // One session per mount, created lazily. Switching presentation mode must
  // never reach here: it would reset the simulation (ADR 0004).
  const [session] = useState<SimSession>(() =>
    createSession(seed === undefined ? {} : { seed }),
  )

  const subscribe = useCallback(
    (listener: () => void) => session.subscribe(listener),
    [session],
  )

  // Cache the last snapshot we handed React, keyed by its presentation
  // identity. `useSyncExternalStore` requires getSnapshot to be referentially
  // stable while nothing observable has changed, which is exactly the
  // property that makes the throttle safe rather than a race.
  const cache = useRef<{ key: string; state: SessionState } | null>(null)
  const getSnapshot = useCallback(() => {
    const next = session.getSnapshot()
    const key = presentationKey(next)
    const cached = cache.current
    if (cached !== null && cached.key === key) return cached.state
    cache.current = { key, state: next }
    return next
  }, [session])

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const awayPaused = useSimClock(session)

  // The core records *that* a pause happened and whether it was automatic
  // coaching (`session.ts`), but a visibility pause reaches it as an ordinary
  // user pause, so the shell tracks that one itself. Reason is presentation
  // only — it changes what the paused treatment says, never the simulation.
  const pauseReason = useMemo<PauseReason | null>(() => {
    if (!state.paused) return null
    if (awayPaused) return 'away'
    for (let i = state.events.length - 1; i >= 0; i--) {
      const event = state.events[i]
      if (event?.type === 'paused') {
        return event.reason === 'coaching' ? 'coaching' : 'user'
      }
    }
    return 'user'
  }, [state.paused, state.events, awayPaused])

  return useMemo(
    () => ({ state, session, pauseReason }),
    [state, session, pauseReason],
  )
}

/**
 * Drives the controlled clock from animation frames and hands the core elapsed
 * wall-clock time. The core caps the delta and applies speed, so a backgrounded
 * tab cannot silently advance a round; the visibility listener pauses outright
 * so a returning learner is never mid-round without having seen it
 * (docs/architecture/overview.md).
 *
 * The pause is deliberately *not* lifted on return: a learner who comes back
 * resumes explicitly, the same way they do after a coaching pause. Returns a
 * flag recording whether the standing pause was this listener's doing, so the
 * shell can say why the session is stopped instead of leaving the learner to
 * discover it. It is state rather than a ref because the paused treatment
 * renders from it.
 */
function useSimClock(session: SimSession): boolean {
  const [awayPaused, setAwayPaused] = useState(false)

  useEffect(() => {
    let frame = 0
    let last = performance.now()

    const loop = (now: number) => {
      session.tick(now - last)
      last = now
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    const onVisibility = () => {
      if (document.hidden) {
        // Only claim the pause if this listener is the one causing it;
        // a session the learner already paused stays their pause.
        if (!session.getSnapshot().paused) {
          setAwayPaused(true)
          void session.setPaused(true)
        }
      }
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // A resume — from the control margin or the in-round button — ends the
    // "you left this tab" explanation, whoever triggered it.
    const unsubscribe = session.subscribe(() => {
      if (!session.getSnapshot().paused) setAwayPaused(false)
    })

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
      unsubscribe()
    }
  }, [session])

  return awayPaused
}
