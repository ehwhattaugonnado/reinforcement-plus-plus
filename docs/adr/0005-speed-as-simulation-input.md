# ADR 0005: Speed is an explicit simulation input, not a cosmetic UI multiplier

**Status:** Accepted
**Date:** 2026-08-25

## Context

Accessibility requires a 0.5x speed control that carries no scoring penalty, alongside reduced-motion and slower-pacing support (see [../accessibility.md](../accessibility.md)). A naive implementation would apply speed only as a UI-side playback-rate hack (e.g., scaling a CSS animation duration or a `setTimeout`), which would be cheap but would not satisfy the fairness requirement or be testable or replayable.

## Decision

Speed (`0.5 | 1`) is a first-class field of `SessionState` and a simulation command (`setSpeed`), not a UI concern; every change appends a `speed-changed` event (see [../architecture/data-model.md](../architecture/data-model.md)). Timing windows such as `promptDeliveryWindowMs` (1500ms) are fixed in *simulated* time and are deliberately not scaled a second time by the speed setting: at 0.5x, 1500 simulated ms already occupies 3000 wall-clock ms, which is what gives the learner more real time to act. Re-scaling the threshold itself on top of that would make the prompt-delivery-rate metric easier to satisfy at 0.5x than at 1x, breaking comparability of results across speed settings and undermining the "no scoring penalty, but also no scoring bonus" fairness goal. `tick()` receives elapsed wall-clock time; the core applies speed and caps deltas (`maxTickDeltaMs=250`) to derive simulated time.

## Consequences

- Prompt-delivery rate is provably invariant across 0.5x and 1x for the same simulated-time behavior, and this has a dedicated test.
- Replay from seed + event log works regardless of what speed was used when `tick` was called, consistent with ADR 0001.
- This requires every timing rule in the simulation to be written in terms of simulated milliseconds and threaded correctly through `tick()`, which is a stricter discipline than a UI-side multiplier and increases the surface area a contributor must get right when adding any new timing-sensitive rule.
