# Simulation Data Model

See also: [Architecture Overview](overview.md) · [Core Loop](../core-loop.md) ·
[ADR 0001](../adr/0001-event-sourced-session-state.md) ·
[ADR 0003](../adr/0003-eligibility-vs-experienced-consequences-invariant.md) ·
[ABA Concept Glossary](../aba-glossary.md)

## 1. Intended versus experienced contingencies

The most important simulation invariant is:

> The selected schedule controls reinforcement eligibility; only experienced
> consequences influence subsequent creature behavior.

Selecting VR must not, by itself, create a high steady response rate. If a
player implements VR as CRF, misses eligible responses, delivers the stimulus
late, or delivers it without a response, the learner model uses those actual
events. The debrief compares them with the intended policy. Rationale:
[ADR 0003](../adr/0003-eligibility-vs-experienced-consequences-invariant.md).

## 2. Session state

```ts
type SessionState = {
  id: string
  seed: string
  phase: 'assessment' | 'baseline' | 'crf' | 'vr' | 'extinction' | 'debrief'
  elapsedSimMs: number
  speed: 0.5 | 1
  paused: boolean
  creature: CreatureState
  assessment: AssessmentState
  schedulePlan: SchedulePlan | null
  events: SimEvent[]
}

type CreatureState = {
  id: string
  name: string
  moodState: 'content' | 'neutral' | 'disinterested' | 'frustrated'
  stimuli: Array<{
    stimulusId: string
    basePreference: number
    currentValue: number
  }>
  targetBehavior: {
    behaviorId: string
    baselineRatePerMinute: number
    learnedStrength: number
    currentRatePerMinute: number
  }
}

type SchedulePlan =
  | { type: 'CRF'; responsesRequired: 1 }
  | {
      type: 'VR'
      meanRatio: 3
      currentRequirement: number
      responsesSinceReinforcement: number
      generatedRequirements: number[]
    }
```

The v1 runtime types contain only CRF and VR. Future schedule types should not
appear in active unions until their rules are implemented.

## 3. Event log

The event log is append-only and is the source for graphs, the data table,
summary statistics, debrief text, and deterministic replay. See
[ADR 0001](../adr/0001-event-sourced-session-state.md).

At minimum it distinguishes:

```ts
type SimEvent =
  | { type: 'session-started'; at: 0; seed: string; speed: 0.5 | 1; configVersion: string }
  | { type: 'paused'; at: number }
  | { type: 'resumed'; at: number }
  | { type: 'speed-changed'; at: number; speed: 0.5 | 1 }
  | { type: 'pair-presented'; at: number; leftId: string; rightId: string }
  | { type: 'creature-selected'; at: number; stimulusId: string | null }
  | { type: 'selection-recorded'; at: number; stimulusId: string | null }
  | { type: 'response-emitted'; at: number; responseId: string }
  | { type: 'criterion-met'; at: number; responseId: string; schedule: 'CRF' | 'VR' }
  | {
      type: 'stimulus-delivered'
      at: number
      stimulusId: string
      responseId: string | null
      latencyMs: number | null
      contingency: 'response-contingent' | 'noncontingent'
      timing: 'prompt' | 'delayed' | 'no-response'
      scheduleFidelity: 'on-schedule' | 'premature' | 'overrun' | 'not-applicable'
    }
  | { type: 'criterion-missed'; at: number; responseId: string }
  | { type: 'cycle-abandoned'; at: number; reason: 'due-window-elapsed' | 'round-ended' }
  | { type: 'phase-changed'; at: number; phase: SessionState['phase'] }
```

`session-started`, `paused`, `resumed`, and `speed-changed` exist so that seed
plus event log is sufficient for replay and so that Section 5 can exclude
paused time without consulting a second data path. Every public command that
changes clock behavior appends an event; `setPaused` and `setSpeed` are not
exceptions. `configVersion` identifies the `SimConfig` constants (Section 6) a
log was produced under, so an old log is never silently reinterpreted under
new thresholds.

The creature's choice for a presented pair (Core Loop, Phase A) is decided in
the command handler, drawing only from the seeded behavior RNG, and is written
into `creature-selected.stimulusId` (`null` for a no-selection trial). The
brief, equal post-selection access and its bounded satiation effect are a pure
function of that event and `SimConfig`, so the projector folds them from
`creature-selected` alone; replay never re-runs the choice model or draws
randomness.

An active response has a default prompt-delivery window of 1,500 simulated
milliseconds (`promptDeliveryWindowMs`). The window is fixed in simulated time
and is not additionally scaled by the speed setting: at 0.5x speed those 1,500
simulated milliseconds already occupy 3,000 wall-clock milliseconds, which is
what the accessibility requirement in [Accessibility](../accessibility.md)
asks for. Scaling it a second time would make prompt-delivery rate easier at
0.5x and break comparability across speeds. See
[ADR 0005](../adr/0005-speed-as-simulation-input.md). A delivery after that
window may still be response-contingent, but its timing is classified as
delayed. A delivery with no associated target response is noncontingent.
Timing, contingency, and schedule fidelity remain independent dimensions.
Exact thresholds are configuration values, not scattered UI constants.

## 4. Response generation and learning

Behavior is modeled as a free-operant event process, not as a frame-by-frame
boolean. The sim uses a response hazard/rate and computes event timing in a
way that is invariant to render frequency. A browser running at 30 Hz and one
running at 120 Hz must not produce systematically different behavior.

The current response rate is a function of:

- Baseline rate and learned strength.
- The history, contingency, and latency of actual stimulus deliveries.
- The delivered stimulus's current value.
- Time since the last experienced consequence.
- Optional extinction-transition state.
- Small seeded variability.

The selected schedule type is intentionally absent from this list. Its effects
emerge through the delivery history it arranges.

**Implementation (Milestone 3, `src/sim/learning.ts`).** `session.ts`'s `tick`
draws the next response's simulated-time due instant from an exponential
interarrival distribution (`rng.nextExponential(meanInterarrivalMs(rate))`),
using a namespaced RNG stream (`createRng(seed, 'responses')`) kept separate
from `behaviorRng` so a later draw elsewhere in the same tick cannot shift the
response-timestamp sequence. The rate used for each draw is always the rate
computed *at the moment of the previous response* (or session start for the
first draw), never a value sampled at a tick boundary; because ticks only
decide which already-scheduled instants fall in `[windowStart, windowEnd)`,
the resulting event sequence is exactly (bit-identical) render-frequency
invariant.

`project.ts`'s `applyBehavioralEvent` re-derives, from the event log
(including the event being folded) rather than incrementally, on every
`response-emitted` and `stimulus-delivered` event:

- **Learned strength** — accumulates from `0`, clamped to `[0, 1]`, by a
  per-delivery gain that depends only on that delivery's `contingency` and
  `timing`: `learnedStrengthGainPromptContingent` >
  `learnedStrengthGainDelayedContingent` >
  `learnedStrengthGainNoncontingent`.
- **Stimulus `currentValue`** — starts at `basePreference`; each delivery of
  that stimulus multiplies it by `(1 - satiationDecayFraction)`, floored at
  `stimulusValueFloor`; between deliveries it recovers exponentially (time
  constant `satiationRecoveryTimeConstantMs`) toward a ceiling of
  `basePreference * satiationRecoveryCeilingFraction`, strictly below full
  restoration, so recovery is bounded even given unlimited open-tab time.
- **Current response rate** — `baselineRatePerMinute` alone until the first
  experienced consequence; afterward,
  `baselineRatePerMinute + learnedStrength * influence * stimulusValue *
  learningRateGainPerMinute + extinctionBurst`, where `influence =
  exp(-timeSinceLastConsequenceMs / responseRateConsequenceDecayMs)`,
  `stimulusValue` is the *most recently delivered* stimulus's current value at
  that instant, and `extinctionBurst` (Milestone 6) is zero unless the
  current phase is `extinction` and the creature was seeded (once, at session
  creation) as primed for a transient. When both hold, `extinctionBurst`
  rises from zero at the moment reinforcement stops to a peak of
  `extinctionBurstMagnitudeGainPerMinute * learnedStrength * stimulusValue *
  extinctionBurstMagnitudeScale` at `extinctionBurstPeakDelayMs` after
  cessation, then decays — never a step function. `extinctionBurstMagnitudeScale`
  is a seeded `[0.5, 1.5]` per-creature multiplier, so primed creatures don't
  all burst identically. Whole rate is clamped to
  `[responseRateFloorPerMinute, responseRateCeilingPerMinute]`.

None of the above ever reads `SchedulePlan`; `applyBehavioralEvent` has a
dedicated Vitest suite ("the central causal invariant") asserting that
folding an identical `stimulus-delivered` event onto two states that differ
only in `schedulePlan` produces identical `creature` output. `phase`
(baseline/crf/vr/extinction) is a distinct, intentional input — which round
is running, not the learner's selected schedule type — and is itself derived
from logged `phase-changed` events, so `computeResponseRatePerMinute` remains
a pure function of the event log plus config.

Repeated access gradually reduces a stimulus's `currentValue`. Limited
recovery may occur while the app remains open, bounded by
`satiationRecoveryCeilingFraction` as above. Because v1 has no persistence,
claims about recovery across visits are out of scope. Each new session instead
seeds a new initial motivating condition.

**Baseline round (Round 0).** The free-operant response process runs
identically in `baseline`, `crf`, `vr`, and `extinction` — baseline is not a
special case of the model, only of what the UI does with it. The baseline
*window* is derived from the event log (`baselineWindow`, `src/sim/
learning.ts`): from the last `phase-changed` into `baseline` to the earlier
of `baselineDurationMs` later or the next `phase-changed` away from it, so a
learner who leaves early or lingers doesn't skew the metric.
`isBaselineComplete` is a derived boolean (`elapsedSimMs - baselineStart >=
baselineDurationMs`) that a screen can use to offer moving on; it does not
itself end the round, change phase, or emit an event — the explicit stimulus
choice and `startRound('crf')` command still gate advancement, per the core
loop. `baselineResponseRatePerMinute` (responses observed in that window ÷
observed simulated time in that window) is the *event-derived* baseline rate
used by later milestones' gates (Section 5); it is deliberately distinct from
the seeded latent `creature.targetBehavior.baselineRatePerMinute`, which is
an internal model input, not a claim about what was observed.

Extinction transitions are parameterized and seeded. `initial-state.ts` draws
`extinctionBurstPrimed` once per creature against `extinctionBurstProbability`
(default `0.5`, a simulation-tuning knob, not a claimed clinical prevalence)
and a `[0.5, 1.5]` `extinctionBurstMagnitudeScale`; `learning.ts` reads both
only when folding an event with `phase === 'extinction'`. The event-derived
detector (`evidence.ts`) never sees either seeded field — it classifies
burst/no-burst purely from the resulting `response-emitted` events, per the
"no narrative burst flag" rule. Documented known seeds: `extinction-cohort-5`
(primed, produces a `burst` verdict), `extinction-cohort-1` (unprimed,
produces `no-burst-in-this-run`), and `extinction-cohort-2` (unprimed,
produces `indeterminate`/`insufficient-samples` — the honest "too short to
characterize" outcome, a real but no longer typical live result) — see
`extinction-transition.test.ts`, which drives the real model and detector
rather than hand-constructing a log.

## 5. Derived metrics

Summary functions calculate metrics from events rather than maintaining a
second mutable data path:

- **Assessment recording accuracy:** recorded selections matching creature
  selections divided by completed assessment trials.
- **Contingent-delivery rate:** response-contingent deliveries divided by all
  deliveries.
- **Prompt-delivery rate:** prompt deliveries divided by all
  response-contingent deliveries.
- **Schedule fidelity:** correctly completed schedule cycles divided by all
  completed or abandoned cycles. A correct cycle has no premature or
  noncontingent delivery and is completed promptly after the first response
  that meets its criterion. A cycle is *completed* when a delivery ends it. A
  cycle is *abandoned* when its criterion was met and the due window elapsed
  without a delivery, or when a round or phase ends while reinforcement is
  due. Exactly one `cycle-abandoned` event marks each such cycle and it is the
  only event the denominator counts; the `criterion-missed` emitted alongside a
  due-window timeout is diagnostic detail for coaching and the debrief and must
  never be summed into the same denominator. A cycle whose criterion was never
  met when the round ended is *incomplete* and is excluded from both numerator
  and denominator, so ending a round mid-ratio neither rewards nor penalizes
  the learner.
- **Response rate by phase/window:** response events divided by observed
  simulated time, excluding pauses.

For v1, a stimulus has evidence of functioning as a reinforcer only when it
has at least `reinforcerEvidenceMinDeliveries` prompt, contingent deliveries
and the target response rate in the final `reinforcerEvidenceWindowMs` of CRF
exceeds the baseline rate by at least both `reinforcerEvidenceRelativeIncrease`
and `reinforcerEvidenceAbsoluteIncrease`. Both sides of that comparison are
responses per minute derived from observed simulated time, so the unequal
45-second baseline and 60-second CRF windows are compared correctly; the
windows differ because the baseline is kept short and the CRF window is sized
to smooth a low-rate free-operant process. These are transparent simulation
thresholds, not a clinical rule. If the threshold is not met, the debrief says
the stimulus "did not demonstrate a reinforcing effect in this short
simulation" rather than asserting that it cannot function as a reinforcer.

**Extinction-burst detection.** A burst is reported only when, within
`burstDetectionWindowMs` of the first withheld criterion, the response rate is
at least `burstRelativeIncrease` above and at least `burstAbsoluteIncrease`
per minute above the reference rate. The reference is the response rate over
the final `min(reinforcedRoundDurationMs, burstReferenceWindowMs)` of the
reinforced round immediately preceding extinction, measured within that round
only and never bleeding into an earlier round. V1 permits entering extinction
from VR only, so that round is always Round 2. If the available reference
window is shorter than `burstMinReferenceWindowMs`, the reference rate is too
noisy to compare against and the run is reported `indeterminate` with reason
`reference-window-too-short`. Independently, both the reference and detection
windows must also contain at least their respective sample-count floor
(`burstMinReferenceResponses`/`burstMinDetectionResponses` — separate
because the two windows differ in duration and typical count) responses;
otherwise the run is `indeterminate` with reason `insufficient-samples` —
a duration floor alone does not stop a single extra (or missing) Poisson
arrival from swinging a low-count window's rate across the burst thresholds
on sampling noise alone. Either indeterminate reason means the run is neither
a burst nor a confirmed no-burst: the debrief says the demonstration was too
short to characterize and states that bursts are not inevitable. The rule is
evaluated from the event log after the round, exactly like every other
derived metric; the extinction model is never asked whether it "intended" a
burst, and the detector never reads the seeded `extinctionBurstPrimed`/
`extinctionBurstMagnitudeScale` fields that produced the model's actual
output. When the rule is not met, the debrief states explicitly that no burst
occurred in this run and that bursts are not inevitable.

## 6. Configuration constants

Every threshold above is a named field of a single `SimConfig` object owned by
the simulation core, not a literal scattered through rules or UI. Tests
override it explicitly; the UI never reads or writes it. `configVersion` is
stamped into `session-started`.

| Constant | v1 default | Used by |
|---|---|---|
| `assessmentChoiceSensitivity` | 4 | Paired-stimulus choice model (Core Loop, Phase A) |
| `assessmentNoSelectionScale` | 0.15 | Paired-stimulus choice model (Core Loop, Phase A) |
| `assessmentSatiationPerAccess` | 0.05 | Bounded post-selection satiation (Core Loop, Phase A) |
| `assessmentSatiationFloorFraction` | 0.85 | Bounded post-selection satiation (Core Loop, Phase A) |
| `promptDeliveryWindowMs` | 1500 simulated ms | Delivery timing classification (3) |
| `reinforcementDueWindowMs` | 10000 simulated ms | Criterion-missed and cycle abandonment (Core Loop, 5) |
| `baselineDurationMs` | 45000 simulated ms | Round 0 |
| `crfMinOnScheduleDeliveries` | 8 | Round 1 advance gate |
| `crfAcquisitionRelativeIncrease` | 0.25 | Round 1 advance gate |
| `crfAcquisitionAbsoluteIncrease` | 1.5 responses/min | Round 1 advance gate |
| `crfAcquisitionWindowMs` | 30000 simulated ms | Round 1 advance gate |
| `crfCoachingPauseMs` | 180000 simulated ms | Round 1 coaching pause |
| `vrMeanRatio` | 3 | Schedule policy |
| `vrRequirementBlock` | [2, 3, 4] | Schedule policy |
| `vrCyclesToComplete` | 6 | Round 2 completion |
| `vrCoachingPauseMs` | 240000 simulated ms | Round 2 coaching pause |
| `reinforcerEvidenceMinDeliveries` | 6 | Reinforcer-evidence rule |
| `reinforcerEvidenceWindowMs` | 60000 simulated ms | Reinforcer-evidence rule |
| `reinforcerEvidenceRelativeIncrease` | 0.20 | Reinforcer-evidence rule |
| `reinforcerEvidenceAbsoluteIncrease` | 1.0 responses/min | Reinforcer-evidence rule |
| `burstDetectionWindowMs` | 90000 simulated ms | Burst detection |
| `burstReferenceWindowMs` | 60000 simulated ms | Burst detection |
| `burstMinReferenceWindowMs` | 20000 simulated ms | Burst detection floor |
| `burstRelativeIncrease` | 0.50 | Burst detection |
| `burstAbsoluteIncrease` | 2.0 responses/min | Burst detection |
| `burstMinReferenceResponses` | 3 | Burst detection reference-window sample-count floor |
| `burstMinDetectionResponses` | 6 | Burst detection detection-window sample-count floor |
| `extinctionBurstProbability` | 0.5 | Extinction-transition seeding (Section 4) |
| `extinctionBurstMagnitudeGainPerMinute` | 20 responses/min | Extinction-transition seeding (Section 4) |
| `extinctionBurstPeakDelayMs` | 35000 simulated ms | Extinction-transition seeding (Section 4) |
| `maxTickDeltaMs` | 250 wall-clock ms | Clock delta capping (see [Architecture Overview](overview.md)) |
| `responseRateConsequenceDecayMs` | 20000 simulated ms | Response-rate decay toward baseline (Section 4) |
| `learningRateGainPerMinute` | 6 responses/min | Response-rate model (Section 4) |
| `learnedStrengthGainPromptContingent` | 0.18 | Learned-strength accumulation (Section 4) |
| `learnedStrengthGainDelayedContingent` | 0.06 | Learned-strength accumulation (Section 4) |
| `learnedStrengthGainNoncontingent` | 0.02 | Learned-strength accumulation (Section 4) |
| `responseRateFloorPerMinute` | 0.5 responses/min | Response-rate model floor (Section 4) |
| `responseRateCeilingPerMinute` | 20 responses/min | Response-rate model ceiling (Section 4) |
| `satiationDecayFraction` | 0.12 | Stimulus-value decay per delivery (Section 4) |
| `satiationRecoveryTimeConstantMs` | 15000 simulated ms | Stimulus-value recovery rate (Section 4) |
| `satiationRecoveryCeilingFraction` | 0.92 | Stimulus-value recovery bound (Section 4) |
| `stimulusValueFloor` | 0.05 | Stimulus-value decay floor (Section 4) |

The acquisition gate (`crfAcquisition*`) is intentionally a shorter, stricter
window than the reinforcer-evidence rule (`reinforcerEvidence*`): the first
decides whether the response is established enough to thin the schedule, the
second decides what the debrief is entitled to claim.

`reinforcementDueWindowMs` is the constant most likely to need retuning once a
playable sim exists. Because it also feeds the fidelity denominator during CRF,
a value that is too short makes schedule fidelity read near zero for a learner
who is merely unhurried rather than incorrect. Check it against the
[Accessibility](../accessibility.md) expectation that the slower speed setting
carries no scoring penalty, and revisit it during learner testing.
