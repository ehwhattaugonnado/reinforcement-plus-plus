# ADR 0006: No persistence in v1

**Status:** Accepted
**Date:** 2026-08-25

## Context

The v1 scope explicitly excludes generalization, maintenance across visits, or saved progress (see [../product-spec.md](../product-spec.md)). All session state is held in memory; there is no backend and no deployment target requiring one yet.

## Decision

v1 has no persistence layer of any kind: no `localStorage`, no backend, no cross-session save. Each new session seeds a fresh initial motivating condition. Claims about stimulus-value recovery across visits are explicitly out of scope, because there is nothing in v1 that could persist them. Unexpected UI errors show a recoverable restart option, but restarting clearly states that the current session will be lost, since there is nothing to recover it from.

## Consequences

- An entire class of concerns is removed from v1 scope: schema migration, storage quota, privacy/data-retention handling for what could be sensitive training-record-adjacent data, and sync.
- The simulation core's "seed + event log is sufficient to replay" property (ADR 0001) stays simple and testable, since there is no persisted state to reconcile it against.
- A learner cannot resume an interrupted session or review past sessions later, which limits usefulness for structured multi-session training programs. This is named here explicitly as deferred work, not forgotten.
