# Core Loop

See also: [Product Spec](product-spec.md) · [Data Model](architecture/data-model.md) for the
`SimConfig` constants referenced below · [ABA Concept Glossary](aba-glossary.md) for
sourced definitions of the terms used in this document.

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
  window plus schedule overruns, not one event per response. As with VR, a
  due-window timeout emits `cycle-abandoned` alongside the diagnostic
  `criterion-missed`, and that is the event the schedule-fidelity denominator
  counts.
- The player manually delivers the selected stimulus after a response.
- The sim records promptness, contingency, missed opportunities, and
  deliveries made when no response is active.
- The round advances only after both `crfMinOnScheduleDeliveries` and the
  acquisition-rate threshold defined in the data model's derived-metrics
  section are reached. At `crfCoachingPauseMs`, the simulation automatically
  appends a one-time `paused` event and offers corrective coaching rather than
  silently advancing to VR before the response is established. The learner
  explicitly resumes after reading it.
- The acquisition gate is deliberately stricter than the reinforcer-evidence
  rule: a run can advance to VR only after the response is established,
  whereas evidence of a reinforcing effect can be claimed on slightly less
  delivery history.

### Round 2: VR maintenance

- After acquisition, the schedule is thinned to VR-3.
- Fidelity is judged against a running average of responses-per-delivery
  across the whole round, not a hidden exact target per cycle — see
  [ADR 0010](adr/0010-vr-fidelity-as-running-average.md). The average is
  seeded with a small phantom history (three entries of 3) so early
  deliveries aren't judged off a near-empty sample, then tracks only real
  accepted deliveries from there. There is no minimum-response floor: the
  very first response of the round is judged the same way as any other, by
  whether accepting it would keep the average in range.
- On each delivery, the sim computes what the round's average would become
  if this gap (responses since the last delivery) were accepted. In range
  (2-4) it's `on-schedule` and joins the average; below range it's
  `premature`, above it's `overrun` — either way it is still delivered to
  the creature and is part of the actual reinforcement history experienced
  (ADR 0003), it just is not credited toward the round's required deliveries.
- A delivery that averages correctly but repeats the same gap too many
  times in a row (default: three identical real gaps) is `not-variable`
  instead of `on-schedule` — still delivered, still not credited. This
  catches a fixed ratio dressed up as VR (e.g. always reinforcing every
  third response).
- The UI shows the live response count, the running average, and a
  trial-by-trial history of which responses earned credited reinforcement.
  The player must still deliver the stimulus manually and promptly.
- The round ends after `vrCyclesToComplete` credited (`on-schedule`)
  deliveries. `vrCyclesToComplete` is a legacy runtime/configuration name;
  learner-facing copy calls these credited deliveries, because ADR 0010's VR
  model has no discrete cycles or due instant. At `vrCoachingPauseMs`, the
  simulation automatically appends a one-time `paused` event and offers
  corrective coaching if that criterion has not been reached. The learner
  explicitly resumes after reading it.

This progression teaches CRF as an acquisition schedule and VR as a
maintenance schedule. V1's guided VR feedback is the visible response count,
running average, and reinforcement history. ADR 0010 deliberately has no
discrete “reinforcement due” cue because no exact per-delivery target exists.
An unguided practice variant that hides this feedback is deferred.

### Round 3: Optional extinction-effects demonstration

After a stable reinforcement history has been established, the player may
skip directly to debrief or run a short, clearly framed demonstration in which
the established consequence is withheld. The simulation may produce a burst,
response variation, another
transitional pattern, or a decline without a burst. The outcome is seeded and
probabilistic; the game never states or implies that a burst always occurs.
Whether the run is reported as a burst is decided by the transparent
detection rule in the data model, not by a narrative flag set when the round
starts.

In v1 the round is reachable only after Round 2, so the reinforced round it
is compared against is unambiguous.

This round is observational and is never framed as a recommended real-world
intervention. A learner may skip it and still complete the session.

The production round lasts `extinctionDurationMs` (v1 default: 150 simulated
seconds), giving the configured 90-second detection window room to finish after
the first live response opens the first withheld criterion. Once the duration
has elapsed, `finishSession()` moves the session to `debrief`. A learner who
skips from completed VR calls the same command and moves directly to `debrief`
without opening an extinction span.

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
