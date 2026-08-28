# Testing Strategy

**Implementation status (2026-08-28):** Vitest currently covers the simulation
foundation, paired assessment, baseline/learning model, CRF cycle
classification and acquisition/coaching gates, evidence rules, the live
seeded extinction-transition burst model and its detector (including known
burst/no-burst/indeterminate seeds and cohort-level causal/tolerance
assertions), VR running-average classification, the fixed-ratio-in-disguise
check, VR progress/history, chart data, chart views, and shell/screen
integration. Playwright covers shell smoke, pause/speed controls, keyboard
operation, and automated
axe checks. The extinction timing/finish contract and a basic shared debrief
screen are now present; comprehensive summary/conclusion parity tests, the
complete learner-path E2E, background-pausing E2E coverage, reduced motion,
and manual accessibility review remain open. Background auto-pause is
implemented in `useSimState`; it is the browser-level regression coverage that
remains open.

See also: [Product Spec](./product-spec.md) · [Core Loop](./core-loop.md) ·
[Architecture Overview](./architecture/overview.md) ·
[Data Model](./architecture/data-model.md)

## Simulation tests (Vitest)

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
- CRF and VR coaching thresholds append exactly one replayable `paused` event,
  remain paused until explicit resume, and do not immediately re-pause.
- Both extinction-burst and no-burst paths using known seeds.
- Extinction emits live withheld-response criteria, lasts 150 simulated
  seconds, and permits `finishSession()` only after completion; the same
  command skips directly from completed VR to debrief without an extinction
  span.
- Summary and debrief rules, including correct use of "preferred stimulus"
  versus "reinforcer."

Probabilistic shape expectations are evaluated across a documented cohort of
seeds with tolerant statistical/property assertions. Tests must not require
every individual run to exhibit an idealized textbook curve.

## React and end-to-end tests

Use React Testing Library for screen/state integration and a small end-to-end
suite for the complete onboarding -> assessment -> baseline -> CRF -> VR ->
debrief path. Cover mode switching mid-session, pause/speed behavior,
background-tab pausing, keyboard-only operation, reduced motion, and the
accessible chart alternative. Include automated accessibility checks, while
recognizing that they do not replace manual testing.
