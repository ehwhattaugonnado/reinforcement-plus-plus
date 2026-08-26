# Accessibility Requirements

See also: [Product Spec](./product-spec.md) ·
[Architecture Overview](./architecture/overview.md) ·
[Data Model](./architecture/data-model.md) ·
[ADR 0005: Speed as Simulation Input](./adr/0005-speed-as-simulation-input.md)

## Input and interaction

- All actions are operable by keyboard, pointer, and touch.
- The stimulus-delivery control has a large target and a documented keyboard
  shortcut that does not conflict with browser or assistive-technology keys.
- Pause and 0.5x speed controls are always available during timed rounds.
- Focus order, status announcements, labels, and contrast meet WCAG 2.2 AA
  expectations.

## Perception

- Reduced-motion preferences replace nonessential motion with state changes;
  required selection/response information is also presented textually.
- Mood, eligibility, and fidelity never rely on color alone.
- Every graph has a text summary and accessible data-table equivalent.

## Timing fairness

- Timing scores are normalized to simulated time so using the slower setting
  does not reduce the learner's result.

This "no scoring penalty at 0.5x" requirement is not a UI-layer adjustment —
it is implemented structurally, by measuring delivery promptness and schedule
fidelity against windows defined in simulated time
(`promptDeliveryWindowMs`, `reinforcementDueWindowMs`) rather than wall-clock
time. Those windows are deliberately *not* rescaled by the `speed` setting —
they stay fixed in simulated milliseconds. Fairness instead comes from how
simulated time maps to wall-clock time: at 0.5x, a 1,500-simulated-ms window
already occupies 3,000 wall-clock ms, so a player running at 0.5x gets twice
the real time to act for the same simulated-time deadline, without the
deadline itself being loosened. See the `SimConfig` constants table in
[Data Model](./architecture/data-model.md) and the rationale in
[ADR 0005](./adr/0005-speed-as-simulation-input.md) for the mechanism behind
this guarantee.
