# Product Spec: Reinforcement & Preference Assessment Teaching Game

**Status:** Approved v1 specification; implementation in progress
**Date:** 2026-08-25
**Repo:** https://github.com/ehwhattaugonnado/reinforcement-plus-plus

See also: [Implementation Roadmap](roadmap.md) · [Core Loop](core-loop.md) · [Architecture Overview](architecture/overview.md) · [ADR index](adr/README.md) · [ABA Concept Glossary](aba-glossary.md)

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
or changing the simulation. See [ADR 0004](adr/0004-simple-advanced-as-ui-only-toggle.md).

The tool is standalone, so essential explanations are part of the flow rather
than being confined to optional tooltips. Tooltips may supplement, but not
carry, required instruction.

## 4. MVP Scope

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
- Unguided VR practice without the live response count, running average, and
  reinforcement-history feedback used by v1's guided round.
- Actual shaping through successive approximations.
- Generalization, maintenance across visits, or saved progress.
- Negative reinforcement scenarios.
- Multi-behavior chaining.
- Social/comparison features.
- Standard Celeration Chart support.

See [Deferred Work](#6-deferred-work) below for where cut scope may return.

## 5. Acceptance and Release Criteria

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

## 6. Deferred Work

- Standard Celeration Chart implementation.
- Public-release hosting approval and release process. GitHub Pages currently
  hosts the unreviewed development preview.
- FI/FR/VI schedules, MSWO/single-stimulus assessment, shaping, unguided
  schedule practice, multi-session persistence, and customization.

## 7. Educational References

- Cooper, Heron, & Heward (2020), *Applied Behavior Analysis* (3rd ed.),
  Pearson — the primary source underlying this project's terminology. See the
  project's [ABA Concept Glossary](aba-glossary.md) for definitions, precise
  citations, and how each concept maps to the simulation.
- Behavior Analyst Certification Board, [RBT Test Content Outline, 3rd
  edition](https://www.bacb.com/wp-content/rbt-outline-3rdEd/).
- American Psychological Association, [definition of
  reinforcement](https://dictionary.apa.org/reinforcement).
- Fisher, Piazza, Bowman, Hagopian, Owens, & Slevin (1992), A comparison of
  two approaches for identifying reinforcers for persons with severe and
  profound disabilities, *Journal of Applied Behavior Analysis, 25*, 491-498
  — original source for the **paired-stimulus (forced-choice)** method, which
  is the preference-assessment format v1 implements (see [Core Loop, Phase
  A](core-loop.md#phase-a-paired-stimulus-preference-assessment)).
- DeLeon & Iwata (1996), [Evaluation of a multiple-stimulus presentation
  format for assessing reinforcer preferences](https://pubmed.ncbi.nlm.nih.gov/8995834/)
  — describes and evaluates **MSWO**, which is explicitly out of scope for v1
  (see [Deferred Work](#6-deferred-work)); retained here as background for
  that deferred format, not as the source for v1's assessment method.
- Muething et al. (2024), [Descriptive characteristics of extinction bursts: A
  record review](https://doi.org/10.1002/jaba.1054).
