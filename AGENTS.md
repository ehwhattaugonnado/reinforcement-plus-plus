# AGENTS.md

## Project

Reinforcement++ is a browser-based pet-training simulation that teaches preference assessment and positive reinforcement. V1 is a 10–20 minute, low-stakes educational experience, not clinical decision support. The repository contains the approved design documentation and an in-progress Vite/React/TypeScript implementation. Milestones 0–6 are complete; Milestone 7's shared debrief screen exists and both presentation modes now reach the same conclusions, but its complete mode-neutral summary is still partial; Milestone 8 release hardening has not started. `DESIGN.md` (at the repo root) records the first full visual-design pass, "The Trial Data Sheet," plus the stopped-state, chart-geometry, rule-grid and control-bar rules added by the 2026-08-29 UI/UX passes (`docs/roadmap.md` §2.1.1 and §2.1.2). Outstanding UI/UX work is listed in §2.1.3 and tracked as GitHub issues. Use `docs/roadmap.md` as the detailed status source.

## Read Before Changing Code

- `docs/product-spec.md`: goals, audience, acceptance criteria, and v1 scope.
- `docs/core-loop.md`: required assessment and training flow.
- `docs/architecture/overview.md`: intended Vite/React/TypeScript boundaries.
- `docs/architecture/data-model.md`: event shapes, metrics, timing, and configuration.
- `docs/testing-strategy.md` and `docs/accessibility.md`: verification requirements.
- `docs/adr/`: accepted decisions. Preserve them unless a change explicitly includes superseding an ADR.
- `docs/aba-glossary.md`: source of truth for behavior-analytic terminology and copy.

Keep these documents consistent when a product or architecture decision changes. Record significant, hard-to-reverse decisions as ADRs rather than silently diverging from the approved design.

`DESIGN.md` is the visual system's source of truth and is authored, not generated. `.impeccable/design.json` is a sidecar derived from it: refresh the sidecar from `DESIGN.md`, never the reverse. Named rules and the do's/don'ts list in `DESIGN.md` are binding on new CSS — in particular the type ramp and the standing ban on `border-left`/`border-right` accents, both of which this codebase has already drifted from once.

## Architecture Invariants

- Use Vite, React, and TypeScript. V1 has no backend, `localStorage`, or other persistence.
- Keep `src/sim/` plain TypeScript with no React or DOM dependencies. It owns the seeded RNG, controlled clock, schedules, learning model, event classification, immutable snapshots, and summaries.
- Keep simulation rules out of components and hooks. The React shell renders snapshots and sends commands through the `useSyncExternalStore` bridge.
- Treat the append-only event log as the sole source of truth. Graphs, tables, metrics, debrief text, and replay must derive from it; do not add parallel mutable summary state.
- Preserve deterministic replay from seed plus event log. Clock-affecting commands, including pause and speed changes, must be recorded, and config changes must update `configVersion`.
- While the session is paused, every command that would append to the event log is rejected with `session-paused`; only `setPaused`, `setSpeed`, and `tick` stay operable (ADR 0011). A delivery against a stopped clock could only ever classify as noncontingent and count against the learner.
- Throttle rendering in the React bridge, never the clock. `useSimState` collapses the snapshot to a presentation quantum so the tree does not reconcile on every animation frame; the core keeps full precision and simulated timing windows are untouched.
- Centralize thresholds in `SimConfig`; the production UI uses defaults and does not read, write, or override them. Test fixtures may override config explicitly.
- Simple/Advanced mode is presentation-only. Both modes share one simulation, event history, and conclusions, and switching modes must not reset or alter behavior. Neither mode may end by pointing at the other; Advanced adds detail (charts, data tables), never a different conclusion.
- Keep visx behind project-owned chart-data/chart-view interfaces. Accessible tables and text summaries derive from the same chart data.

## Simulation and Domain Rules

- The selected schedule controls eligibility only. Creature behavior changes only from consequences actually experienced, including their contingency, latency, stimulus value, and history.
- Model responses as render-frequency-independent events using simulated time. Fixed simulated-time windows are not scaled a second time at 0.5x; the slower speed gives more wall-clock time without changing scores.
- Keep contingency, timing, and schedule fidelity as independent classifications.
- Derive metrics from events. In particular, schedule fidelity counts one completed or abandoned cycle, never both `criterion-missed` and `cycle-abandoned` for the same timeout; incomplete ratios are excluded.
- Call assessment results preferred stimuli or candidate/putative reinforcers. Use “reinforcer” only after the configured event-derived evidence rule shows increased future responding over baseline. Reinforce a behavior/response, not the creature.
- V1 teaches paired-stimulus assessment, baseline, CRF acquisition, guided VR-3 maintenance, and an optional extinction-effects demonstration. Do not describe this as shaping.
- Extinction outcomes are seeded and probabilistic. Detect a burst from the event log; never imply that bursts are inevitable or call ordinary decrease, satiation, or resurgence “extinction.”
- Keep the tone cute, constructive, punishment-free, and explicit about educational boundaries. Public release requires qualified behavior-analytic SME review.
- Do not expand deferred v1 scope (extra schedules, assessment formats, creatures, persistence, customization, negative reinforcement, chaining, or Standard Celeration Charts) without an explicit product decision.

## Quality Bar

- Write deterministic Vitest coverage for simulation rules, replay, derived metrics, known burst/no-burst seeds, time-step invariance, and the central causal invariant.
- Use tolerant cohort/property assertions for probabilistic behavior; do not require every seed to produce an idealized curve.
- Use React Testing Library for UI integration and a small end-to-end suite for the complete required path, mode switching, timing controls, background pausing, and accessibility behavior. Every screen that renders conclusions carries its own axe assertion in both presentation modes.
- Meet WCAG 2.2 AA expectations: keyboard/pointer/touch operation, large delivery target, non-color status cues, reduced motion, textual state announcements, and table/text alternatives for every graph.
- Keep focus order in reading order: the task comes before the timing and presentation controls, at every width. Pause must stay reachable throughout a timed round without hunting back up the page, and anything fixed over the sheet must reserve its own height so it never covers the end of a round. Measure that height at runtime rather than predicting it when it depends on the viewport or on copy the simulation chooses (`useReservedHeight`); a predicted reserve was wrong three times.
- Verify layout, hit-testing, and contrast in a real browser, not only in jsdom. Measure the specific number a change controls, at widths inside each breakpoint band rather than only at its ends, under the longest copy the simulation can produce, and run axe in both colour schemes. See `docs/testing-strategy.md`, "Layout and presentation defects."
- Treat educational misconceptions and Simple/Advanced conclusion mismatches as defects.
- Never let learner-facing copy assert something the event log does not support. Coaching text in particular is derived from metrics, not from the clock that triggered it, and must be able to conclude that nothing is wrong (`src/app/screens/coaching.ts`).
- Keep system units out of learner-facing copy. Raw milliseconds, event ids, and unrounded floats belong in the Advanced event table, not in a sentence addressed to the learner — and even there, round millisecond floats for display; the core keeps full precision.
- Treat a live view as a monitor, not an archive. Anything that grows for the length of a session is windowed where the learner is working, and says how much it is showing; the complete record belongs in the debrief.

## Working Conventions

- Make the smallest change that satisfies the documented requirement; prefer discriminated unions and typed invalid-command results that append no partial event.
- Add or update tests with behavioral changes, and update documentation when assumptions, event shapes, metrics, config defaults, or scope change.
- Do not commit `docs/ref/`; it contains local copyrighted reference material and is intentionally ignored.
- Use npm and the committed `package-lock.json`; do not introduce a second lockfile.

### Before handoff

Run all of these and report any that were unavailable or had to be done by hand:

1. `npm run check` — format, lint, typecheck, unit and component tests.
2. `npm run build`.
3. `npm run test:e2e` — the full Playwright suite. It builds and serves the app itself.
   - `npm run test:e2e:layout` is the subset that measures layout, hit-testing, and contrast in a real browser (`tests/e2e/layout.spec.ts`, `tests/e2e/a11y.spec.ts`). Any change that moves, sizes, fixes, or overlays anything must run it; jsdom has no layout engine, so the unit suite passes whether an element is on screen, off screen, or underneath another one.
4. If you changed a layout constant or added an assertion to those suites, confirm the test bites: break the value it guards and check that it fails.

Do not add a measurement script outside these suites. The scripts that found the 2026-08-29 defects were throwaway files nobody would have run again; they are `tests/e2e/layout.spec.ts` now, and a new measurement belongs there as an assertion.
