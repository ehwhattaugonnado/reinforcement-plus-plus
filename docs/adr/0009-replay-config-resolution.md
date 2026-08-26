# ADR 0009: Replay resolves configuration from the log's `configVersion`

**Status:** Accepted
**Date:** 2026-08-26

## Context

[ADR 0001](0001-event-sourced-session-state.md) makes seed plus event log
sufficient to reconstruct a session, and the
[data model](../architecture/data-model.md) stamps a `configVersion` into
`session-started` "so an old log is never silently reinterpreted under new
thresholds." It does not say how replay _resolves_ the `SimConfig` that a given
`configVersion` names. The [roadmap](../roadmap.md) flags this as a Milestone 1
checkpoint because every derived metric, and therefore every later milestone's
tests, depends on which thresholds a replay applies.

Three options were considered: embed the full config in `session-started`;
keep a registry of historical configs; or resolve only the current version and
refuse anything else.

Embedding the whole config makes every log self-describing but bloats the event
that most tests construct by hand, and invites logs that disagree with the
documented defaults with no way to tell a typo from a deliberate override. A
registry of historical configs is real maintenance burden for a v1 with no
persistence — there are no old logs to be compatible with, because
[ADR 0006](0006-no-v1-persistence.md) means no log outlives its tab.

## Decision

`configVersion` is a short opaque string constant exported alongside the
`SimConfig` defaults. It is bumped whenever any default value, or the meaning of
any field, changes.

Replay resolves configuration as follows:

- `replay(seed, events)` with no explicit config resolves the **current**
  `DEFAULT_SIM_CONFIG`, and **rejects** the log if its `session-started`
  `configVersion` does not match the current `configVersion`. The rejection is a
  typed result in the same shape as [ADR 0008](0008-typed-command-results.md),
  with reason `config-version-mismatch`. There is no historical registry and no
  silent reinterpretation.
- `replay(seed, events, config)` with an explicit config applies exactly that
  config and does not compare versions. This is the fixture path: tests that
  override thresholds pass the same override to `createSession` and to
  `replay`, and get bit-identical results.
- A config override supplied to `createSession` produces a `configVersion` of
  `` `${configVersion}+override` `` in `session-started`, so an overridden log is
  never mistaken for a default-config log and can never be replayed by the
  no-config path.

## Consequences

- Replay equivalence is testable without any version bookkeeping: same seed,
  same events, same config in, identical snapshot out.
- Bumping `configVersion` during Milestone 8 tuning invalidates saved fixture
  logs by design, surfacing exactly the tests whose expectations encode the old
  thresholds instead of letting them pass under changed meanings.
- V1 loses the ability to replay a log produced by an earlier build. Because
  v1 has no persistence and no sharing, no such log exists outside a test
  fixture, and the fixture path takes an explicit config.
- If a future version adds log sharing or persistence, this ADR is superseded by
  one that adds a historical config registry or self-describing logs. The
  `configVersion` field already in the event shape is the hook for that.
