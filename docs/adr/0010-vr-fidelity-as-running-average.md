# ADR 0010: VR-3 schedule fidelity is a running-average tolerance, not an exact per-cycle target

**Status:** Accepted
**Date:** 2026-08-28

## Context

Milestone 5's original implementation generated a seeded, shuffled sequence
from `[2, 3, 4]` and required each VR cycle's delivery to land on that
cycle's exact, hidden number to count as `on-schedule` — one response short
or one over and it was `premature` or `overrun`. This is unplayable for a
human: nothing in the UI, and nothing in real VR-3 practice, tells a learner
which exact number is live for the current cycle. A live test run
confirmed it: reinforcing on the second response of a cycle was rejected
because that cycle's hidden target happened to be 3 or 4.

A variable-ratio schedule's defining property is that its *average* stays
near the nominal value while individual cycles vary unpredictably — not that
every cycle hits a predetermined number. Cooper, Heron, & Heward describe VR
schedules by their mean; no real VR-3 implementation, human or automated,
tracks a hidden exact sequence per cycle.

## Decision

VR-3 fidelity is evaluated against a running average of responses-per-
reinforcement across the round, not a per-cycle exact target:

- The average is seeded with `vrAverageSeedCount` (3) phantom entries of
  `vrAverageSeedValue` (3), so early deliveries are judged against a
  reasonable prior instead of wild swings from a near-empty sample.
- On each delivery attempt, compute the gap (responses since the last
  delivery) and the average the round *would* have if this gap were
  accepted. If that hypothetical average falls in
  `[vrAcceptableRatioMin, vrAcceptableRatioMax]` (2-4), the gap joins the
  real history and the delivery is `on-schedule`. Outside that range, it's
  `premature` (average would fall below 2) or `overrun` (above 4) — still
  delivered to the creature (ADR 0003: every experienced consequence still
  reaches the learning model), just not credited toward the round's six
  required cycles.
- There is deliberately **no floor** requiring a minimum response count
  before the first delivery can be accepted. A learner who reinforces the
  very first response of a VR round is judged the same way as any other
  delivery: by whether the resulting average stays in range. This is a
  reversal of an earlier draft of this decision, which proposed a hard
  floor at 2 responses specifically to prevent that case — rejected because
  it reintroduces a hidden per-cycle rule the average model exists to
  remove, and because averaging over a session, not gating every cycle
  individually, is the actual point of a variable-ratio schedule.
- A schedule that averages correctly but never varies is still not VR: if
  the last `vrPatternRepeatThreshold` (3) *real* accepted gaps (the phantom
  seed is excluded, so it can never itself trigger this) are all equal to
  this candidate gap, the delivery is classified `not-variable` instead of
  `on-schedule` — delivered, but not credited. This catches a learner who
  settles into "always reinforce every 3rd response," which averages to
  exactly 3 while being a fixed ratio in disguise.
- VR no longer synthesizes `criterion-met`/`criterion-missed` events or
  uses the single-outstanding-cycle machinery CRF relies on
  (`deriveOutstandingCycle`) — there is no discrete "the schedule is now
  due" instant to open a cycle around under a no-floor average model, only
  a continuous judgment made at the instant of delivery. This was verified
  safe: nothing else in the live event stream depends on VR emitting
  `criterion-met` (extinction's withheld-criterion detection is not wired
  to live play yet, and CRF keeps its own unchanged mechanism).
- Each `stimulus-delivered` event now records which schedule governed its
  classification (`schedule: 'CRF' | 'VR' | null`), stamped directly at
  commit time from the active phase, rather than derived indirectly from a
  paired `criterion-met` event or a round time window. This is a more
  direct and more robust replacement for the time-window/opening-criterion
  cross-check `vrCyclesCompleted` previously needed to disambiguate a
  delivery landing on a round-boundary instant.

## Consequences

- A human learner can now succeed at VR-3 without knowing a hidden number:
  any response count that keeps the round's average near 3 counts, matching
  how the schedule is actually taught and practiced.
- The trade-off is a fixed ratio in disguise (constant identical gaps) must
  be actively detected and excluded (`not-variable`) rather than falling
  out for free the way exact-sequence matching guaranteed it would.
- `SchedulePlan`'s VR variant, `ScheduleFidelity`, and the VR portion of
  `TrainingScreen` all change shape; see `docs/architecture/data-model.md`
  and `docs/core-loop.md` Round 2 for the updated contracts.
- `CONFIG_VERSION` bumps: `vrRequirementBlock` is replaced by
  `vrAcceptableRatioMin`/`vrAcceptableRatioMax`/`vrAverageSeedValue`/
  `vrAverageSeedCount`/`vrPatternRepeatThreshold`.
