# V1 Implementation Roadmap

**Status:** Active implementation plan

**Date:** 2026-08-27

See also: [Product Spec](product-spec.md) · [Core Loop](core-loop.md) ·
[Architecture Overview](architecture/overview.md) ·
[Simulation Data Model](architecture/data-model.md) ·
[Testing Strategy](testing-strategy.md) · [Accessibility](accessibility.md) ·
[ADR Index](adr/README.md)

## 1. Roadmap Goal

Deliver the approved 10–20 minute v1 learner experience as a deterministic,
browser-only Vite/React/TypeScript application. The implementation sequence
prioritizes the event-sourced simulation and its tests because the UI,
accessible alternatives, graphs, debrief, and replay all depend on that one
record of session events.

This roadmap does not add deferred schedules, assessment formats, creatures,
persistence, customization, shaping, negative reinforcement, chaining, or a
Standard Celeration Chart.

## 2. Delivery Principles

- Build vertical slices in the required learner order: assessment, baseline,
  CRF, VR, optional extinction, and debrief.
- Add event-derived metrics and deterministic tests with each slice rather
  than postponing summaries until the end.
- Keep `src/sim/` plain TypeScript. React renders immutable snapshots and
  sends commands through the `useSyncExternalStore` bridge.
- Treat accessibility as part of each interaction's completion criteria, not
  as a final remediation phase.
- Use documented defaults in the production UI. Configuration overrides are
  test-fixture-only, and every threshold change updates `configVersion`.
- Preserve the distinction between a preferred stimulus and a demonstrated
  reinforcer in types, summaries, and learner-facing copy.

## 2.1 Current Implementation Status

As of 2026-08-27, the repository is on `feat/v1-foundation` and the milestone
status is:

| Milestone | Status | Current evidence |
|---|---|---|
| 0 — Scaffold | Complete | Vite/React/TypeScript, npm scripts, Vitest, RTL, axe, and Playwright are configured. |
| 1 — Simulation foundation | Complete | Seeded RNG, controlled clock, typed atomic commands, immutable snapshots, config-aware replay, and deterministic tests are present. |
| 2 — Assessment | Complete | Six seeded unique pairs, separate observed/recorded selections, hierarchy derivation, accessible UI, and tests are present. |
| 3 — Baseline/learning | Complete | Render-frequency-independent response generation, baseline metrics, experienced-consequence learning, satiation/recovery, UI, and tests are present. |
| 4 — CRF | Complete | `deliverStimulus` classifies contingency/timing/schedule fidelity independently via `src/sim/crf.ts`; one-outstanding-criterion cycles, due-window abandonment (one `criterion-missed`/`cycle-abandoned` pair per timeout), the acquisition gate, corrective-coaching detection, derived CRF metrics, and the CRF portion of `TrainingScreen` (delivery target, keyboard shortcut, status announcements) are present and tested. |
| 5 — VR-3 | Not started | The phase/schedule shape exists, but requirement generation, cycle semantics, completion gates, UI, and tests remain. |
| 6 — Extinction/evidence | Complete (behavior model + detector); UI remains | Event-derived reinforcer-evidence and burst-detection rules are tested, including asymmetric sample-count floors and a calibrated 90s detection window; `learning.ts` has a real seeded extinction-transition burst term (`extinctionBurstPrimed`/`extinctionBurstMagnitudeScale`, seeded once per creature) with documented known burst/no-burst/indeterminate seeds (`extinction-transition.test.ts`). Live outcomes are now a healthy mix of all three verdicts rather than dominated by any one — see the "Extinction-transition state" risk checkpoint below for measured rates. The extinction-round UI/screen wiring is separate, Milestone 7/8 work. |
| 7 — Debrief/charts | Partial | Shared chart-data projectors and accessible visx chart views are tested and wired into Advanced-mode `TrainingScreen` (live cumulative-record/response-rate charts plus an accessible event table, both passing `elapsedSimMs` explicitly to avoid understating an idle open round); the mode-neutral session summary and debrief screen remain. |
| 8 — Release hardening | Not started | Playwright currently covers shell smoke, controls, keyboard operation, and an automated axe pass, not the complete learner journey. |

The next critical-path increment is Milestone 5.

## 3. Milestones

### Milestone 0 — Resolve contracts and scaffold the project

**Outcome:** A runnable, testable application shell with agreed development
commands and no ambiguity in the core public contract.

Deliverables:

- Resolve the documented API mismatch: the sample simulation commands return
  `void`, while the error-handling requirement calls for typed invalid-command
  results that append no partial event. Update the architecture documentation
  before implementing the chosen signature.
- Choose and record the package manager, formatting/linting setup, and small
  end-to-end runner. These are reversible tool choices and do not require an
  ADR unless they introduce a durable architectural constraint.
- Scaffold Vite, React, TypeScript, Vitest, React Testing Library, automated
  accessibility checks, and the selected E2E runner.
- Establish `src/sim/`, `src/app/`, project-owned chart-data/chart-view
  boundaries, test directories, and package scripts for format, lint,
  type-check, unit, integration, and E2E checks.
- Add a minimal AppShell with mode, pause, and speed controls represented in
  the intended ownership layers.

Exit gate:

- The empty shell builds, type-checks, and passes unit/integration smoke tests
  in CI or an equivalent repeatable local command sequence.

### Milestone 1 — Deterministic event-sourced simulation foundation

**Outcome:** A headless session can advance under a controlled clock and be
reconstructed deterministically.

Deliverables:

- Implement `SimConfig` defaults and versioning, seeded RNG, stable IDs,
  simulated time, delta capping, pause/resume, and 0.5x/1x speed changes.
- Define the discriminated `SimEvent`, command-result, snapshot, and
  phase/state types. Keep active schedule unions limited to CRF and VR.
- Implement append-only command handling, immutable snapshots,
  subscriptions, reducers/projectors, and replay from seed plus event log.
- Ensure wrong-phase and duplicate commands return typed errors and append no
  events.
- Derive observed simulated time from clock events so pauses are excluded from
  rate calculations without a parallel state path.

Exit gate:

- Vitest proves replay equivalence, pause/speed replay, immutable snapshots,
  invalid-command atomicity, simulated-time fairness, delta capping, and
  time-step/render-frequency invariance.

### Milestone 2 — Paired-stimulus assessment vertical slice

**Outcome:** A learner can complete the four-stimulus, six-trial assessment
and receive an accurate preference hierarchy.

Deliverables:

- Generate all six unique pairs once, with seeded trial order and left/right
  placement.
- Preserve actual creature selections separately from learner-recorded
  selections, including no-selection trials.
- Model equal access and a bounded satiation effect that does not allow trial
  order to dominate the result.
- Derive recording accuracy, selection percentages, shared ranks, and stable
  stimulus-ID display ordering from the event log.
- Build the accessible AssessmentScreen with textual selection state,
  keyboard/pointer/touch controls, reduced-motion behavior, and the hierarchy
  explanation using preferred/candidate-reinforcer terminology.

Exit gate:

- Deterministic tests cover pair coverage, randomization, observations,
  no-selection, ties, ranking, and recording accuracy; an integration test
  completes the assessment without a pointer.

### Milestone 3 — Baseline and experienced-consequence learning model

**Outcome:** The creature emits render-frequency-independent response events,
and baseline provides an event-derived comparison rate without scoring the
learner.

Deliverables:

- Implement the seeded free-operant response process and the 45-second
  baseline measured in simulated time.
- Implement learned strength and response rate from actual delivery history,
  contingency, latency, current stimulus value, elapsed time, and seeded
  variability. Do not pass the selected schedule label into this model.
- Implement within-session satiation decay and bounded recovery.
- Build the baseline TrainingScreen state, response announcements, creature
  state alternatives, and always-available pause/speed controls.
- Add response-rate window projectors for later acquisition and debrief use.

Exit gate:

- Tests cover known response streams, acquisition effects of prompt
  contingent versus late/noncontingent delivery, satiation/recovery bounds,
  time-step invariance, and the central eligibility-versus-experience causal
  invariant.

### Milestone 4 — CRF acquisition and delivery classification

**Outcome:** The learner can practice manual CRF delivery, make authentic
timing/contingency/fidelity errors, receive coaching, and advance only after
the response is established.

Deliverables:

- Implement one-outstanding-criterion CRF cycles, response association,
  prompt/delayed/no-response timing, contingent/noncontingent delivery, due
  windows, overruns, criterion misses, and cycle abandonment.
- Keep timing, contingency, and schedule fidelity as independent
  classifications.
- Implement the minimum on-schedule delivery and response-rate acquisition
  gate, plus the configured corrective-coaching pause.
- Derive contingent-delivery rate, prompt-delivery rate, schedule fidelity,
  latency, missed criteria, premature deliveries, noncontingent deliveries,
  and overruns from events.
- Build the large delivery target and a documented, non-conflicting keyboard
  shortcut; announce response, eligibility, delivery, and coaching states
  textually.

Exit gate:

- Unit tests exhaust the classification combinations and prove that each
  timeout contributes exactly one abandoned cycle to the fidelity
  denominator. Integration tests cover successful acquisition and a coached
  error path at both speeds.

### Milestone 5 — Guided VR-3 maintenance

**Outcome:** The learner progresses from acquisition to six completed guided
VR cycles and can compare the intended VR-3 policy with actual delivery.

Deliverables:

- Implement deterministic shuffled `[2, 3, 4]` requirement blocks with a mean
  of three, response counting, eligibility cues, and cycle reset semantics.
- Handle premature delivery, late delivery, overruns, missed criteria,
  abandoned cycles, incomplete end-of-round cycles, and the configured
  coaching pause.
- End the round only after six completed on-schedule cycles.
- Extend the same TrainingScreen, event projectors, coaching language, and
  accessible status announcements rather than creating parallel VR state.

Exit gate:

- Tests prove bounded seeded VR sequences, cycle semantics, incomplete-cycle
  exclusion, one-count-per-timeout fidelity, and that schedule selection alone
  never changes creature behavior. The required assessment-to-VR path passes
  an integration test.

### Milestone 6 — Optional extinction effects and evidence rules

**Outcome:** A learner can skip or observe a seeded extinction round, and the
application characterizes only effects supported by the event log.

Deliverables:

- Gate extinction behind completed VR and frame it as an optional educational
  demonstration, not a recommendation or practice task.
- Implement parameterized, seeded transitional behavior with documented
  known burst and no-burst seeds; do not encode a narrative burst flag.
- Implement event-derived reinforcer-evidence and extinction-burst detection
  rules, including short-reference-window indeterminacy.
- Add accurate language for burst, no burst, and too-short-to-characterize
  outcomes. Do not call ordinary decrease or satiation "extinction," and do
  not call response variation or reappearance "resurgence."

Exit gate:

- Tests cover constructed burst/no-burst/indeterminate logs independently of
  the behavior model, known model seeds for burst and no-burst outcomes, and
  all preferred-stimulus-versus-reinforcer wording branches.

### Milestone 7 — Shared summary, debrief, and Advanced visualizations

**Outcome:** Both modes present equivalent conclusions from one event-derived
summary, with Advanced detail and accessible chart alternatives.

Deliverables:

- Define one mode-neutral session summary covering assessment accuracy,
  evidence of reinforcement, intended versus implemented schedules, fidelity,
  latency/errors, CRF/VR trends, satiation, and optional extinction effects.
- Map that summary to Simple plain-language copy and Advanced ABA terminology;
  keep essential teaching in the main flow rather than tooltips.
- Produce project-owned cumulative-record and response-rate chart data from
  events. Render it through the visx adapter only in the chart-view layer.
- Generate text summaries and accessible data tables from the exact same
  chart-data objects.
- Add the Advanced live event table without exposing mutable simulation state.

Exit gate:

- Summary/debrief tests assert equivalent conclusions across modes, correct
  terminology, metric edge cases, and consistency among graph, table, text,
  and event log. Screen-reader and keyboard checks cover debrief navigation.

### Milestone 8 — Complete learner flow and release-candidate hardening

**Outcome:** The complete v1 path is ready for learner testing and formal
content/accessibility review.

Deliverables:

- Finish onboarding, explicit educational boundaries, navigation, progress,
  restart/lost-session messaging, responsive/touch layout, visual polish, and
  constructive coaching.
- Complete E2E coverage for onboarding → assessment → baseline → CRF → VR →
  debrief, optional extinction, mode switching, timing controls, background
  pausing, reduced motion, keyboard-only use, and accessible chart
  alternatives.
- Run a documented cohort of seeds with tolerant assertions for learning
  trends and probabilistic extinction outcomes.
- Measure the full required path at 1x and tune simulation configuration only
  through documented `SimConfig` changes. Give special attention to the
  10-second due window, CRF/VR coaching pauses, and the 10–20 minute session
  target.
- Complete automated WCAG checks and manual keyboard, screen-reader, touch,
  reduced-motion, non-color-cue, contrast, and 0.5x fairness reviews.
- Prepare moderated Simple/Advanced learner sessions and qualified
  behavior-analytic SME review. Treat misconceptions and conclusion
  mismatches as release-blocking defects.

Exit gate:

- All learner-testing criteria in the product spec pass. Public release
  remains gated on SME review, representative usability sessions, learning
  objective checks, and manual accessibility review.

## 4. Dependency Path

The primary dependency order is:

`scaffold → event/replay foundation → assessment → baseline/learning → CRF → VR → extinction → shared debrief → release hardening`

Visual design, copy drafting, and accessibility review can proceed alongside
simulation milestones, but final wording and charts depend on the shared
summary contract. Deployment planning remains deferred and is not on the v1
implementation critical path.

## 5. Cross-Cutting Definition of Done

A milestone is complete only when:

- Behavior changes include deterministic tests at the appropriate unit,
  integration, or E2E layer.
- New displayed facts, metrics, tables, graphs, and debrief claims derive from
  the event log; no parallel mutable summary state is introduced.
- Timing uses simulated milliseconds, records clock-affecting commands, and
  behaves equivalently at 0.5x and 1x for equivalent simulated-time actions.
- Simple/Advanced switching changes presentation only and never resets or
  alters the simulation.
- Interactive states are keyboard/pointer/touch operable, textually
  announced, reduced-motion safe, and not communicated by color alone.
- ABA terminology agrees with the glossary and the experience continues to
  state its educational, non-clinical boundary.
- Relevant docs and `configVersion` are updated when event shapes, thresholds,
  assumptions, or architectural decisions change. Hard-to-reverse changes
  receive an ADR.
- Available format, lint, type-check, unit, integration, and relevant E2E
  commands pass, with unavailable or manual checks reported at handoff.

## 6. Planning Risks and Decision Checkpoints

| Checkpoint | Why it matters | Resolve by |
|---|---|---|
| Command-result signature | Resolved by ADR 0008 and implemented with typed, atomic command results. | Resolved |
| Replay/config lookup contract | Resolved by ADR 0009 and implemented with version-aware replay rejection. | Resolved |
| Learning-model calibration | The central causal invariant must remain true while behavior changes are visible within a short session. | Milestones 3–5, then cohort tuning in Milestone 8 |
| Due-window and session-length tuning | A short due window can unfairly lower fidelity, while long coaching paths can exceed the session budget. New input from Milestone 6 calibration: the extinction round's burst-detection accuracy assumes comfortably more than `burstDetectionWindowMs` (90s) of simulated time after the first withheld criterion elapses inside the round; no production extinction-round-duration constant exists yet (Milestone 7/8 work), and whatever one is chosen must give the detection window room to complete, not merely exceed it. | First playable CRF/VR slice; extinction-round duration and finalize in Milestone 8 |
| Learner-facing copy | Small wording errors can collapse preferred stimulus into reinforcer or overstate extinction outcomes. | Draft with each slice; SME gate before public release |
| Accessibility under live timing | Announcements, focus behavior, and large controls must remain usable without changing scoring semantics. | Test in every timed slice, not only at release |
| Probabilistic expectations | Idealized response curves and bursts must not be required for every seed. | Document cohort and tolerances by Milestone 6 |
| `nowMs` wiring for live charts | `buildCumulativeRecordChartData` and `buildResponseRateChartData` (Milestone 7) default their time extent to the latest logged event; a live, still-open round left idle understates its own duration and so overstates its displayed rate unless the caller passes `state.elapsedSimMs` explicitly. Resolved: the Advanced-mode `TrainingScreen` wiring passes `state.elapsedSimMs` explicitly, with a regression test constructing an idle open round and asserting against the buggy default. The debrief screen (not yet built) must follow the same pattern. | Resolved for live training; verify again when the debrief screen is built |
| Extinction-transition state | Resolved. `learning.ts`'s `computeResponseRatePerMinute` has a real, seeded extinction-transition burst term (`extinctionBurstPrimed`/`extinctionBurstMagnitudeScale`, drawn once per creature), active only when `phase === 'extinction'`. `evidence.ts`'s `detectExtinctionBurst` has separate `burstMinReferenceResponses`/`burstMinDetectionResponses` sample-count floors (a single shared floor barely moved the false-positive rate; splitting by window did), plus a widened `burstDetectionWindowMs` (30s → 90s) and a re-centered `extinctionBurstPeakDelayMs` (15s → 35s, mid-window rather than near the start). Two calibration passes were needed: the first (floor split alone) cut the unprimed false-`burst` rate from ~28% to ~4% but, because the model's default 2-4/min rates rarely produce 6 responses in a 30s window, pushed ~65-70% of *all* live runs into `indeterminate` — nearly eliminating the documented "no burst occurred, bursts are not inevitable" debrief message (data-model.md §5) as a live outcome, not just the false positives. The second pass (window + peak-delay retune) fixed that: measured over a 150-seed cohort at current defaults, primed burst detection is ~61%, unprimed false-burst is ~10% (up slightly from the interim ~4%, still far below the original ~28-30%), and both `burst` and `no-burst-in-this-run` are common, reachable live outcomes (`extinction-transition.test.ts` asserts these bounds so they can't silently drift). Known, accepted residual: `responseRateCeilingPerMinute` (20/min, calibrated for ordinary CRF/VR responding) clamps a primed burst's true peak in ~6% of primed sessions at the chosen gain (20) — see `extinctionBurstMagnitudeGainPerMinute`'s doc comment in `config.ts` for the detection-vs-clamp tradeoff at higher gains. | Resolved |

## 7. Recommended Next Implementation Increment

Implement Milestone 5 as the next vertical slice, extending the same
`TrainingScreen`, event projectors, coaching language, and cycle machinery
Milestone 4 built rather than creating parallel VR state:

1. generate deterministic shuffled `[2, 3, 4]` requirement blocks (mean of
   three) and response counting per cycle,
2. implement eligibility cues and cycle reset semantics,
3. handle premature/late delivery, overruns, missed criteria, abandoned
   cycles, and incomplete end-of-round cycles the same way Milestone 4 does,
4. end the round only after six completed on-schedule cycles, and
5. verify bounded seeded VR sequences, cycle semantics, incomplete-cycle
   exclusion, and that schedule selection alone never changes creature
   behavior, plus an assessment-to-VR integration test.

This is the last piece of required-path interaction work before the shared
debrief (Milestone 7) and release hardening (Milestone 8).
