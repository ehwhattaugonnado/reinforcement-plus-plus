# ADR 0011: Log-mutating commands are rejected while the session is paused

**Status:** Accepted
**Date:** 2026-08-29

## Context

While a session is paused, simulated time does not advance and no responses
are emitted, but `deliverStimulus` validated only the stimulus id and the
phase. A delivery issued during a pause therefore reached the classifier with
a frozen clock and no recent response to be contingent on, so it was recorded
as `contingency: 'noncontingent'` and counted permanently against the learner
in the debrief's contingent-delivery rate (see
[../architecture/data-model.md](../architecture/data-model.md) sections 3
and 5).

The learner does not always cause the pause, and cannot always see it coming.
The shell pauses on `visibilitychange` when the tab is backgrounded, and the
simulation pauses *itself* at the one-time CRF and VR coaching thresholds
(`reason: 'coaching'`). A stop the learner neither chose nor noticed could
thus produce a permanent fidelity penalty, which is both pedagogically wrong —
[ADR 0003](0003-eligibility-vs-experienced-consequences-invariant.md) makes
experienced consequences the thing that matters, and no consequence was
experienced — and contrary to the punishment-free tone the product requires.

The same reasoning is not specific to deliveries. Every other command that
appends to the log would stamp its event with an `at` taken from a stopped
clock, and `presentNextPair` would additionally draw from the seeded behavior
RNG on the committed path.

[ADR 0008](0008-typed-command-results.md) states, in its Decision section,
that "a paused `tick` is accepted with an empty event list, so `paused` is not
a rejection reason." This ADR amends that sentence. What survives unchanged is
the `tick` half: a tick while paused is still accepted and still advances
nothing, because the shell drives ticks from an animation frame that does not
stop on pause. What changes is the second clause: `paused` now *is* a
rejection reason, for log-mutating commands only.

## Decision

While `state.paused` is true, every command that appends to the event log is
rejected with the new `CommandRejectionReason` member `'session-paused'` and
appends nothing, in keeping with the atomic-rejection rules of ADR 0008. The
invariant is a single sentence:

> While paused, no command appends anything to the event log except
> `setPaused` and `setSpeed`.

Guarded (the check runs before each command's own validation, so a paused
session reports why it is stopped rather than a phase or argument error):

- `deliverStimulus` — the defect above. A frozen clock cannot support an
  honest contingency, timing, or schedule-fidelity judgment.
- `startRound` — appends a `phase-changed` (and possibly a `cycle-abandoned`)
  boundary that every round-window metric is measured from, and would open a
  timed round against a clock that is not running.
- `finishSession` — appends the final `phase-changed` boundary that closes a
  timed round. Guarded for the same reason as `startRound`, and because a
  split rule would be harder to state than it is worth: nothing is lost by
  requiring a resume first.
- `presentNextPair` — untimed in itself, but it is the one command that draws
  from the seeded RNG on its committed path. Guarding it is what keeps ADR
  0008's "a rejection consumes no RNG draws" property true for the paused
  case.
- `recordObservedSelection` — also untimed, and guarded for consistency
  rather than necessity. Under a stated default of "log-mutating means
  guarded," an argument that a guard is *unnecessary* is not an argument that
  it is *harmful*, and one stated invariant is worth more than a per-command
  rule the next contributor has to rediscover.

Left operable:

- `setPaused` — `setPaused(false)` is how a learner leaves the paused state.
  Guarding it would strand the session.
- `setSpeed` — speed is a recorded simulation input
  ([ADR 0005](0005-speed-as-simulation-input.md)), and adjusting pace while
  stopped is exactly what an accessibility control is for. Its
  `speed-changed` event carries the frozen timestamp correctly: no simulated
  time passed.
- `tick` — unchanged. Accepted while paused, advancing nothing and appending
  nothing.

Nothing is stranded in any phase by this: `SessionControls`, which owns the
pause and speed controls, is rendered from `AppShell` in every phase, so
`setPaused(false)` is always reachable.

## Consequences

- A learner is never penalized in the debrief for a stop they did not cause
  and could not see. A paused delivery now produces a typed rejection the
  shell can explain, instead of a permanent `noncontingent` mark.
- Deterministic replay is unaffected. A rejection appends no event, mutates no
  state, consumes no RNG draws, and notifies no subscribers, so a log produced
  with rejected paused commands in it is byte-identical to one produced
  without them, and replays to the same snapshot. This has a dedicated test.
- The React shell gains one more reason to map to learner-facing copy.
  `'session-paused'` is the first rejection reason that is not about phase,
  argument, or a gate, and an unhandled one will read as a silent no-op at the
  call site — a real risk given that ADR 0008 permits `void`-discarding a
  result.
- The guard is a uniform precondition rather than a per-command rule, which
  means a future log-mutating command is expected to carry it. The cost is
  that the rejection reason is coarser: a paused delivery of an unknown
  stimulus now reports `'session-paused'` rather than `'unknown-stimulus'`.
