import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import { createSession, type SessionState, type SimSession } from '../../sim'

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
  const getSnapshot = useCallback(() => session.getSnapshot(), [session])
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  useSimClock(session)

  return useMemo(() => ({ state, session }), [state, session])
}

/**
 * Drives the controlled clock from animation frames and hands the core elapsed
 * wall-clock time. The core caps the delta and applies speed, so a backgrounded
 * tab cannot silently advance a round; the visibility listener pauses outright
 * so a returning learner is never mid-round without having seen it.
 */
function useSimClock(session: SimSession): void {
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
      if (document.hidden) session.setPaused(true)
      last = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [session])
}
