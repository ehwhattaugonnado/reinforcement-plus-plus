# Design Spec: Reinforcement & Preference Assessment Teaching Game

**Status:** Approved for implementation planning
**Date:** 2026-08-25
**Last revised:** 2026-08-25
**Repo:** https://github.com/ehwhattaugonnado/reinforcement-plus-plus

## 1. Concept Summary

A small, browser-based pet-training simulator that teaches core ABA
principles (preference assessment, reinforcement, and schedules of
reinforcement) through direct interaction with a virtual creature. One
underlying simulation supports caregivers, support staff, and RBT trainees
through a Simple/Advanced mode toggle rather than separate builds.

**Tone:** cute, wholesome, and low-stakes. There are no punishment mechanics
or fail states, only more or less effective training followed by constructive
feedback.

**Session length:** 10-20 minutes. The required path (assessment, 45-second
baseline, CRF, VR, debrief) budgets to roughly 10-13 minutes at 1x speed; the
upper end of the range assumes the optional extinction round, coaching pauses,
or unhurried reading.

## 2. Learning Objectives and Educational Boundaries

By the end of one session, a learner should be able to:

1. Conduct and interpret a small paired-stimulus preference assessment.
2. Distinguish a preferred stimulus (a candidate or putative reinforcer) from
   a reinforcer whose effect has been demonstrated by an increase in future
   behavior.
3. Explain why reinforcement should be contingent on a response and delivered
   promptly.
4. Implement the simulation's teaching progression: continuous reinforcement
   (CRF/FR-1) during initial acquisition followed by a variable-ratio schedule
   after the response is established.
5. Compare an intended reinforcement schedule with the schedule that was
   actually implemented.
6. Describe satiation as one variable that can temporarily change a
   stimulus's effectiveness.
7. Explain that extinction can have several transitional effects, that an
   extinction burst may occur, and that a burst is not inevitable.

This is a deliberately simplified educational simulation. It is not clinical
decision support, a treatment protocol, a substitute for competency-based
training or supervision, or authorization to implement extinction with a
person. The debrief and onboarding state these boundaries explicitly. Content
must receive review from a qualified behavior-analytic subject-matter expert
before public release.

## 3. Audience and Mode Design

| Mode | Audience | Language | Data shown |
|---|---|---|---|
| Simple | Caregivers and support staff new to ABA | Plain language ("reward right after," "sometimes reward") | Creature state, simple progress, concise coaching |
| Advanced | RBT trainees and BCBA-adjacent staff | ABA terminology (CRF/FR-1, VR, MO, EO/AO, procedural fidelity, extinction effects) | Cumulative record, response-rate summary, event log, technical debrief |

Mode is a UI-layer toggle only. Both modes run the exact same simulation and
use the same session event history; only labels, explanations, and exposed
detail change. A learner can switch modes during a session without resetting
or changing the simulation.

The tool is standalone, so essential explanations are part of the flow rather
than being confined to optional tooltips. Tooltips may supplement, but not
carry, required instruction.

## 4. Core Loop

### Phase A: Paired-Stimulus Preference Assessment

The creature begins each new run with seeded latent preferences and motivating
conditions. These conditions vary between new runs and may also change within
a run through repeated access.

The v1 assessment uses four stimuli (for example, toy, treat, praise, and
play):

- Present each of the six unique pairs once.
- Randomize trial order and left/right placement using the session RNG.
- Animate the creature approaching one stimulus or making no selection.
- Ask the player to record the observed selection. Preserve both the
  creature's actual selection and the player's record so observation/data
  errors can be discussed constructively.
- Rank stimuli by selection percentage. Specify deterministic tie handling
  (shared rank, then stable stimulus ID order for display).
- Provide brief, equal access after a selection. Access may produce a small
  satiation effect, but the effect must not be large enough to make trial order
  dominate the assessment.

The result is labeled a **preference hierarchy**. Items are described as
preferred stimuli or candidate/putative reinforcers until subsequent behavior
demonstrates a reinforcing effect.

### Phase B: Training and Reinforcement Practice

V1 uses one predefined, observable target behavior. Because it does not model
successive approximations or criterion changes, this phase is not called
"shaping." Actual shaping is deferred until the simulation can represent it
faithfully.

#### Round 0: Baseline

Run a short, non-instructional baseline to estimate the target behavior's
initial rate. The baseline creates a reference against which later changes can
be interpreted; it is not scored as player performance. Its duration is
`baselineDurationMs` (v1 default: 45 simulated seconds).

#### Round 1: CRF acquisition

- The player chooses a stimulus informed by the preference hierarchy. The game
  permits a lower-preference choice so the behavioral result can confirm or
  disconfirm the assessment prediction.
- Every target response meets the CRF schedule criterion. The same due window
  applies: at most one criterion is outstanding at a time, so a burst of
  unreinforced responding produces one `criterion-missed` per elapsed due
  window plus schedule overruns, not one event per response.
- The player manually delivers the selected stimulus after a response.
- The sim records promptness, contingency, missed opportunities, and
  deliveries made when no response is active.
- The round advances only after both `crfMinOnScheduleDeliveries` and the
  acquisition-rate threshold defined in Section 5.6 are reached. At
  `crfCoachingPauseMs`, the round pauses to offer corrective coaching rather
  than silently advancing to VR before the response is established.
- The acquisition gate is deliberately stricter than the reinforcer-evidence
  rule in Section 5.5: a run can advance to VR only after the response is
  established, whereas evidence of a reinforcing effect can be claimed on
  slightly less delivery history.

#### Round 2: VR maintenance

- After acquisition, the schedule is thinned to VR-3.
- The seeded schedule policy generates a bounded sequence of ratio
  requirements with a mean of three (v1 default: shuffled blocks of 2, 3, and
  4). It tracks responses since the previous on-schedule delivery.
- During guided v1 play, the UI shows the response count and signals when the
  current criterion is met. The player must still deliver the stimulus
  manually and promptly. Premature, late, missed, and noncontingent deliveries
  remain possible and are logged.
- Once a ratio requirement is met, reinforcement remains due until it is
  delivered or until the due window (`reinforcementDueWindowMs`, Section 5.6)
  elapses. Additional responses while reinforcement is due are logged as
  schedule overruns. If the due window elapses undelivered, the sim emits
  `criterion-missed`, abandons the cycle, and starts a new one at the next
  response; this is the only way a criterion is missed rather than merely
  delivered late. Any delivery starts a new ratio cycle; a premature delivery
  is therefore both a fidelity error and part of the actual reinforcement
  history experienced by the creature.
- The schedule policy determines when reinforcement is due; it does not
  directly make the creature respond faster. Behavior changes only through
  the reinforcement contingencies the creature actually experiences.
- The round ends after `vrCyclesToComplete` completed on-schedule VR cycles.
  At `vrCoachingPauseMs`, it pauses and offers corrective coaching if that
  criterion has not been reached.

This progression teaches CRF as an acquisition schedule and VR as a
maintenance schedule. An independent practice variant that hides the
eligibility signal is a stretch goal.

#### Round 3: Optional extinction-effects demonstration

After a stable reinforcement history has been established, the player may run
a short, clearly framed demonstration in which the established consequence is
withheld. The simulation may produce a burst, response variation, another
transitional pattern, or a decline without a burst. The outcome is seeded and
probabilistic; the game never states or implies that a burst always occurs.
Whether the run is reported as a burst is decided by the transparent detection
rule in Section 5.5, not by a narrative flag set when the round starts.

In v1 the round is reachable only after Round 2, so the reinforced round it
is compared against is unambiguous.

This round is observational and is never framed as a recommended real-world
intervention. A learner may skip it and still complete the session.

### Debrief

Both modes derive their recap from the same event history and summary
functions.

The debrief covers:

- Preference-assessment recording accuracy and the resulting hierarchy.
- Whether the selected stimulus predicted a demonstrable increase over
  baseline; only then may it be described as functioning as a reinforcer in
  this simulation.
- Intended versus implemented schedule, including procedural-fidelity rate.
- Median delivery latency, missed criteria, premature deliveries, and
  schedule overruns, as well as noncontingent deliveries.
- CRF acquisition and VR maintenance response trends.
- Changes plausibly associated with repeated stimulus access/satiation.
- Any extinction-related effect observed, including an explicit statement
  when no burst occurred.

Simple mode expresses these points in plain language. Advanced mode presents
the same conclusions using technical terms, a graph, and an event table.

## 5. Simulation Contract and Data Model

### 5.1 Intended versus experienced contingencies

The most important simulation invariant is:

> The selected schedule controls reinforcement eligibility; only experienced
> consequences influence subsequent creature behavior.

Selecting VR must not, by itself, create a high steady response rate. If a
player implements VR as CRF, misses eligible responses, delivers the stimulus
late, or delivers it without a response, the learner model uses those actual
events. The debrief compares them with the intended policy.

### 5.2 Session state

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

### 5.3 Event log

The event log is append-only and is the source for graphs, the data table,
summary statistics, debrief text, and deterministic replay.

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
plus event log is sufficient for replay and so that Section 5.5 can exclude
paused time without consulting a second data path. Every public command that
changes clock behavior appends an event; `setPaused` and `setSpeed` are not
exceptions. `configVersion` identifies the Section 5.6 constants a log was
produced under, so an old log is never silently reinterpreted under new
thresholds.

An active response has a default prompt-delivery window of 1,500 simulated
milliseconds (`promptDeliveryWindowMs`). The window is fixed in simulated time
and is not additionally scaled by the speed setting: at 0.5x speed those 1,500
simulated milliseconds already occupy 3,000 wall-clock milliseconds, which is
what the accessibility requirement in Section 8 asks for. Scaling it a second
time would make prompt-delivery rate easier at 0.5x and break comparability
across speeds. A delivery after that window may still be response-contingent,
but its timing is classified as delayed. A delivery with no associated target response is
noncontingent. Timing, contingency, and schedule fidelity remain independent
dimensions. Exact thresholds are configuration values, not scattered UI
constants.

### 5.4 Response generation and learning

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

Repeated access gradually reduces a stimulus's `currentValue`. Limited
recovery may occur while the app remains open. Because v1 has no persistence,
claims about recovery across visits are out of scope. Each new session instead
seeds a new initial motivating condition.

Extinction transitions are parameterized and seeded. Known test seeds cover
both burst and no-burst outcomes, but the implementation must not treat a
published clinical prevalence as a literal probability for the fictional
creature.

### 5.5 Derived metrics

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
  never be summed into the same denominator. A cycle whose criterion was never met when the round ended is
  *incomplete* and is excluded from both numerator and denominator, so ending
  a round mid-ratio neither rewards nor penalizes the learner.
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
thresholds, not a clinical rule. If the threshold is not met, the debrief says the stimulus
"did not demonstrate a reinforcing effect in this short simulation" rather
than asserting that it cannot function as a reinforcer.

**Extinction-burst detection.** A burst is reported only when, within
`burstDetectionWindowMs` of the first withheld criterion, the response rate is
at least `burstRelativeIncrease` above and at least `burstAbsoluteIncrease`
per minute above the reference rate. The reference is the response rate over
the final `min(reinforcedRoundDurationMs, burstReferenceWindowMs)` of the
reinforced round immediately preceding extinction, measured within that round
only and never bleeding into an earlier round. V1 permits entering extinction
from VR only, so that round is always Round 2. If the available reference
window is shorter than `burstMinReferenceWindowMs`, the reference rate is too
noisy to compare against and the run is reported as neither a burst nor a
confirmed no-burst: the debrief says the demonstration was too short to
characterize and states that bursts are not inevitable. The
rule is evaluated from the event log after the round, exactly like every other
derived metric; the extinction model is never asked whether it "intended" a
burst. When the rule is not met, the debrief states explicitly that no burst
occurred in this run and that bursts are not inevitable.

### 5.6 Configuration constants

Every threshold above is a named field of a single `SimConfig` object owned by
the simulation core, not a literal scattered through rules or UI. Tests
override it explicitly; the UI never reads or writes it. `configVersion` is
stamped into `session-started`.

| Constant | v1 default | Used by |
|---|---|---|
| `promptDeliveryWindowMs` | 1500 simulated ms | Delivery timing classification (5.3) |
| `reinforcementDueWindowMs` | 10000 simulated ms | Criterion-missed and cycle abandonment (4, 5.5) |
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
| `burstDetectionWindowMs` | 30000 simulated ms | Burst detection |
| `burstReferenceWindowMs` | 60000 simulated ms | Burst detection |
| `burstMinReferenceWindowMs` | 20000 simulated ms | Burst detection floor |
| `burstRelativeIncrease` | 0.50 | Burst detection |
| `burstAbsoluteIncrease` | 2.0 responses/min | Burst detection |
| `maxTickDeltaMs` | 250 wall-clock ms | Clock delta capping (7.2) |

The acquisition gate (`crfAcquisition*`) is intentionally a shorter, stricter
window than the reinforcer-evidence rule (`reinforcerEvidence*`): the first
decides whether the response is established enough to thin the schedule, the
second decides what the debrief is entitled to claim.

`reinforcementDueWindowMs` is the constant most likely to need retuning once a
playable sim exists. Because it also feeds the fidelity denominator during CRF,
a value that is too short makes schedule fidelity read near zero for a learner
who is merely unhurried rather than incorrect. Check it against the Section 10
expectation that the slower speed setting carries no scoring penalty, and
revisit it during learner testing.

## 6. MVP Scope

**In scope:**

- One default creature and one predefined target behavior.
- Four-stimulus, six-trial paired-stimulus preference assessment.
- Short baseline, CRF acquisition, and guided VR-3 maintenance rounds.
- Manual stimulus delivery with contingency, timing, and fidelity tracking.
- Optional probabilistic extinction-effects demonstration.
- Satiation/current-value effects within a session.
- Simple/Advanced mode toggle.
- Session debrief built from the event log.
- Pause and 0.5x/1x speed controls.

**Explicitly out of scope for v1:**

- Multiple creatures, naming, or customization.
- MSWO and single-stimulus assessment formats.
- FI, FR values other than FR-1/CRF, and VI schedules.
- Independent VR practice without an eligibility cue.
- Actual shaping through successive approximations.
- Generalization, maintenance across visits, or saved progress.
- Negative reinforcement scenarios.
- Multi-behavior chaining.
- Social/comparison features.
- Standard Celeration Chart support.

## 7. Architecture

### 7.1 Technology

Use Vite, React, and TypeScript. V1 has no backend; all session state is held in
memory. The deployment target remains deferred.

### 7.2 Simulation core and React shell

The simulation core (`src/sim/`) is plain TypeScript with no React or DOM
dependencies. It owns the controlled clock, seeded RNG, schedule policy,
creature learning model, event classification, immutable snapshots, and
summary derivation.

Its public API is intentionally small:

```ts
createSession(options: { seed?: string; speed?: 0.5 | 1; config?: Partial<SimConfig> }): SimSession
presentNextPair(): void
recordObservedSelection(stimulusId: string | null): void
startRound(round: 'baseline' | 'crf' | 'vr' | 'extinction'): void
deliverStimulus(stimulusId: string): void
tick(realDtMs: number): void
setPaused(paused: boolean): void
setSpeed(speed: 0.5 | 1): void
getSnapshot(): SessionState
subscribe(listener: () => void): () => void
```

Commands do not accept or expose mutable creature state. `deliverStimulus`
classifies the delivery against the current response and schedule criterion;
the generated event contains the associated `responseId` when one exists. The
`config` option exists for tests and fixtures only; the React shell always
constructs a session with the Section 5.6 defaults.

The React shell (`src/app/`) uses `useSyncExternalStore` through a
`useSimState()` bridge. Components render snapshots and send commands; no
simulation rule lives in a hook or component.

Browser visibility changes automatically pause the controlled simulation
clock. `tick` receives elapsed wall-clock time; the core caps unexpected deltas
and applies the selected speed to produce simulated time. Returning to a
backgrounded tab therefore cannot silently advance an entire round.

The UI owns `mode: 'simple' | 'advanced'`; mode never changes sim behavior.
Accessibility speed is different: it is an explicit sim input because it
changes simulated timing windows in a controlled, testable way.

### 7.3 Screens

- **AppShell:** owns the sim instance, mode toggle, accessibility controls,
  and screen navigation.
- **OnboardingScreen:** states learning goals and educational boundaries.
- **AssessmentScreen:** presents pairs, animates selection, records the
  player's observation, and shows the preference hierarchy.
- **TrainingScreen:** contains baseline/CRF/VR/extinction subphases, schedule
  coaching, stimulus delivery, creature animation, and progress. Advanced mode
  adds the live cumulative record and event log.
- **DebriefScreen:** renders Simple or Advanced views from a single session
  summary object.

### 7.4 Graphing

Use visx for rendering, behind project-owned chart-data and chart-view
interfaces so debrief logic is not coupled to the library.

The primary schedule visualization is a cumulative response record: time on
the x-axis, cumulative responses on the y-axis, and stimulus deliveries/event
annotations overlaid. Slope communicates response rate more legibly in a
short session than a noisy raw-rate line. Advanced mode also shows derived
response rate by round and the underlying accessible event table.

Visx preserves flexibility for a future Standard Celeration Chart, but v1 does
not implement or partially emulate that chart.

## 8. Accessibility and Interaction Requirements

- All actions are operable by keyboard, pointer, and touch.
- The stimulus-delivery control has a large target and a documented keyboard
  shortcut that does not conflict with browser or assistive-technology keys.
- Pause and 0.5x speed controls are always available during timed rounds.
- Reduced-motion preferences replace nonessential motion with state changes;
  required selection/response information is also presented textually.
- Mood, eligibility, and fidelity never rely on color alone.
- Every graph has a text summary and accessible data-table equivalent.
- Focus order, status announcements, labels, and contrast meet WCAG 2.2 AA
  expectations.
- Timing scores are normalized to simulated time so using the slower setting
  does not reduce the learner's result.

## 9. Testing and Error Handling

### 9.1 Simulation tests

Use Vitest with deterministic seeds. Test:

- Paired-assessment pair coverage, randomization, recording accuracy, ranking,
  no-selection handling, and tie handling.
- Schedule-policy eligibility for CRF and bounded VR-3 sequences.
- Independent delivery classification across contingency, promptness, and
  schedule fidelity, including missed criteria and schedule overruns.
- The central causal invariant: changing the selected plan without changing
  experienced events does not directly change response rate.
- Acquisition after prompt contingent delivery and weaker/no learning after
  noncontingent or substantially delayed delivery.
- Satiation decay and within-session recovery bounds.
- Time-step/render-frequency invariance.
- Replay equivalence from a seed and event log alone, including sessions
  containing pauses and speed changes.
- Due-window expiry: criterion-missed and cycle abandonment fire once per
  elapsed window, overruns are logged separately, and incomplete end-of-round
  cycles are excluded from the fidelity denominator.
- The burst-detection rule against constructed event logs, independent of the
  extinction model that produced them, including a Round 2 shorter than
  `burstReferenceWindowMs` and one shorter than `burstMinReferenceWindowMs`.
- Schedule fidelity counts one abandoned cycle per timeout, never double
  counting the `criterion-missed` emitted alongside it.
- Prompt-delivery rate is invariant across 0.5x and 1x for the same
  simulated-time behavior.
- Both extinction-burst and no-burst paths using known seeds.
- Summary and debrief rules, including correct use of "preferred stimulus"
  versus "reinforcer."

Probabilistic shape expectations are evaluated across a documented cohort of
seeds with tolerant statistical/property assertions. Tests must not require
every individual run to exhibit an idealized textbook curve.

### 9.2 React and end-to-end tests

Use React Testing Library for screen/state integration and a small end-to-end
suite for the complete onboarding -> assessment -> baseline -> CRF -> VR ->
debrief path. Cover mode switching mid-session, pause/speed behavior,
background-tab pausing, keyboard-only operation, reduced motion, and the
accessible chart alternative. Include automated accessibility checks, while
recognizing that they do not replace manual testing.

### 9.3 Illegal states and recovery

Prefer discriminated unions and phase-specific commands so illegal states are
unrepresentable where practical. Commands issued in the wrong phase return a
typed result and append no partial event. The UI prevents duplicate starts and
explains unavailable actions. Unexpected UI errors show a recoverable restart
option; because v1 has no persistence, restarting clearly states that the
current session will be lost.

## 10. Acceptance and Release Criteria

Implementation is ready for learner testing when:

- A seeded session can be replayed identically.
- The complete required path takes 10-20 minutes at 1x speed.
- A player can make timing and schedule errors, and the creature responds to
  the actual event history rather than the chosen label.
- The debrief accurately compares intended and implemented schedules.
- The game never calls a preferred stimulus a reinforcer unless subsequent
  behavior increased relative to baseline under contingent delivery.
- Ordinary seeds include both burst and no-burst extinction outcomes, and both
  produce accurate debrief language.
- The flow is fully usable by keyboard and at 0.5x speed without a scoring
  penalty.
- Simple and Advanced views produce equivalent conclusions from the same
  session summary.

Before public release:

- A qualified behavior-analytic SME reviews terminology, instructional
  sequencing, debrief rules, and safety framing.
- Representative Simple-mode and Advanced-mode learners complete moderated
  usability sessions.
- The team checks whether learners can state the objectives in Section 2 in
  their own words; observed misconceptions are treated as content defects.
- Keyboard, screen-reader, touch, reduced-motion, and color/contrast behavior
  receive manual review.

## 11. Deferred Work

- Standard Celeration Chart implementation.
- Hosting/deployment target.
- FI/FR/VI schedules, MSWO/single-stimulus assessment, shaping, independent
  schedule practice, multi-session persistence, and customization.

## 12. Educational References

- Behavior Analyst Certification Board, [RBT Test Content Outline, 3rd
  edition](https://www.bacb.com/wp-content/rbt-outline-3rdEd/).
- American Psychological Association, [definition of
  reinforcement](https://dictionary.apa.org/reinforcement).
- DeLeon & Iwata (1996), [Evaluation of a multiple-stimulus presentation
  format for assessing reinforcer preferences](https://pubmed.ncbi.nlm.nih.gov/8995834/).
- Muething et al. (2024), [Descriptive characteristics of extinction bursts: A
  record review](https://doi.org/10.1002/jaba.1054).
