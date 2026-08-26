# AGENTS.md

## Project

Reinforcement++ is a browser-based pet-training simulation that teaches preference assessment and positive reinforcement. V1 is a 10–20 minute, low-stakes educational experience, not clinical decision support. The repository currently contains the approved design documentation; application scaffolding has not yet been added.

## Read Before Changing Code

- `docs/product-spec.md`: goals, audience, acceptance criteria, and v1 scope.
- `docs/core-loop.md`: required assessment and training flow.
- `docs/architecture/overview.md`: intended Vite/React/TypeScript boundaries.
- `docs/architecture/data-model.md`: event shapes, metrics, timing, and configuration.
- `docs/testing-strategy.md` and `docs/accessibility.md`: verification requirements.
- `docs/adr/`: accepted decisions. Preserve them unless a change explicitly includes superseding an ADR.
- `docs/aba-glossary.md`: source of truth for behavior-analytic terminology and copy.

Keep these documents consistent when a product or architecture decision changes. Record significant, hard-to-reverse decisions as ADRs rather than silently diverging from the approved design.

## Architecture Invariants

- Use Vite, React, and TypeScript. V1 has no backend, `localStorage`, or other persistence.
- Keep `src/sim/` plain TypeScript with no React or DOM dependencies. It owns the seeded RNG, controlled clock, schedules, learning model, event classification, immutable snapshots, and summaries.
- Keep simulation rules out of components and hooks. The React shell renders snapshots and sends commands through the `useSyncExternalStore` bridge.
- Treat the append-only event log as the sole source of truth. Graphs, tables, metrics, debrief text, and replay must derive from it; do not add parallel mutable summary state.
- Preserve deterministic replay from seed plus event log. Clock-affecting commands, including pause and speed changes, must be recorded, and config changes must update `configVersion`.
- Centralize thresholds in `SimConfig`; the production UI uses defaults and does not read, write, or override them. Test fixtures may override config explicitly.
- Simple/Advanced mode is presentation-only. Both modes share one simulation, event history, and conclusions, and switching modes must not reset or alter behavior.
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
- Use React Testing Library for UI integration and a small end-to-end suite for the complete required path, mode switching, timing controls, background pausing, and accessibility behavior.
- Meet WCAG 2.2 AA expectations: keyboard/pointer/touch operation, large delivery target, non-color status cues, reduced motion, textual state announcements, and table/text alternatives for every graph.
- Treat educational misconceptions and Simple/Advanced conclusion mismatches as defects.

## Working Conventions

- Make the smallest change that satisfies the documented requirement; prefer discriminated unions and typed invalid-command results that append no partial event.
- Add or update tests with behavioral changes, and update documentation when assumptions, event shapes, metrics, config defaults, or scope change.
- Do not commit `docs/ref/`; it contains local copyrighted reference material and is intentionally ignored.
- There is no package manifest or canonical command set yet. After scaffolding, use the repository’s chosen lockfile and `package.json` scripts; before handoff, run all available formatting, type-check, unit, and relevant end-to-end checks and report anything unavailable.
