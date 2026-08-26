import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, DEFAULT_SIM_CONFIG } from './config'
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
})
