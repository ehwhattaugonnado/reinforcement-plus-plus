import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, DEFAULT_SIM_CONFIG, type SimConfig } from './config'
import { crfAcquisitionMet, crfCoachingDue, deriveCrfMetrics } from './crf'
import { isBaselineComplete } from './learning'
import { createSession } from './session'
import { replay } from './replay'
import { deriveVrScheduleState, vrCoachingDue, vrCyclesCompleted } from './vr'
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

/** Runs assessment + baseline, then enters CRF. Returns the ready session. */
function crfSession(
  seed: string,
  config: Partial<SimConfig> = {},
): ReturnType<typeof createSession> {
  const s = createSession({ seed, config })
  completeAssessment(s)
  expect(s.startRound('baseline').ok).toBe(true)
  for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++)
    s.tick(50)
  expect(s.startRound('crf').ok).toBe(true)
  return s
}

const VR_EASY_GATE: Partial<SimConfig> = {
  crfMinOnScheduleDeliveries: 3,
  crfAcquisitionRelativeIncrease: -1,
  crfAcquisitionAbsoluteIncrease: -1000,
}

/** Runs a CRF session through the easy acquisition gate and enters VR. */
function vrSession(
  seed: string,
  config: Partial<SimConfig> = {},
): ReturnType<typeof createSession> {
  const s = crfSession(seed, { ...VR_EASY_GATE, ...config })
  for (let i = 0; i < 3; i++) {
    expect(tickUntilNextResponse(s, 50)).toBe(true)
    const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
    expect(s.deliverStimulus(stimulusId).ok).toBe(true)
  }
  expect(s.startRound('vr').ok).toBe(true)
  return s
}

/** Ticks in `stepMs` increments until at least one new response-emitted appears, or `guard` steps pass. */
function tickUntilNextResponse(
  session: ReturnType<typeof createSession>,
  stepMs: number,
  guard = 5000,
): boolean {
  const before = session
    .getSnapshot()
    .events.filter((e) => e.type === 'response-emitted').length
  let steps = 0
  while (
    session.getSnapshot().events.filter((e) => e.type === 'response-emitted')
      .length === before &&
    steps < guard
  ) {
    session.tick(stepMs)
    if (session.getSnapshot().paused) session.setPaused(false)
    steps++
  }
  return steps < guard
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
    // The CRF acquisition gate (Milestone 4) and the VR cycle-count gate
    // (Milestone 5) are each exercised separately below; here both are
    // trivially satisfied so this test isolates round order.
    const s = createSession({
      seed: SEED,
      config: {
        crfMinOnScheduleDeliveries: 0,
        crfAcquisitionRelativeIncrease: 0,
        crfAcquisitionAbsoluteIncrease: 0,
        vrCyclesToComplete: 0,
      },
    })
    completeAssessment(s)
    expect(s.startRound('vr')).toMatchObject({ reason: 'wrong-phase' })
    expect(s.startRound('baseline').ok).toBe(true)
    expect(s.startRound('baseline')).toMatchObject({
      reason: 'duplicate-command',
    })
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 250; i++)
      s.tick(250)
    expect(s.startRound('crf').ok).toBe(true)
    expect(s.startRound('vr').ok).toBe(true)
    expect(s.startRound('extinction').ok).toBe(true)
  })

  it('rejects crf -> vr until the acquisition gate is met', () => {
    const s = createSession({ seed: SEED })
    completeAssessment(s)
    s.startRound('baseline')
    expect(s.startRound('crf')).toMatchObject({
      reason: 'baseline-not-complete',
    })
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 250; i++)
      s.tick(250)
    expect(s.startRound('crf').ok).toBe(true)
    expect(s.startRound('vr')).toMatchObject({
      reason: 'acquisition-not-met',
    })
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
    // The CRF acquisition gate (Milestone 4) is irrelevant to this
    // response-generation invariant and is trivially satisfied on both
    // sessions so `b`'s immediate crf -> vr transition is not itself the
    // thing under test.
    const gateBypass = {
      crfMinOnScheduleDeliveries: 0,
      crfAcquisitionRelativeIncrease: -1,
      crfAcquisitionAbsoluteIncrease: -1000,
    }

    const a = createSession({ seed: 'invariant-run', config: gateBypass })
    completeAssessment(a)
    expect(a.startRound('baseline').ok).toBe(true)
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 250; i++)
      a.tick(250)
    expect(a.startRound('crf').ok).toBe(true)
    for (let i = 0; i < 20; i++) a.tick(50)

    const b = createSession({ seed: 'invariant-run', config: gateBypass })
    completeAssessment(b)
    expect(b.startRound('baseline').ok).toBe(true)
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 250; i++)
      b.tick(250)
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

describe('CRF acquisition and delivery classification (Milestone 4)', () => {
  // Relative/absolute thresholds pushed deeply negative so the rate clause
  // is always satisfied regardless of the actual (seeded, sparse) response
  // timing: these tests isolate the on-schedule-delivery-count clause and
  // the round-transition/coaching mechanics, not the rate math, which
  // `crf.test.ts` already covers exhaustively as a pure function.
  const EASY_GATE: Partial<SimConfig> = {
    crfMinOnScheduleDeliveries: 3,
    crfAcquisitionRelativeIncrease: -1,
    crfAcquisitionAbsoluteIncrease: -1000,
  }

  function lastDelivery(
    session: ReturnType<typeof createSession>,
  ): Extract<SimEvent, { type: 'stimulus-delivered' }> {
    const last = session.getSnapshot().events.at(-1)
    expect(last?.type).toBe('stimulus-delivered')
    return last as Extract<SimEvent, { type: 'stimulus-delivered' }>
  }

  it('classifies a prompt delivery right after a response as contingent, prompt, and on-schedule', () => {
    const s = crfSession('crf-classify-1')
    expect(tickUntilNextResponse(s, 50)).toBe(true)
    const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
    expect(s.deliverStimulus(stimulusId).ok).toBe(true)
    const last = lastDelivery(s)
    expect(last.contingency).toBe('response-contingent')
    expect(last.timing).toBe('prompt')
    expect(last.scheduleFidelity).toBe('on-schedule')
  })

  it('classifies a delivery with no recent response as noncontingent and not-applicable', () => {
    const s = crfSession('crf-classify-2')
    const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
    expect(s.deliverStimulus(stimulusId).ok).toBe(true)
    const last = lastDelivery(s)
    expect(last.contingency).toBe('noncontingent')
    expect(last.timing).toBe('no-response')
    expect(last.scheduleFidelity).toBe('not-applicable')
  })

  it('classifies a delayed-but-only delivery as on-schedule (timing and fidelity are independent)', () => {
    const s = crfSession('crf-classify-3', { promptDeliveryWindowMs: 1 })
    expect(tickUntilNextResponse(s, 50)).toBe(true)
    s.tick(50) // push latency past the (deliberately tiny) prompt window
    const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
    expect(s.deliverStimulus(stimulusId).ok).toBe(true)
    const last = lastDelivery(s)
    expect(last.contingency).toBe('response-contingent')
    expect(last.timing).toBe('delayed')
    expect(last.scheduleFidelity).toBe('on-schedule')
  })

  it('a delivery is rejected outside crf/vr/extinction (wrong-phase, atomic)', () => {
    const s = createSession({ seed: 'crf-wrong-phase' })
    const before = s.getSnapshot()
    const result = s.deliverStimulus('treat')
    expect(result).toMatchObject({ reason: 'wrong-phase' })
    expect(s.getSnapshot()).toBe(before)
  })

  it('reaches the acquisition gate through repeated prompt on-schedule delivery and can then advance to VR', () => {
    const s = crfSession('crf-acquire-1', EASY_GATE)
    for (let i = 0; i < 3; i++) {
      expect(tickUntilNextResponse(s, 50)).toBe(true)
      const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
      expect(s.deliverStimulus(stimulusId).ok).toBe(true)
      expect(lastDelivery(s).scheduleFidelity).toBe('on-schedule')
    }
    const resolvedConfig = { ...DEFAULT_SIM_CONFIG, ...EASY_GATE }
    expect(
      crfAcquisitionMet(
        s.getSnapshot().events,
        s.getSnapshot().elapsedSimMs,
        resolvedConfig,
      ),
    ).toBe(true)
    expect(s.startRound('vr').ok).toBe(true)
    expect(s.getSnapshot().phase).toBe('vr')
  })

  it('rejects crf -> vr and reports coaching as due once crfCoachingPauseMs elapses without meeting the gate', () => {
    const config: Partial<SimConfig> = { crfCoachingPauseMs: 500 }
    const s = crfSession('crf-coach-1', config)
    const resolvedConfig = { ...DEFAULT_SIM_CONFIG, ...config }
    expect(
      crfCoachingDue(
        s.getSnapshot().events,
        s.getSnapshot().elapsedSimMs,
        resolvedConfig,
      ),
    ).toBe(false)

    for (let i = 0; i < 20; i++) s.tick(50) // 1000ms simulated, past the 500ms pause

    expect(
      crfCoachingDue(
        s.getSnapshot().events,
        s.getSnapshot().elapsedSimMs,
        resolvedConfig,
      ),
    ).toBe(true)
    expect(s.getSnapshot().paused).toBe(true)
    expect(
      s
        .getSnapshot()
        .events.filter((e) => e.type === 'paused' && e.reason === 'coaching'),
    ).toEqual([
      { type: 'paused', at: 45_500, reason: 'coaching', round: 'crf' },
    ])
    expect(s.setPaused(false).ok).toBe(true)
    for (let i = 0; i < 20; i++) s.tick(50)
    expect(
      s
        .getSnapshot()
        .events.filter((e) => e.type === 'paused' && e.reason === 'coaching'),
    ).toHaveLength(1)
    expect(s.startRound('vr')).toMatchObject({
      reason: 'acquisition-not-met',
    })
  })

  describe('the one-abandoned-cycle-per-timeout invariant (session-level)', () => {
    it('an elapsed due window with no delivery contributes exactly one criterion-missed and one cycle-abandoned', () => {
      const s = crfSession('crf-timeout-1', { reinforcementDueWindowMs: 500 })
      expect(tickUntilNextResponse(s, 25)).toBe(true)
      const beforeCount = s.getSnapshot().events.length

      for (let i = 0; i < 400; i++) s.tick(25) // 10s sim, well past the 500ms due window

      const newEvents = s.getSnapshot().events.slice(beforeCount)
      expect(
        newEvents.filter((e) => e.type === 'criterion-missed'),
      ).toHaveLength(1)
      expect(
        newEvents.filter((e) => e.type === 'cycle-abandoned'),
      ).toHaveLength(1)

      const metrics = deriveCrfMetrics(s.getSnapshot().events)
      expect(metrics.missedCriteria).toBe(1)
      expect(metrics.abandonedCycles).toBe(1)
    })

    it('a response opens a fresh, independently classified cycle after abandonment', () => {
      const s = crfSession('crf-timeout-2', { reinforcementDueWindowMs: 500 })
      expect(tickUntilNextResponse(s, 25)).toBe(true)
      for (let i = 0; i < 400; i++) s.tick(25)
      expect(
        s.getSnapshot().events.some((e) => e.type === 'cycle-abandoned'),
      ).toBe(true)

      expect(tickUntilNextResponse(s, 25)).toBe(true)
      const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
      expect(s.deliverStimulus(stimulusId).ok).toBe(true)
      const last = lastDelivery(s)
      expect(last.contingency).toBe('response-contingent')
      expect(last.scheduleFidelity).toBe('on-schedule')
    })
  })

  it('abandons a cycle with reason "round-ended" (and no criterion-missed) when leaving CRF with reinforcement still due', () => {
    const s = crfSession('crf-round-end-1', {
      ...EASY_GATE,
      reinforcementDueWindowMs: 10_000_000, // never times out on its own within this test
    })
    // Satisfy the acquisition gate with three on-schedule deliveries.
    for (let i = 0; i < 3; i++) {
      expect(tickUntilNextResponse(s, 50)).toBe(true)
      const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
      expect(s.deliverStimulus(stimulusId).ok).toBe(true)
    }
    // One more response opens a cycle that is deliberately left outstanding.
    expect(tickUntilNextResponse(s, 50)).toBe(true)
    expect(
      s.getSnapshot().events.filter((e) => e.type === 'criterion-met').length,
    ).toBe(4)
    const missedBefore = s
      .getSnapshot()
      .events.filter((e) => e.type === 'criterion-missed').length

    expect(s.startRound('vr').ok).toBe(true)

    const events = s.getSnapshot().events
    const abandonments = events.filter((e) => e.type === 'cycle-abandoned')
    expect(abandonments).toHaveLength(1)
    expect(abandonments[0]).toMatchObject({ reason: 'round-ended' })
    // Round-ended abandonment is not a missed-criteria event (core-loop.md:
    // "the only way a criterion is missed" is a due-window timeout).
    expect(events.filter((e) => e.type === 'criterion-missed').length).toBe(
      missedBefore,
    )
  })
})

describe('CRF timing invariance across speeds (Milestone 4)', () => {
  /**
   * Drives two sessions through matched *simulated* time (`tick(50)` at 1x
   * vs `tick(100)` at 0.5x both advance 50 simulated ms per step) and
   * asserts identical classifications, latencies, and prompt-delivery rate
   * -- the slower speed setting must carry no scoring penalty or bonus
   * (docs/accessibility.md; data-model section 3).
   */
  it('produces identical delivery classification and prompt-delivery rate at 0.5x and 1x for matched simulated time', () => {
    const seed = 'crf-speed-invariance-1'
    const fast = createSession({ seed, speed: 1 })
    const slow = createSession({ seed, speed: 0.5 })
    for (const s of [fast, slow]) {
      completeAssessment(s)
      expect(s.startRound('baseline').ok).toBe(true)
    }
    for (let i = 0; i < DEFAULT_SIM_CONFIG.baselineDurationMs / 50; i++) {
      fast.tick(50)
      slow.tick(100)
    }
    for (const s of [fast, slow]) expect(s.startRound('crf').ok).toBe(true)

    expect(tickUntilNextResponse(fast, 50)).toBe(true)
    expect(tickUntilNextResponse(slow, 100)).toBe(true)
    expect(fast.getSnapshot().elapsedSimMs).toBeCloseTo(
      slow.getSnapshot().elapsedSimMs,
      6,
    )

    const stimulusIdFast = fast.getSnapshot().creature.stimuli[0]!.stimulusId
    const stimulusIdSlow = slow.getSnapshot().creature.stimuli[0]!.stimulusId
    expect(stimulusIdFast).toBe(stimulusIdSlow)

    expect(fast.deliverStimulus(stimulusIdFast).ok).toBe(true)
    expect(slow.deliverStimulus(stimulusIdSlow).ok).toBe(true)

    const fastDelivery = fast.getSnapshot().events.at(-1) as Extract<
      SimEvent,
      { type: 'stimulus-delivered' }
    >
    const slowDelivery = slow.getSnapshot().events.at(-1) as Extract<
      SimEvent,
      { type: 'stimulus-delivered' }
    >
    expect(slowDelivery.contingency).toBe(fastDelivery.contingency)
    expect(slowDelivery.timing).toBe(fastDelivery.timing)
    expect(slowDelivery.scheduleFidelity).toBe(fastDelivery.scheduleFidelity)
    expect(slowDelivery.latencyMs).toBeCloseTo(fastDelivery.latencyMs!, 6)

    const fastMetrics = deriveCrfMetrics(fast.getSnapshot().events)
    const slowMetrics = deriveCrfMetrics(slow.getSnapshot().events)
    expect(slowMetrics.promptDeliveryRate).toBe(fastMetrics.promptDeliveryRate)
  })
})

describe('VR-3 guided maintenance (Milestone 5, revised per ADR 0010)', () => {
  /**
   * Delivers after exactly `gap` responses. A repeating [2, 4, 3] cycle
   * (mean 3, like the seeded phantom prior) keeps every delivery's
   * hypothetical running average in range and never repeats the same gap
   * three times running, so it never trips the `not-variable` check either
   * -- a reliable way to rack up on-schedule VR cycles in tests without
   * hand-computing the running average at each step.
   */
  const RELIABLE_GAP_CYCLE = [2, 4, 3]

  function deliverAfterGap(
    s: ReturnType<typeof createSession>,
    gap: number,
  ): Extract<SimEvent, { type: 'stimulus-delivered' }> {
    for (let i = 0; i < gap; i++) {
      expect(tickUntilNextResponse(s, 50)).toBe(true)
    }
    const stimulusId = s.getSnapshot().creature.stimuli[0]!.stimulusId
    expect(s.deliverStimulus(stimulusId).ok).toBe(true)
    return s.getSnapshot().events.at(-1) as Extract<
      SimEvent,
      { type: 'stimulus-delivered' }
    >
  }

  /** Credits `count` on-schedule VR cycles using RELIABLE_GAP_CYCLE. */
  function completeVrCycles(
    s: ReturnType<typeof createSession>,
    count: number,
  ) {
    for (let i = 0; i < count; i++) {
      const delivery = deliverAfterGap(
        s,
        RELIABLE_GAP_CYCLE[i % RELIABLE_GAP_CYCLE.length] as number,
      )
      expect(delivery.scheduleFidelity).toBe('on-schedule')
    }
  }

  it('seeds schedulePlan with the phantom-average prior and zero responses on entering VR', () => {
    const s = vrSession('vr-entry-1')
    const schedulePlan = s.getSnapshot().schedulePlan
    expect(schedulePlan?.type).toBe('VR')
    expect(schedulePlan).toMatchObject({
      responsesSinceReinforcement: 0,
      acceptedGaps: [],
      runningAverage: DEFAULT_SIM_CONFIG.vrAverageSeedValue,
    })
  })

  it('has no floor: a delivery on the very first response of the round can be accepted', () => {
    // gap=1 against a seed of three 3's: (9+1)/4 = 2.5, in [2,4].
    const s = vrSession('vr-no-floor-1')
    const delivery = deliverAfterGap(s, 1)
    expect(delivery.scheduleFidelity).toBe('on-schedule')
    expect(vrCyclesCompleted(s.getSnapshot().events)).toBe(1)
  })

  it('rejects a delivery whose hypothetical average would fall below the acceptable range as premature', () => {
    // Varied low gaps (never two identical accepted gaps in a row, so the
    // not-variable check never intervenes) gradually pull the running
    // average down: (9+1)/4=2.5, (9+1+2)/5=2.4, (9+1+2+1)/6=2.167,
    // (9+1+2+1+1)/7=2.0 -- each still >= 2, so all four are accepted. A
    // fifth gap=1 pushes it to (9+1+2+1+1+1)/8=1.875, below 2 -- premature.
    const s = vrSession('vr-premature-1')
    for (const gap of [1, 2, 1, 1]) {
      expect(deliverAfterGap(s, gap).scheduleFidelity).toBe('on-schedule')
    }
    expect(deliverAfterGap(s, 1).scheduleFidelity).toBe('premature')
  })

  it('rejects a delivery whose hypothetical average would exceed the acceptable range as overrun', () => {
    // A large gap right away drags the hypothetical average above 4:
    // (9+20)/4 = 7.25.
    const s = vrSession('vr-overrun-1')
    expect(deliverAfterGap(s, 20).scheduleFidelity).toBe('overrun')
  })

  it('classifies a fixed ratio in disguise as not-variable instead of on-schedule', () => {
    const s = vrSession('vr-pattern-1', { vrPatternRepeatThreshold: 3 })
    // Two identical gap=3 deliveries both average to exactly 3 and are
    // accepted (fewer than vrPatternRepeatThreshold - 1 = 2 real accepted
    // gaps exist yet at each). A third identical gap=3 would make three
    // identical accepted gaps in a row -- caught as not-variable instead.
    expect(deliverAfterGap(s, 3).scheduleFidelity).toBe('on-schedule')
    expect(deliverAfterGap(s, 3).scheduleFidelity).toBe('on-schedule')
    const third = deliverAfterGap(s, 3)
    expect(third.scheduleFidelity).toBe('not-variable')
    expect(vrCyclesCompleted(s.getSnapshot().events)).toBe(2)
  })

  it("the phantom seed's three 3's alone can never trigger not-variable on early real deliveries", () => {
    const s = vrSession('vr-pattern-seed-1')
    // The very first two real gap=3 deliveries must not be flagged, even
    // though the seed itself is three phantom 3's -- the pattern check only
    // ever looks at *real* accepted gaps.
    expect(deliverAfterGap(s, 3).scheduleFidelity).toBe('on-schedule')
    expect(deliverAfterGap(s, 3).scheduleFidelity).toBe('on-schedule')
  })

  it('does not emit criterion-met, criterion-missed, or cycle-abandoned events for VR', () => {
    // ADR 0010: VR has no discrete "the schedule is now due" instant, so it
    // never uses CRF's single-outstanding-cycle/due-window machinery.
    const s = vrSession('vr-no-criteria-1')
    completeVrCycles(s, 3)
    deliverAfterGap(s, 50) // an overrun attempt too, for good measure
    for (let i = 0; i < 200; i++) s.tick(50) // well past any due window

    expect(
      s
        .getSnapshot()
        .events.some(
          (e) =>
            (e.type === 'criterion-met' && e.schedule === 'VR') ||
            e.type === 'criterion-missed' ||
            e.type === 'cycle-abandoned',
        ),
    ).toBe(false)
  })

  it('rejects vr -> extinction until vrCyclesToComplete on-schedule cycles are done, then allows it', () => {
    const s = vrSession('vr-gate-1', { vrCyclesToComplete: 2 })

    expect(s.startRound('extinction')).toMatchObject({
      reason: 'vr-cycles-not-met',
    })

    completeVrCycles(s, 2)

    expect(vrCyclesCompleted(s.getSnapshot().events)).toBe(2)
    expect(s.startRound('extinction').ok).toBe(true)
    expect(s.getSnapshot().phase).toBe('extinction')
  })

  it('reports coaching as due once vrCoachingPauseMs elapses without meeting vrCyclesToComplete', () => {
    const s = vrSession('vr-coach-1', {
      vrCoachingPauseMs: 500,
      vrCyclesToComplete: 50,
    })
    const resolvedConfig = {
      ...DEFAULT_SIM_CONFIG,
      ...VR_EASY_GATE,
      vrCoachingPauseMs: 500,
      vrCyclesToComplete: 50,
    }
    expect(
      vrCoachingDue(
        s.getSnapshot().events,
        s.getSnapshot().elapsedSimMs,
        resolvedConfig,
      ),
    ).toBe(false)

    for (let i = 0; i < 20; i++) s.tick(50) // 1000ms simulated, past the 500ms pause

    expect(
      vrCoachingDue(
        s.getSnapshot().events,
        s.getSnapshot().elapsedSimMs,
        resolvedConfig,
      ),
    ).toBe(true)
    expect(s.getSnapshot().paused).toBe(true)
    expect(
      s
        .getSnapshot()
        .events.filter(
          (e) =>
            e.type === 'paused' && e.reason === 'coaching' && e.round === 'vr',
        ),
    ).toHaveLength(1)
  })

  it('withholds deliveries in extinction and emits detector-visible eligibility anchors', () => {
    const s = vrSession('extinction-live-anchor', { vrCyclesToComplete: 1 })
    completeVrCycles(s, 1)
    expect(s.startRound('extinction').ok).toBe(true)
    const before = s.getSnapshot()
    expect(s.deliverStimulus('treat')).toMatchObject({ reason: 'wrong-phase' })
    expect(s.getSnapshot()).toBe(before)

    expect(tickUntilNextResponse(s, 50)).toBe(true)
    const events = s.getSnapshot().events
    const response = [...events]
      .reverse()
      .find((e) => e.type === 'response-emitted')
    expect(response?.type).toBe('response-emitted')
    expect(events).toContainEqual({
      type: 'criterion-met',
      at: response?.at,
      responseId:
        response?.type === 'response-emitted' ? response.responseId : '',
      schedule: 'VR',
    })
    expect(events.some((e) => e.type === 'cycle-abandoned')).toBe(false)
  })

  it('finishes from VR by skipping extinction or after its bounded duration', () => {
    const skip = vrSession('finish-skip', { vrCyclesToComplete: 1 })
    expect(skip.finishSession()).toMatchObject({ reason: 'vr-cycles-not-met' })
    completeVrCycles(skip, 1)
    expect(skip.finishSession().ok).toBe(true)
    expect(skip.getSnapshot().phase).toBe('debrief')

    const extinction = vrSession('finish-extinction', {
      vrCyclesToComplete: 1,
      extinctionDurationMs: 500,
    })
    completeVrCycles(extinction, 1)
    expect(extinction.startRound('extinction').ok).toBe(true)
    expect(extinction.finishSession()).toMatchObject({
      reason: 'extinction-not-complete',
    })
    extinction.tick(250)
    extinction.tick(250)
    expect(extinction.finishSession().ok).toBe(true)
    expect(extinction.getSnapshot().phase).toBe('debrief')
  })

  it('excludes premature, overrun, and not-variable deliveries from vrCyclesCompleted', () => {
    const s = vrSession('vr-incomplete-1', { vrCyclesToComplete: 0 })
    expect(deliverAfterGap(s, 20).scheduleFidelity).toBe('overrun')
    expect(vrCyclesCompleted(s.getSnapshot().events)).toBe(0)
    expect(s.startRound('extinction').ok).toBe(true)
  })

  it("the live schedulePlan's runningAverage and acceptedGaps track deriveVrScheduleState from the log", () => {
    const s = vrSession('vr-derive-1', { vrCyclesToComplete: 3 })
    completeVrCycles(s, 3)
    const resolvedConfig = { ...DEFAULT_SIM_CONFIG, ...VR_EASY_GATE }
    const derived = deriveVrScheduleState(
      s.getSnapshot().events,
      resolvedConfig,
    )
    expect(s.getSnapshot().schedulePlan).toMatchObject({
      acceptedGaps: derived.acceptedGaps,
      runningAverage: derived.runningAverage,
    })
    expect(derived.acceptedGaps).toEqual([2, 4, 3])
  })

  it('completes the required assessment -> baseline -> CRF -> VR path in one live session', () => {
    const s = vrSession('vr-integration-1', { vrCyclesToComplete: 2 })
    expect(s.getSnapshot().phase).toBe('vr')
    expect(s.getSnapshot().assessment.complete).toBe(true)

    completeVrCycles(s, 2)
    expect(s.startRound('extinction').ok).toBe(true)
    expect(s.getSnapshot().phase).toBe('extinction')

    // The replayed log agrees with live play end to end (ADR 0001). This
    // session used a non-default config, so the same overrides must be
    // passed here too (ADR 0009: an overridden log is never silently
    // reinterpreted under the current defaults).
    const replayed = replay(s.getSnapshot().seed, s.getSnapshot().events, {
      ...VR_EASY_GATE,
      vrCyclesToComplete: 2,
    })
    expect(replayed.ok).toBe(true)
    if (replayed.ok) {
      expect(replayed.state.phase).toBe('extinction')
      expect(replayed.state.creature).toEqual(s.getSnapshot().creature)
    }
  })
})
