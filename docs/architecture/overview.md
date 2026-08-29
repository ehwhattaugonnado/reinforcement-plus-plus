# Architecture Overview

See also: [product spec](../product-spec.md) · [core loop](../core-loop.md) · [data model](./data-model.md) · [accessibility](../accessibility.md) · [testing strategy](../testing-strategy.md) · [ADR index](../adr/README.md)

## Technology stack

Use Vite, React, and TypeScript. V1 has no backend; all session state is held
in memory. GitHub Pages hosts the development preview; approval of that preview
as the public-release target remains gated on the release criteria in the
product specification.

## Simulation core and React shell

The simulation core (`src/sim/`) is plain TypeScript with no React or DOM
dependencies. It owns the controlled clock, seeded RNG, schedule policy,
creature learning model, event classification, immutable snapshots, and
summary derivation.

Its public API is intentionally small:

```ts
createSession(options: { seed?: string; speed?: 0.5 | 1; config?: Partial<SimConfig> }): SimSession
replay(seed: string, events: readonly SimEvent[], config?: Partial<SimConfig>): ReplayResult

presentNextPair(): CommandResult
recordObservedSelection(stimulusId: string | null): CommandResult
startRound(round: 'baseline' | 'crf' | 'vr' | 'extinction'): CommandResult
deliverStimulus(stimulusId: string): CommandResult
finishSession(): CommandResult
tick(realDtMs: number): CommandResult
setPaused(paused: boolean): CommandResult
setSpeed(speed: 0.5 | 1): CommandResult
getSnapshot(): SessionState
subscribe(listener: () => void): () => void
```

Every command returns a discriminated `CommandResult`. A rejected command
appends no events, mutates no state, notifies no subscribers, and consumes no
RNG draws, so a rejection can never perturb deterministic replay. See
[ADR 0008: typed command results](../adr/0008-typed-command-results.md) for the
result and rejection-reason shapes. `replay` resolves the `SimConfig` for a log
under the rules in
[ADR 0009: replay config resolution](../adr/0009-replay-config-resolution.md).

Replay reconstructs event-sourced state **as of the last recorded event**, so the replayed
`elapsedSimMs` equals that event's `at`. A tick that generates no events is
deliberately not recorded — there is nothing about it to reconstruct — which
means a live snapshot taken mid-interval is ahead of its own log by design.
Compare a live session against its replay at an event boundary, not after a
bare `tick`. The live controlled-clock cursor is ephemeral runtime state
between event boundaries, not a second source for historical facts: events
carry their authoritative simulated timestamps, and every metric, chart,
table, debrief conclusion, and replay projection derives from those events.
See ADR 0001 for this clarified boundary.

Commands do not accept or expose mutable creature state. CRF
`deliverStimulus` classifies each delivery against the current response and
the single outstanding schedule criterion (`src/sim/crf.ts`), including the
associated `responseId` when one exists; contingency, timing, and schedule
fidelity are derived independently, and `session.ts`'s `tick` walks response
generation and due-window abandonment together so a due window contributes at
most one `criterion-missed`/`cycle-abandoned` pair. VR's own ratio-requirement
criteria were replaced by ADR 0010's session-wide running-average model. Live
play now classifies `premature`, `overrun`, and `not-variable` deliveries and
derives a trial-by-trial reinforcement history. The `config` option
exists for tests and fixtures only; the React shell always constructs a
session with the
[configuration constants](./data-model.md#6-configuration-constants) defaults.

The React shell (`src/app/`) uses `useSyncExternalStore` through a
`useSimState()` bridge. Components render snapshots and send commands; no
simulation rule lives in a hook or component. Production components must not
import `DEFAULT_SIM_CONFIG` to re-run gates or thresholds. The current
`TrainingScreen` and the current app-layer debrief projector still do so for
progress, coaching, and evidence projections; that is known boundary cleanup,
not the intended architecture. Configured core projectors or snapshot fields
should supply those display facts while the shell continues to create sessions
with defaults.

The `useSimState` bridge throttles *rendering*, never the clock: the core
still advances on every animation frame, but the hook collapses the snapshot
to a presentation quantum (`RENDER_QUANTUM_MS`) and returns the cached
snapshot in between, so React reconciles a few times a second instead of
sixty. `elapsedSimMs` keeps full precision inside the core, commands read
live state, and no simulated timing window is affected (ADR 0005).

Browser visibility changes automatically pause the controlled simulation
clock. `tick` receives elapsed wall-clock time; the core caps unexpected
deltas and applies the selected speed to produce simulated time. Returning to
a backgrounded tab therefore cannot silently advance an entire round.
Reaching `crfCoachingPauseMs` or `vrCoachingPauseMs` without the corresponding
gate also appends one automatic `paused` event; each coaching pause fires at
most once per round and the learner explicitly resumes. Because the session
can therefore stop without being asked, the shell surfaces *why* it stopped
(`PauseReason`) and offers an in-round resume; the reason is presentation
state and never reaches the core. While paused, every log-mutating command
is rejected (ADR 0011).

The UI owns `mode: 'simple' | 'advanced'`; mode never changes sim behavior.
Accessibility speed is different: it is an explicit sim input because it
changes simulated timing windows in a controlled, testable way.

Command validity and the separation between what a response makes eligible
and what the creature actually experiences follow the invariant described in
[ADR 0003: eligibility vs. experienced consequences invariant](../adr/0003-eligibility-vs-experienced-consequences-invariant.md).

## Screens

This list describes the approved v1 screen ownership. `AppShell`,
`AssessmentScreen`, and the baseline/CRF/VR portions of `TrainingScreen`
(including its Advanced-mode live cumulative-record chart, response-rate
chart, event table, and VR reinforcement-history table) are currently wired.
Extinction timing/completion, mode-specific training copy, and a basic shared
`DebriefScreen` are wired. Onboarding and the complete mode-neutral summary
contract remain implementation work.

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

## Graphing

Use visx for rendering, behind project-owned chart-data and chart-view
interfaces so debrief logic is not coupled to the library.

The primary schedule visualization is a cumulative response record: time on
the x-axis, cumulative responses on the y-axis, and stimulus
deliveries/event annotations overlaid. Slope communicates response rate more
legibly in a short session than a noisy raw-rate line. Advanced mode also
shows derived response rate by round and the underlying accessible event
table. See the [derived metrics](./data-model.md) section of the data model
for how these values are computed from the event log.

Visx preserves flexibility for a future Standard Celeration Chart, but v1
does not implement or partially emulate that chart.

## Error handling and illegal states

Prefer discriminated unions and phase-specific commands so illegal states are
unrepresentable where practical. Commands issued in the wrong phase return a
typed `CommandResult` rejection ([ADR 0008](../adr/0008-typed-command-results.md))
and append no partial event — see the
[SimEvent union](./data-model.md) in the data model for the event shapes this
protects. The UI prevents duplicate starts and explains unavailable actions.
Unexpected UI errors show a recoverable restart option; because v1 has no
persistence, restarting clearly states that the current session will be
lost.
