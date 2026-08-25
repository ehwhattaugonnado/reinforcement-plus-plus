# Core Loop

See also: [Product Spec](product-spec.md) · [Data Model](architecture/data-model.md) for the
`SimConfig` constants referenced below.

## Phase A: Paired-Stimulus Preference Assessment

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

## Phase B: Training and Reinforcement Practice

V1 uses one predefined, observable target behavior. Because it does not model
successive approximations or criterion changes, this phase is not called
"shaping." Actual shaping is deferred until the simulation can represent it
faithfully.

### Round 0: Baseline

Run a short, non-instructional baseline to estimate the target behavior's
initial rate. The baseline creates a reference against which later changes can
be interpreted; it is not scored as player performance. Its duration is
`baselineDurationMs` (v1 default: 45 simulated seconds).

### Round 1: CRF acquisition

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
  acquisition-rate threshold defined in the data model's derived-metrics
  section are reached. At `crfCoachingPauseMs`, the round pauses to offer
  corrective coaching rather than silently advancing to VR before the
  response is established.
- The acquisition gate is deliberately stricter than the reinforcer-evidence
  rule: a run can advance to VR only after the response is established,
  whereas evidence of a reinforcing effect can be claimed on slightly less
  delivery history.

### Round 2: VR maintenance

- After acquisition, the schedule is thinned to VR-3.
- The seeded schedule policy generates a bounded sequence of ratio
  requirements with a mean of three (v1 default: shuffled blocks of 2, 3, and
  4). It tracks responses since the previous on-schedule delivery.
- During guided v1 play, the UI shows the response count and signals when the
  current criterion is met. The player must still deliver the stimulus
  manually and promptly. Premature, late, missed, and noncontingent deliveries
  remain possible and are logged.
- Once a ratio requirement is met, reinforcement remains due until it is
  delivered or until the due window (`reinforcementDueWindowMs`) elapses.
  Additional responses while reinforcement is due are logged as schedule
  overruns. If the due window elapses undelivered, the sim emits
  `criterion-missed`, abandons the cycle, and starts a new one at the next
  response; this is the only way a criterion is missed rather than merely
  delivered late. Any delivery starts a new ratio cycle; a premature delivery
  is therefore both a fidelity error and part of the actual reinforcement
  history experienced by the creature.
- The schedule policy determines when reinforcement is due; it does not
  directly make the creature respond faster. Behavior changes only through
  the reinforcement contingencies the creature actually experiences. See
  [ADR 0003](adr/0003-eligibility-vs-experienced-consequences-invariant.md).
- The round ends after `vrCyclesToComplete` completed on-schedule VR cycles.
  At `vrCoachingPauseMs`, it pauses and offers corrective coaching if that
  criterion has not been reached.

This progression teaches CRF as an acquisition schedule and VR as a
maintenance schedule. An independent practice variant that hides the
eligibility signal is a stretch goal.

### Round 3: Optional extinction-effects demonstration

After a stable reinforcement history has been established, the player may run
a short, clearly framed demonstration in which the established consequence is
withheld. The simulation may produce a burst, response variation, another
transitional pattern, or a decline without a burst. The outcome is seeded and
probabilistic; the game never states or implies that a burst always occurs.
Whether the run is reported as a burst is decided by the transparent
detection rule in the data model, not by a narrative flag set when the round
starts.

In v1 the round is reachable only after Round 2, so the reinforced round it
is compared against is unambiguous.

This round is observational and is never framed as a recommended real-world
intervention. A learner may skip it and still complete the session.

## Debrief

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
