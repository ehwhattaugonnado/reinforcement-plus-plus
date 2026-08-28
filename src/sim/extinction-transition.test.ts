import { describe, expect, it } from 'vitest'
import { CONFIG_VERSION, DEFAULT_SIM_CONFIG, type SimConfig } from './config'
import type { Phase, SimEvent } from './events'
import { detectExtinctionBurst, type BurstDetectionResult } from './evidence'
import { createInitialState } from './initial-state'
import { meanInterarrivalMs } from './learning'
import { applyEvent } from './project'
import { createRng, type Rng } from './rng'
import type { SessionState } from './types'

/**
 * Resolution for the roadmap's "Extinction-transition state" checkpoint
 * (docs/roadmap.md section 6, data-model.md section 4). An earlier version
 * of this file found that the M3 learning model's recency-decay term alone
 * never produces a genuine transient increase after reinforcement stops --
 * only a smooth decline -- while the burst detector (evidence.ts) still read
 * low-count sampling noise as a "burst" in roughly 30% of seeds at default
 * config, because detection/reference windows sized for the model's default
 * 2-4/min baseline rate can contain as few as one or two discrete responses.
 *
 * That gap is now closed on both sides:
 *  - `learning.ts`'s `computeResponseRatePerMinute` has a genuine, seeded
 *    extinction-transition burst term (`initial-state.ts` seeds
 *    `extinctionBurstPrimed`/`extinctionBurstMagnitudeScale` once per
 *    creature; the term is zero unless both `phase === 'extinction'` and the
 *    creature is primed).
 *  - `evidence.ts`'s `detectExtinctionBurst` requires
 *    `config.burstMinReferenceResponses`/`burstMinDetectionResponses`
 *    (separate floors -- see their doc comments in config.ts for why),
 *    returning `indeterminate`/`insufficient-samples` below either floor
 *    instead of guessing from noise.
 *  - An initial fix (a 30s detection window, matching the original
 *    unmodified detector) cut the unprimed false-burst rate from ~28% to
 *    ~4%, but pushed ~65-70% of ALL live runs -- primed and unprimed alike
 *    -- into `indeterminate`, because the model's default 2-4/min rates
 *    rarely produce `burstMinDetectionResponses` (6) in 30s. That nearly
 *    eliminated the documented honest-negative debrief message ("no burst
 *    occurred, bursts are not inevitable") as a live outcome, not just the
 *    false positives. Widening `burstDetectionWindowMs` to 90s and moving
 *    `extinctionBurstPeakDelayMs` to sit mid-window (see both constants'
 *    doc comments in config.ts for the full measured tradeoffs) fixed
 *    that too: at current defaults, over a 150-seed cohort, primed burst
 *    detection is ~61%, unprimed false-burst is ~10% (up slightly from
 *    ~4%, but still far below the original ~28-30%), and both burst AND
 *    no-burst-in-this-run are now common, reachable live outcomes -- see
 *    the "reports a healthy live mix..." and "reports a burst for primed
 *    creatures far more often..." tests below for the measured bounds.
 *
 * Unlike evidence.test.ts, this file does not hand-construct the event log.
 * It drives the real projector (`applyEvent`, project.ts) and the real
 * response-generation process session.ts's `tick` uses (seeded exponential
 * inter-response draws against `state.creature.targetBehavior.currentRatePerMinute`,
 * which `applyEvent` recomputes from the log via `learning.ts` after every
 * event), then feeds the resulting log into the real, unmodified
 * `detectExtinctionBurst` (evidence.ts).
 *
 * One necessary scripting concession: CRF/VR cycle and delivery
 * classification (Milestone 4/5's real gating) is exercised elsewhere
 * (crf.test.ts, session.test.ts); this driver only needs *a* reinforced
 * history followed by withheld criteria, so it appends a real
 * response-contingent, prompt `stimulus-delivered` event after each response
 * during a "reinforced" span (the strongest-learning case per
 * `deliveryGain`), and during the "extinction" span a `criterion-met` for
 * each response with no matching delivery (a withheld criterion), which is
 * exactly what `detectExtinctionBurst`'s anchor (`firstWithheldCriterionAt`)
 * requires. Every rate/strength/priming/value number that follows is
 * computed by the production model, not asserted by hand.
 */

const BASELINE_MS = DEFAULT_SIM_CONFIG.baselineDurationMs // 45000
const REINFORCED_ROUND_MS = 90000 // > burstReferenceWindowMs (60000)
const EXTINCTION_MS = 150000

type Seq = { n: number }

function driveResponses(
  state: SessionState,
  events: SimEvent[],
  fromMs: number,
  toMs: number,
  responseRng: Rng,
  config: SimConfig,
  reinforced: boolean,
  seq: Seq,
): SessionState {
  let nextDueMs =
    fromMs +
    responseRng.nextExponential(
      meanInterarrivalMs(state.creature.targetBehavior.currentRatePerMinute),
    )

  while (nextDueMs <= toMs) {
    const responseEvent: SimEvent = {
      type: 'response-emitted',
      at: nextDueMs,
      responseId: `response-${++seq.n}`,
    }
    state = applyEvent(state, responseEvent, config)
    events.push(responseEvent)

    if (reinforced) {
      const stimulusId = state.creature.stimuli[0]!.stimulusId
      const deliveryEvent: SimEvent = {
        type: 'stimulus-delivered',
        at: nextDueMs,
        stimulusId,
        responseId: responseEvent.responseId,
        latencyMs: 0,
        contingency: 'response-contingent',
        timing: 'prompt',
        scheduleFidelity: 'on-schedule',
        schedule: 'VR',
      }
      state = applyEvent(state, deliveryEvent, config)
      events.push(deliveryEvent)
    } else {
      // Extinction: the response would have met the outstanding criterion,
      // but reinforcement is withheld. This is exactly the shape
      // `firstWithheldCriterionAt` (evidence.ts) looks for.
      const criterionEvent: SimEvent = {
        type: 'criterion-met',
        at: nextDueMs,
        responseId: responseEvent.responseId,
        schedule: 'VR',
      }
      state = applyEvent(state, criterionEvent, config)
      events.push(criterionEvent)
    }

    const rate = state.creature.targetBehavior.currentRatePerMinute
    nextDueMs += responseRng.nextExponential(meanInterarrivalMs(rate))
  }

  return state
}

/**
 * Runs one full seeded session: baseline -> crf (reinforced) -> vr
 * (reinforced) -> extinction (unreinforced), all through the real
 * projector, and returns the resulting log plus the real burst-detection
 * verdict on it.
 */
function runExtinctionRound(
  seed: string,
  config: SimConfig = DEFAULT_SIM_CONFIG,
): { events: SimEvent[]; result: BurstDetectionResult; primed: boolean } {
  const responseRng = createRng(seed, 'responses')
  let state = createInitialState(seed, 1, config)
  const primed = state.creature.targetBehavior.extinctionBurstPrimed
  const events: SimEvent[] = []
  const seq: Seq = { n: 0 }

  function pushPhase(at: number, phase: Phase) {
    const e: SimEvent = { type: 'phase-changed', at, phase }
    state = applyEvent(state, e, config)
    events.push(e)
  }

  const started: SimEvent = {
    type: 'session-started',
    at: 0,
    seed,
    speed: 1,
    configVersion: CONFIG_VERSION,
  }
  state = applyEvent(state, started, config)
  events.push(started)

  let t = 0
  pushPhase(t, 'baseline')
  state = driveResponses(
    state,
    events,
    t,
    t + BASELINE_MS,
    responseRng,
    config,
    false,
    seq,
  )
  t += BASELINE_MS

  pushPhase(t, 'crf')
  state = driveResponses(
    state,
    events,
    t,
    t + REINFORCED_ROUND_MS,
    responseRng,
    config,
    true,
    seq,
  )
  t += REINFORCED_ROUND_MS

  pushPhase(t, 'vr')
  state = driveResponses(
    state,
    events,
    t,
    t + REINFORCED_ROUND_MS,
    responseRng,
    config,
    true,
    seq,
  )
  t += REINFORCED_ROUND_MS

  pushPhase(t, 'extinction')
  state = driveResponses(
    state,
    events,
    t,
    t + EXTINCTION_MS,
    responseRng,
    config,
    false,
    seq,
  )

  const result = detectExtinctionBurst(events, config)
  return { events, result, primed }
}

describe('extinction transition: live model output fed into the real burst detector', () => {
  const SEEDS = Array.from({ length: 150 }, (_, i) => `extinction-cohort-${i}`)

  it('reports a burst for primed creatures far more often than for unprimed ones (the burst term is a real, dominant causal effect, not noise dressed up)', () => {
    // NOT a hard zero for unprimed: `burstMinDetectionResponses` (evidence.ts)
    // narrows but cannot eliminate sampling noise at this model's default
    // 2-4/min baseline rates against a fixed 30s detection window -- an
    // occasional cluster of closely-spaced responses can still cross the
    // burst thresholds by chance even with no transient term at all. What
    // this fix guarantees is a strong, causal *gap* between the two groups
    // -- see the KNOWN LIMITATION test below for what raising the floor
    // costs elsewhere.
    let primedCount = 0
    let primedBurstCount = 0
    let unprimedCount = 0
    let unprimedBurstCount = 0
    for (const seed of SEEDS) {
      const { result, primed } = runExtinctionRound(seed)
      if (primed) {
        primedCount++
        if (result.kind === 'burst') primedBurstCount++
      } else {
        unprimedCount++
        if (result.kind === 'burst') unprimedBurstCount++
      }
    }
    expect(primedCount).toBeGreaterThan(0) // sanity: the cohort has both groups
    expect(unprimedCount).toBeGreaterThan(0)

    const primedBurstRate = primedBurstCount / primedCount
    const unprimedBurstRate = unprimedBurstCount / unprimedCount
    expect(primedBurstRate).toBeGreaterThan(0.5)
    expect(unprimedBurstRate).toBeLessThan(0.35)
    expect(primedBurstRate).toBeGreaterThan(unprimedBurstRate * 1.5)
  })

  it('reports a healthy live mix of burst, no-burst-in-this-run, and indeterminate -- the honest-negative verdict is a real, reachable outcome, not a rarity', () => {
    // `burstDetectionWindowMs` was originally 30s: at the model's default
    // 2-4/min baseline rates, that made `burstMinDetectionResponses` (6)
    // nearly unreachable, so ~65-70% of live runs landed `indeterminate`
    // and the documented "no burst occurred, bursts are not inevitable"
    // debrief message (data-model.md section 5) was almost never the live
    // outcome even though evidence.test.ts's hand-constructed-log coverage
    // made it look exercised. Widening the window to 90s and moving
    // `extinctionBurstPeakDelayMs` to sit mid-window (see both constants'
    // doc comments in config.ts for the full measured tradeoffs) fixed
    // this: `indeterminate` is now a real minority, and `no-burst-in-this-run`
    // is common enough to be the typical outcome for an unprimed creature.
    let indeterminateCount = 0
    let noBurstCount = 0
    for (const seed of SEEDS) {
      const { result } = runExtinctionRound(seed)
      if (result.kind === 'indeterminate') indeterminateCount++
      else if (result.kind === 'no-burst-in-this-run') noBurstCount++
    }
    expect(indeterminateCount / SEEDS.length).toBeLessThan(0.4)
    expect(noBurstCount / SEEDS.length).toBeGreaterThan(0.2)
  })

  it('every primed seed lands in burst, no-burst-in-this-run, or indeterminate -- never not-evaluable', () => {
    let primedCount = 0
    let accounted = 0
    for (const seed of SEEDS) {
      const { result, primed } = runExtinctionRound(seed)
      if (!primed) continue
      primedCount++
      if (
        result.kind === 'burst' ||
        result.kind === 'no-burst-in-this-run' ||
        result.kind === 'indeterminate'
      )
        accounted++
    }
    expect(primedCount).toBeGreaterThan(0)
    expect(accounted).toBe(primedCount)
  })

  it('shows the response rate declining, not spiking, for an unprimed creature (known no-burst seed)', () => {
    // Documented known no-burst seed (M6 exit gate: docs/roadmap.md
    // Milestone 6). `extinction-cohort-1` is unprimed at the default
    // extinctionBurstProbability (0.5) and default seed derivation, and
    // clears both sample-count floors -- the honest-negative debrief
    // message ("no burst occurred in this run, bursts are not inevitable")
    // is reachable live, not just from a hand-constructed log.
    const { result, primed } = runExtinctionRound('extinction-cohort-1')
    expect(primed).toBe(false)
    expect(result.kind).toBe('no-burst-in-this-run')
    if (result.kind !== 'no-burst-in-this-run') throw new Error('unreachable')
    expect(result.comparison.observed.perMinute).toBeLessThanOrEqual(
      result.comparison.reference.perMinute * 1.5,
    )
  })

  it('reports indeterminate, not a guessed verdict, for an unprimed creature whose windows are still too thin to characterize (known indeterminate seed)', () => {
    // Documented known seed (M6 exit gate: docs/roadmap.md Milestone 6).
    // `extinction-cohort-2` is unprimed at the default
    // extinctionBurstProbability (0.5) and default seed derivation. Even
    // after widening the detection window, some live sessions still don't
    // clear both sample-count floors -- this remains a real, honest
    // outcome, just no longer the typical one (see the "healthy live mix"
    // test above).
    const { result, primed } = runExtinctionRound('extinction-cohort-2')
    expect(primed).toBe(false)
    expect(result.kind).toBe('indeterminate')
    if (result.kind !== 'indeterminate') throw new Error('unreachable')
    expect(result.reason).toBe('insufficient-samples')
  })

  it('shows the response rate rising through the detection window for a primed creature (known burst seed)', () => {
    // Documented known burst seed (M6 exit gate: docs/roadmap.md
    // Milestone 6). `extinction-cohort-5` is primed at the default
    // extinctionBurstProbability (0.5) and default seed derivation.
    const { result, primed } = runExtinctionRound('extinction-cohort-5')
    expect(primed).toBe(true)
    expect(result.kind).toBe('burst')
    if (result.kind !== 'burst') throw new Error('unreachable')
    expect(result.comparison.observed.perMinute).toBeGreaterThan(
      result.comparison.reference.perMinute,
    )
  })
})
