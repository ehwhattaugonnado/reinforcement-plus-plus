# ADR 0001: Event-sourced session state

**Status:** Accepted
**Date:** 2026-08-25

## Context

Graphs, the data table, summary statistics, and debrief text all need to describe "what happened" during a session, and a seeded session must be exactly replayable from seed + event log alone (this is an acceptance criterion, see [../testing-strategy.md](../testing-strategy.md)). We need a single, trustworthy record of what happened rather than several derived stores that could drift from each other.

## Decision

The simulation core keeps an append-only event log as the sole source of truth for historical session facts (see [../architecture/data-model.md](../architecture/data-model.md) for the `SimEvent` union). Every public command that changes replay-relevant clock behavior — including `setPaused` and `setSpeed` — appends an event; every simulated outcome is recorded with its authoritative simulated timestamp. A `tick` that produces no event may advance the live controlled-clock cursor without appending a clock-sample event. That cursor is ephemeral runtime state between event boundaries: replay reconstructs the state at the last recorded event, not an arbitrary later animation frame. It must never be used as a parallel source for a metric, graph, table, debrief conclusion, or replay fact. `session-started` stamps a `configVersion` so an old log is never reinterpreted under new thresholds. All summary statistics (assessment accuracy, contingent-delivery rate, prompt-delivery rate, schedule fidelity, response rate by phase) are computed from the event log rather than maintained as a second mutable data path.

## Consequences

- Graphs, tables, statistics, and debrief text are guaranteed consistent with each other because they all derive from the same log.
- Deterministic replay from seed + event log is possible at event boundaries, which is required for the testing strategy and useful for debugging and future review features. A live snapshot after an eventless tick is intentionally ahead of its replay until another event records the new time boundary.
- The event log can grow large over the course of a session; this is bounded in practice because sessions are short (10–20 minutes), but it remains a discipline that must be revisited if session length assumptions change.
- Every derived metric must be recomputed or memoized rather than incrementally maintained, which is an ongoing implementation discipline cost — it is easy to accidentally introduce a second mutable path if this isn't enforced.
- Config must be versioned (`configVersion`) for replay to be meaningful, which is a small but permanent bit of bookkeeping every config change has to respect.
