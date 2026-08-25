# ADR 0002: Framework-independent simulation core

**Status:** Accepted
**Date:** 2026-08-25

## Context

The simulation's rules — schedules, the creature learning model, extinction, burst detection, timing — need to be exhaustively unit-tested with deterministic seeds (see [../testing-strategy.md](../testing-strategy.md)), independent of rendering. Coupling this logic to React would make headless testing harder and would foreclose future reuse of the simulation (a different UI, or the sim in isolation).

## Decision

`src/sim/` is plain TypeScript with no React or DOM dependencies. It owns the controlled clock, seeded RNG, schedule policy, creature learning model, event classification, immutable snapshots, and summary derivation, and exposes a small command/snapshot-based public API: `createSession`, `presentNextPair`, `recordObservedSelection`, `startRound`, `deliverStimulus`, `tick`, `setPaused`, `setSpeed`, `getSnapshot`, `subscribe`. The React shell in `src/app/` (see [../architecture/overview.md](../architecture/overview.md)) consumes this through `useSyncExternalStore` via a `useSimState()` bridge; components render snapshots and send commands. No simulation rule lives in a hook or component.

## Consequences

- Simulation logic can be tested with Vitest against deterministic seeds with no rendering environment required, which keeps the test suite fast and precise.
- The simulation is decoupled from the UI framework, leaving room for a different UI or headless reuse later without touching `src/sim/`.
- This introduces an extra indirection layer — the subscribe/snapshot bridge — that a purely React-hooks-based implementation would not need.
- It requires ongoing discipline to keep all rules out of components as the UI grows; nothing mechanically prevents a future contributor from reaching for local component state to implement "just one small rule."
