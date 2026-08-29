# Accessibility Requirements

**Implementation status (2026-08-29):** The current shell, session controls,
assessment, baseline screen, CRF training (delivery target, keyboard
shortcut, status announcements), and Advanced-mode live views (charts plus an
accessible event table), and VR delivery/history flow include keyboard and
textual alternatives with automated component/browser accessibility checks.
Background auto-pause is implemented but still lacks browser regression
coverage. Extinction completion and the basic shared debrief have keyboard and
text output; comprehensive debrief navigation, reduced-motion E2E coverage,
touch review, screen-reader review, and color/contrast review remain release
work.

The 2026-08-29 UI/UX defect pass (`docs/roadmap.md` §2.1.1) closed three
accessibility-relevant defects, each verified in Chromium at 1440px and
375px with zero axe violations running and paused:

- **A stopped session is now perceivable from the trial content.** Pausing
  previously changed only a button label, an `aria-pressed` value, and one
  sentence, all inside a control margin that is `position: static` below
  50rem and measured 148–671px above the viewport during a round. The
  session can pause *itself* (a backgrounded tab, or either coaching
  checkpoint), so this was a state change with no perceivable signal where
  the learner was working. The sheet now carries `data-paused` and an
  in-round notice names the cause and offers an explicit resume.
- **Layout stability at the moment of interaction.** The delivery target
  moved 24.8px, four times per 25 seconds, as the 1.5s prompt window opened
  — a target moving under the pointer at the instant it must be hit. Now
  measured stable across 60 samples at both widths.
- **Scrollable table regions are keyboard reachable.** `.table-scroll`
  wrappers carry `tabIndex`, a group role, and a name (axe
  `scrollable-region-focusable`, WCAG 2.1.1).

Known residual: chart axis text scales with its container (14.25px at
1440px, 6.23px at 375px). The charts are `aria-hidden` decoration over a
text summary and data table derived from the same chart-data object, so no
information is lost; legibility on small viewports needs a container-driven
viewBox and is tracked as release work.
Automated checks do not replace the manual WCAG 2.2 AA review required before
release.

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
