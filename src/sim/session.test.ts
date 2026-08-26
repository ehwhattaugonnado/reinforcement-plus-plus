import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, DEFAULT_SIM_CONFIG } from './config'
import { isBaselineComplete } from './learning'
import { createSession } from './session'
import { replay } from './replay'
import type { SimEvent } from './events'

const SEED = 'test-seed-1'

/** Runs the assessment to completion so later rounds are reachable. */
function completeAssessment(session: ReturnType<typeof createSession>) {
  for (let i = 0; i < 6; i++) {
    expect(session.presentNextPair().ok).toBe(true)
    const trials = session.getSnapshot().assessment.trials
    const current = trials[trials.length - 1]
    expect(current).toBeDefined()
    expect(
      session.recordObservedSelection(current?.creatureSelection ?? null).ok,
    ).toBe(true)
  }
}

describe('session start', () => {
  it('stamps seed, speed, and configVersion into the log', () => {
    const s = createSession({ seed: SEED, speed: 0.5 })
    const [first] = s.getSnapshot().events
    expect(first).toEqual({
      type: 'session-started',
      at: 0,
      seed: SEED,
      speed: 0.5,
      configVersion: CONFIG_VERSION,
    })
    expect(s.getSnapshot().phase).toBe('assessment')
  })

  it('marks an overridden config so it can never replay as default', () => {
    const s = createSession({
      seed: SEED,
      config: { baselineDurationMs: 1000 },
    })
    const first = s.getSnapshot().events[0] as Extract<
      SimEvent,
      { type: 'session-started' }
    >
    expect(first.configVersion).not.toBe(CONFIG_VERSION)
    expect(replay(SEED, s.getSnapshot().events)).toEqual({
      ok: false,
      reason: 'config-version-mismatch',
      detail: expect.any(String),
    })
  })

  it('derives identical seeded starting conditions for the same seed', () => {
    const a = createSession({ seed: SEED }).getSnapshot()
    const b = createSession({ seed: SEED }).getSnapshot()
    expect(a.creature).toEqual(b.creature)
    expect(a.assessment.plannedPairs).toEqual(b.assessment.plannedPairs)
  })

  it('derives different starting conditions for different seeds', () => {
    const a = createSession({ seed: 'seed-a' }).getSnapshot()
    const b = createSession({ seed: 'seed-b' }).getSnapshot()
    expect(a.creature.stimuli).not.toEqual(b.creature.stimuli)
  })
})

describe('controlled clock', () => {
  it('applies speed to wall-clock time to produce simulated time', () => {
    const fast = createSession({ seed: SEED, speed: 1 })
    const slow = createSession({ seed: SEED, speed: 0.5 })
    fast.tick(100)
    slow.tick(100)
    expect(fast.getSnapshot().elapsedSimMs).toBe(100)
    expect(slow.getSnapshot().elapsedSimMs).toBe(50)
  })

  it('caps an unexpectedly large delta so a backgrounded tab cannot skip a round', () => {
    const s = createSession({ seed: SEED })
    s.tick(600_000)
    expect(s.getSnapshot().elapsedSimMs).toBe(DEFAULT_SIM_CONFIG.maxTickDeltaMs)
  })

  it('advances no simulated time while paused', () => {
    const s = createSession({ seed: SEED })
    s.tick(100)
    s.setPaused(true)
    s.tick(5000)
    expect(s.getSnapshot().elapsedSimMs).toBe(100)
    s.setPaused(false)
    s.tick(100)
    expect(s.getSnapshot().elapsedSimMs).toBe(200)
  })

  it('reaches the same simulated time regardless of tick granularity', () => {
    const coarse = createSession({ seed: SEED })
    const fine = createSession({ seed: SEED })
    for (let i = 0; i < 40; i++) coarse.tick(25) // ~40 Hz
    for (let i = 0; i < 120; i++) fine.tick(25 / 3) // ~120 Hz
    expect(fine.getSnapshot().elapsedSimMs).toBeCloseTo(
      coarse.getSnapshot().elapsedSimMs,
      6,
    )
  })

  it('records every clock-affecting command as an event', () => {
    const s = createSession({ seed: SEED })
    s.tick(100)
    s.setPaused(true)
    s.setPaused(false)
    s.setSpeed(0.5)
    const types = s.getSnapshot().events.map((e) => e.type)
    expect(types).toContain('paused')
    expect(types).toContain('resumed')
    expect(types).toContain('speed-changed')
  })

  it('does not record ticks that produce no events', () => {
    const s = createSession({ seed: SEED })
    const before = s.getSnapshot().events.length
    for (let i = 0; i < 50; i++) s.tick(16)
    expect(s.getSnapshot().events.length).toBe(before)
  })
})

describe('invalid commands are atomic', () => {
  it('appends no event, changes no state, and draws no randomness', () => {
    const s = createSession({ seed: SEED })
    const before = s.getSnapshot()
    const drawsBefore = s.rng.draws

    const result = s.deliverStimulus('treat') // wrong phase: still in assessment

    expect(result).toMatchObject({ ok: false, reason: 'wrong-phase' })
    expect(s.getSnapshot()).toBe(before)
    expect(s.rng.draws).toBe(drawsBefore)
  })

  it('never notifies subscribers on rejection', () => {
    const s = createSession({ seed: SEED })
    let notifications = 0
    s.subscribe(() => notifications++)
    s.startRound('vr')
    expect(notifications).toBe(0)
  })

  it('rejects a duplicate pause and an unchanged speed', () => {
    const s = createSession({ seed: SEED })
    expect(s.setPaused(false)).toMatchObject({ reason: 'duplicate-command' })
    expect(s.setSpeed(1)).toMatchObject({ reason: 'duplicate-command' })
  })

  it('rejects an unknown stimulus', () => {
    const s = createSession({ seed: SEED })
    expect(s.recordObservedSelection('sandwich')).toMatchObject({
      reason: 'unknown-stimulus',
    })
  })

  it('rejects a negative or non-finite tick delta', () => {
    const s = createSession({ seed: SEED })
    expect(s.tick(-1)).toMatchObject({ reason: 'invalid-argument' })
    expect(s.tick(Number.NaN)).toMatchObject({ reason: 'invalid-argument' })
  })

  it('refuses to start baseline before the assessment is complete', () => {
    const s = createSession({ seed: SEED })
    expect(s.startRound('baseline')).toMatchObject({ reason: 'not-started' })
  })

  it('enforces round order', () => {
    const s = createSession({ seed: SEED })
    completeAssessment(s)
    expect(s.startRound('vr')).toMatchObject({ reason: 'wrong-phase' })
    expect(s.startRound('baseline').ok).toBe(true)
    expect(s.startRound('baseline')).toMatchObject({
      reason: 'duplicate-command',
    })
    expect(s.startRound('crf').ok).toBe(true)
    expect(s.startRound('vr').ok).toBe(true)
    expect(s.startRound('extinction').ok).toBe(true)
  })
})

describe('snapshots are immutable', () => {
  it('returns a new object identity after a state change', () => {
    const s = createSession({ seed: SEED })
    const before = s.getSnapshot()
    s.presentNextPair()
    expect(s.getSnapshot()).not.toBe(before)
    expect(before.events.length).toBeLessThan(s.getSnapshot().events.length)
  })

  it('does not mutate a previously handed-out snapshot', () => {
    const s = createSession({ seed: SEED })
    const before = s.getSnapshot()
    const beforeTrials = before.assessment.trials.length
    s.presentNextPair()
    expect(before.assessment.trials.length).toBe(beforeTrials)
  })
})

describe('replay', () => {
  it('reconstructs an identical snapshot from seed plus event log', () => {
    const s = createSession({ seed: SEED })
    completeAssessment(s)
    s.tick(200)
    s.setSpeed(0.5)
    s.setPaused(true)
    s.setPaused(false)
    s.startRound('baseline') // last command emits an event, fixing the clock

    const live = s.getSnapshot()
    const result = replay(SEED, live.events)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual(live)
  })

  it('reproduces pauses and speed changes', () => {
    const s = createSession({ seed: SEED })
    s.tick(100)
    s.setSpeed(0.5)
    s.tick(100)
    s.setPaused(true)
    const live = s.getSnapshot()
    const result = replay(SEED, live.events)
    expect(result.ok && result.state.speed).toBe(0.5)
    expect(result.ok && result.state.paused).toBe(true)
  })

  it('is bit-identical for a fixture config passed to both sides', () => {
    const override = { baselineDurationMs: 5000 }
    const s = createSession({ seed: SEED, config: override })
    completeAssessment(s)
    s.startRound('baseline')
    const live = s.getSnapshot()
    const result = replay(SEED, live.events, override)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual(live)
  })

  it('rejects an empty, malformed, or mismatched-seed log', () => {
    expect(replay(SEED, [])).toMatchObject({ reason: 'empty-log' })
    expect(replay(SEED, [{ type: 'paused', at: 0 }])).toMatchObject({
      reason: 'malformed-log',
    })
    const s = createSession({ seed: 'other' })
    expect(replay(SEED, s.getSnapshot().events)).toMatchObject({
      reason: 'malformed-log',
    })
  })

  it('replays identically across a baseline round containing seeded responses', () => {
    const s = createSession({ seed: 'known-seed-1' })
    completeAssessment(s)
    s.startRound('baseline')
    for (let i = 0; i < 45_000 / 50; i++) s.tick(50)
    // `tick` alone doesn't guarantee the last op emitted an event; force one
    // so live state and the log agree on elapsedSimMs (see project.ts notes).
    s.setPaused(true)

    const live = s.getSnapshot()
    expect(
      live.events.filter((e) => e.type === 'response-emitted').length,
    ).toBeGreaterThan(0)

    const result = replay('known-seed-1', live.events)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state).toEqual(live)
  })
})

describe('free-operant response process', () => {
  /** Documented seed cohort for probabilistic/property assertions below. */
  const SEED_COHORT = Array.from({ length: 20 }, (_, i) => `cohort-seed-${i}`)

  function runBaseline(seed: string, tickMs: number, ticks: number) {
    const s = createSession({ seed })
    completeAssessment(s)
    s.startRound('baseline')
    for (let i = 0; i < ticks; i++) s.tick(tickMs)
    return s.getSnapshot()
  }

  it('emits a known response stream for a known seed (regression pin)', () => {
    // These exact timestamps depend on the `responses`-labeled RNG stream's
    // draw order alone (protected from the Milestone 2 assessment's separate
    // `behaviorRng` draws by ADR-consistent stream namespacing), but they
    // still depend on `createInitialState`'s `setupRng` draw sequence, since
    // that determines this seed's baseline rate. If `initial-state.ts`'s
    // draw order or count ever changes, re-pin these numbers rather than
    // treating a diff here as a behavioral regression.
    const snapshot = runBaseline('known-seed-1', 50, 45_000 / 50)
    const responses = snapshot.events.filter(
      (e): e is Extract<SimEvent, { type: 'response-emitted' }> =>
        e.type === 'response-emitted',
    )
    expect(responses.map((r) => r.responseId)).toEqual([
      'response-1',
      'response-2',
      'response-3',
      'response-4',
      'response-5',
      'response-6',
    ])
    expect(responses.map((r) => Math.round(r.at))).toEqual([
      842, 1121, 8824, 11059, 17401, 35462,
    ])
  })

  it('produces render-frequency-invariant response timestamps (~40Hz vs ~120Hz)', () => {
    // Same total simulated time (1000ms), different tick granularity.
    const coarse = runBaseline('known-seed-1', 25, 40)
    const fine = runBaseline('known-seed-1', 25 / 3, 120)

    const coarseAt = coarse.events
      .filter((e) => e.type === 'response-emitted')
      .map((e) => e.at)
    const fineAt = fine.events
      .filter((e) => e.type === 'response-emitted')
      .map((e) => e.at)

    expect(fineAt.length).toBe(coarseAt.length)
    fineAt.forEach((at, i) => expect(at).toBeCloseTo(coarseAt[i] as number, 6))
  })

  it('never lets response generation take the selected schedule as an input (session-level check)', () => {
    // Same seed, same simulated ticks, only the schedule label differs. `a`
    // stops in CRF; `b` proceeds straight on into VR via two `startRound`
    // calls issued back-to-back with no ticks between them, so both
    // `phase-changed` events land at the same `elapsedSimMs` and consume no
    // `responseRng` draws. `startRound`'s own result is checked at each step
    // -- a silently-rejected command (e.g. round order regressing) would
    // otherwise leave both sessions in the same phase and pass vacuously.
    const a = createSession({ seed: 'invariant-run' })
    completeAssessment(a)
    expect(a.startRound('baseline').ok).toBe(true)
    for (let i = 0; i < 20; i++) a.tick(50)
    expect(a.startRound('crf').ok).toBe(true)
    for (let i = 0; i < 20; i++) a.tick(50)

    const b = createSession({ seed: 'invariant-run' })
    completeAssessment(b)
    expect(b.startRound('baseline').ok).toBe(true)
    for (let i = 0; i < 20; i++) b.tick(50)
    expect(b.startRound('crf').ok).toBe(true)
    expect(b.startRound('vr').ok).toBe(true)
    for (let i = 0; i < 20; i++) b.tick(50)

    expect(a.getSnapshot().schedulePlan?.type).toBe('CRF')
    expect(b.getSnapshot().schedulePlan?.type).toBe('VR')

    const responsesA = a
      .getSnapshot()
      .events.filter((e) => e.type === 'response-emitted')
    const responsesB = b
      .getSnapshot()
      .events.filter((e) => e.type === 'response-emitted')
    expect(responsesA).toEqual(responsesB)
  })

  it('marks baseline complete only after baselineDurationMs of simulated time (cohort)', () => {
    for (const seed of SEED_COHORT.slice(0, 5)) {
      const s = createSession({ seed })
      completeAssessment(s)
      s.startRound('baseline')
      for (let i = 0; i < 44_000 / 50; i++) s.tick(50)
      expect(
        isBaselineComplete(
          s.getSnapshot().events,
          s.getSnapshot().elapsedSimMs,
          DEFAULT_SIM_CONFIG,
        ),
      ).toBe(false)
      for (let i = 0; i < 2000 / 50; i++) s.tick(50)
      expect(
        isBaselineComplete(
          s.getSnapshot().events,
          s.getSnapshot().elapsedSimMs,
          DEFAULT_SIM_CONFIG,
        ),
      ).toBe(true)
    }
  })

  it('does not generate responses during assessment', () => {
    const s = createSession({ seed: SEED })
    for (let i = 0; i < 100; i++) s.tick(50)
    expect(
      s.getSnapshot().events.some((e) => e.type === 'response-emitted'),
    ).toBe(false)
  })

  it('produces a positive response count across a seed cohort within a 45s baseline (tolerant)', () => {
    const counts = SEED_COHORT.map(
      (seed) =>
        runBaseline(seed, 50, 45_000 / 50).events.filter(
          (e) => e.type === 'response-emitted',
        ).length,
    )
    // Tolerant cohort assertion: most seeds should produce at least one
    // response in 45s at baseline rates of 2-4/min, but not every seed is
    // required to (testing-strategy.md).
    const withAtLeastOne = counts.filter((c) => c > 0).length
    expect(withAtLeastOne).toBeGreaterThanOrEqual(
      Math.ceil(SEED_COHORT.length * 0.8),
    )
  })
})
