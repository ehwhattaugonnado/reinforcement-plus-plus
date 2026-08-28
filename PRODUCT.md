# Product

<!-- impeccable:product-schema 1 -->

This file records durable product truth for design work. It deliberately does
not restate the approved specification. Where a repository document already
owns a fact, this file states the design-relevant consequence and points at
the source. Keep it consistent with `docs/` rather than in competition with it.

## Platform

web

## Users

Two co-equal primary audiences, served by one simulation through a
presentation-only Simple/Advanced toggle:

- **Caregivers and support staff new to ABA.** Plain language, no
  behavior-analytic vocabulary assumed.
- **RBT trainees and BCBA-adjacent staff.** Technical terminology, cumulative
  record, response-rate summary, and event log.

Neither audience is the default design target. When the two conflict, the
conflict is resolved case by case; neither mode may be shipped as a degraded
stub of the other. This ratifies and strengthens the existing project rule
that Simple/Advanced conclusion mismatches are defects (`AGENTS.md`, Quality
Bar; [ADR 0004](docs/adr/0004-simple-advanced-as-ui-only-toggle.md)).

Learners arrive two ways, both confirmed:

- **Cold, self-directed link.** Someone opens the public URL with no framing.
- **Assigned within a training program.** A supervisor or curriculum assigns
  it, possibly with a debrief conversation afterward.

Neither path guarantees an instructor. **Onboarding and framing must be
self-sufficient: no surface may depend on narration, a facilitator, or prior
context to be understood.** Portfolio viewers and instructor-led classroom use
were considered and are *not* confirmed audiences; do not design for them.

## Product Purpose

A browser-based pet-training simulation that teaches paired-stimulus
preference assessment and positive reinforcement in a single 10–20 minute
sitting. The learner assesses what a virtual creature prefers, then practices
delivering that stimulus as reinforcement across baseline, CRF acquisition,
guided VR-3 maintenance, and an optional extinction-effects demonstration.

Success is a learner who can state the objectives in
[docs/product-spec.md §2](docs/product-spec.md) in their own words. Observed
misconceptions are treated as content defects, not user error.

The tone is cute, wholesome, constructive, and punishment-free. There are no
fail states — only more or less effective training followed by supportive
feedback.

## Positioning

The mechanism a neighboring product could not truthfully copy:

- **The chosen schedule controls eligibility only.** Creature behavior changes
  solely from consequences *actually experienced* — their contingency,
  latency, stimulus value, and history. A learner can select a schedule label
  and implement something else, and the creature responds to what really
  happened. See [ADR 0003](docs/adr/0003-eligibility-vs-experienced-consequences-invariant.md).
- **The debrief compares intended schedule against implemented schedule**,
  derived from the append-only event log rather than from the learner's stated
  intent.
- **"Reinforcer" is a status the session must earn.** Assessment results are
  named preferred stimuli or candidate/putative reinforcers. The product calls
  something a reinforcer only after event-derived evidence shows increased
  future responding over baseline. See [docs/aba-glossary.md](docs/aba-glossary.md).
- **Deterministic replay from seed plus event log.** Any session can be
  reproduced exactly.
- **Extinction outcomes are seeded and probabilistic.** Bursts are detected
  from the event log and are never presented as inevitable.

## Operating Context

A single, uninterrupted sitting in a browser, with no account and no install.
Nothing persists between sessions ([ADR 0006](docs/adr/0006-no-v1-persistence.md)),
so a learner who leaves mid-session loses it — the flow must be completable in
one pass and must not imply saved progress.

Learners control pace: pause and 0.5x/1x speed are available throughout timed
rounds, and the slower speed carries no scoring penalty
([docs/accessibility.md](docs/accessibility.md), Timing fairness).

Because the tool is standalone, essential explanation belongs in the flow.
Tooltips may supplement required instruction but may never carry it.

## Capabilities and Constraints

Confirmed scope, formats, and explicit exclusions live in
[docs/product-spec.md §4](docs/product-spec.md); the required flow lives in
[docs/core-loop.md](docs/core-loop.md); event shapes, metrics, and timing live
in [docs/architecture/data-model.md](docs/architecture/data-model.md).
Behavior-analytic terminology has one source of truth:
[docs/aba-glossary.md](docs/aba-glossary.md).

Durable constraints future work must preserve:

- **Educational boundary, stated explicitly, not buried.** This is not
  clinical decision support, a treatment protocol, a substitute for
  competency-based training or supervision, or authorization to implement
  extinction with a person. The onboarding and debrief must say so.
- **No backend, no `localStorage`, no persistence** in v1.
- **Simple/Advanced is presentation-only.** Switching modes mid-session must
  not reset or alter the simulation.
- **The append-only event log is the sole source of truth.** Every graph,
  table, metric, and line of debrief copy derives from it.
- **The creature is authored in code (SVG/CSS) in this repository.** No
  illustrator, no licensed art, and no art pipeline may be assumed.
- **Thresholds live in `SimConfig`.** Production UI uses defaults and never
  reads, writes, or overrides them.
- **Deferred v1 scope stays deferred** without an explicit product decision:
  additional schedules, other assessment formats, multiple creatures, naming
  or customization, persistence, negative reinforcement, chaining, and
  Standard Celeration Charts.

Open product decisions, recorded rather than assumed:

- Public-release hosting approval and release process
  ([docs/product-spec.md §6](docs/product-spec.md)).

## Brand Commitments

- **Name:** Reinforcement++.
- **Voice:** cute, wholesome, low-stakes, constructive, punishment-free, and
  explicit about its educational boundaries. Never implies clinical authority.
- **Terminology is binding.** Copy follows `docs/aba-glossary.md` precisely:
  preferred stimulus vs. reinforcer, reinforce a behavior/response rather than
  the creature, and no calling ordinary decrease, satiation, or resurgence
  "extinction."
- **License:** AGPL-3.0-only.
- **Stated honestly in the README:** the project was built collaboratively
  with AI coding assistants under human direction. That disclosure stays.

## Evidence on Hand

Real:

- The approved design documentation set in `docs/`, with citations to Cooper,
  Heron & Heward (2020); the BACB RBT Test Content Outline (3rd ed.); Fisher
  et al. (1992) for the paired-stimulus method; and Muething et al. (2024) for
  extinction-burst characteristics.
- A working, tested simulation core with deterministic replay, and an
  extinction-transition model calibrated against a 150-seed cohort.
- A GitHub Pages deployment — explicitly an **unreviewed development
  preview**, not an endorsed release.
- `docs/ref/` holds local copyrighted reference material and is intentionally
  gitignored; it must not be committed or reproduced.

Absent — future work must not fabricate or imply any of these:

- **No qualified behavior-analytic SME review has happened yet.** This is
  required before public release. Copy and visual design must not imply
  clinical credibility, endorsement, or certification the project does not
  have.
- No moderated usability findings.
- No learner testimonials, adoption numbers, outcome data, or efficacy claims.
- No independent professional code review or security audit.
- **No creature art, illustration, or image assets of any kind.**

## Product Principles

1. **The event log is the argument.** Every claim the product makes to a
   learner — a metric, a graph, a debrief conclusion — must be traceable to
   what actually happened in the session. Nothing asserted, everything derived.
2. **Earn the vocabulary.** Precise behavior-analytic language is the product's
   integrity. Never use a term before the session has demonstrated it, and
   never soften a definition for the sake of a nicer sentence.
3. **Two modes, one truth.** Simple and Advanced are two readings of the same
   session and must reach the same conclusions. A conclusion available in one
   mode and absent or contradicted in the other is a defect.
4. **Constructive, never punitive.** Mistakes are the curriculum. Errors
   produce coaching and visible consequences in the creature's behavior — never
   scolding, failure states, or a lost session.
5. **Say what this is not.** The educational boundary is part of the product,
   not a disclaimer to be minimized. Honesty about limits is a design feature.

## Accessibility & Inclusion

WCAG 2.2 AA is a requirement, not an aspiration. The full set lives in
[docs/accessibility.md](docs/accessibility.md); the design-binding parts:

- Full keyboard, pointer, and touch operation. The stimulus-delivery control
  has a large target and a documented, non-conflicting keyboard shortcut.
- Mood, eligibility, and fidelity are never conveyed by color alone.
- Reduced-motion preferences replace nonessential motion with state changes;
  required selection and response information is also presented textually.
- Every graph ships an accessible data table and a text summary derived from
  the same chart data.
- Timing is normalized to simulated time, so 0.5x costs the learner nothing.

**Interaction with the creature constraint:** the creature must be authored in
code (SVG/CSS) in this repository. No illustrator, no licensed art, and no art
pipeline may be assumed. Its expressiveness, its reduced-motion fallback, and
its non-color state cues all have to be satisfied by code-drawn output.
