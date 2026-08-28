# ADR 0008: Simulation commands return typed results and reject atomically

**Status:** Accepted
**Date:** 2026-08-26

## Context

The published simulation API in [../architecture/overview.md](../architecture/overview.md) showed every command returning `void`, while the same document's error-handling section requires that "commands issued in the wrong phase return a typed result and append no partial event," and that "the UI prevents duplicate starts and _explains_ unavailable actions." The [implementation roadmap](../roadmap.md) lists this mismatch as a checkpoint to resolve before Milestone 1, because every later slice's command handling and tests depend on the shape.

A `void` signature cannot satisfy the requirement. Explaining an unavailable action needs a machine-readable reason the React shell can map to copy; a thrown exception would make ordinary, expected learner mistakes (delivering during baseline, double-starting a round) into control flow by exception, and would put the burden of atomicity on every call site.

## Decision

Every public command returns a discriminated `CommandResult`:

```ts
type CommandResult =
  | { ok: true; events: readonly SimEvent[] }
  | { ok: false; reason: CommandRejectionReason; detail?: string }

type CommandRejectionReason =
  | 'wrong-phase'
  | 'duplicate-command'
  | 'not-started'
  | 'already-complete'
  | 'unknown-stimulus'
  | 'invalid-argument'
  | 'baseline-not-complete'
  | 'acquisition-not-met'
  | 'vr-cycles-not-met'
  | 'extinction-not-complete'
```

The completion reasons were added with the baseline-to-CRF, CRF-to-VR,
VR-to-extinction/debrief, and extinction-to-debrief gates. `vr-cycles-not-met`
retains the runtime's legacy “cycles” name; learner-facing documentation calls
the requirement six credited VR deliveries. A paused `tick` is accepted with
an empty event list, so `paused` is not a rejection reason.

Rules:

- A rejected command appends **no** events, mutates no state, consumes no RNG
  draws, and notifies no subscribers. Rejection is atomic and observationally
  invisible in the event log.
- An accepted command appends one or more events and returns them, so callers
  and tests can assert on exactly what a command produced without diffing the
  whole log.
- `CommandRejectionReason` is a closed union owned by the simulation core. The
  React shell maps reasons to learner-facing copy; the core never produces
  display strings. `detail` is an optional developer/diagnostic string and is
  never rendered verbatim to a learner.
- `getSnapshot` and `subscribe` are not commands and keep their existing
  signatures.
- `tick` returns a `CommandResult` like the others. A tick while paused is
  accepted and advances no simulated time rather than being rejected, because
  the shell drives it from an animation frame that does not stop on pause.

## Consequences

- The UI can explain _why_ an action is unavailable without duplicating phase
  rules, satisfying the error-handling requirement and the accessibility
  requirement that state be announced textually.
- Invalid-command atomicity becomes directly testable: assert `ok: false` and
  assert the event log length and RNG state are unchanged. This is a Milestone 1
  exit-gate test.
- Because rejected commands consume no RNG draws, a rejection can never perturb
  deterministic replay.
- Command handlers must validate fully before mutating. The core therefore
  builds candidate events first and commits them in one step, rather than
  mutating incrementally and unwinding on error.
- Callers that ignore the result silently swallow rejections. Call sites in
  `src/app/` must therefore either handle the result or discard it explicitly
  (a `void` prefix), so that ignoring a rejection is always a visible choice in
  the code rather than an oversight.
