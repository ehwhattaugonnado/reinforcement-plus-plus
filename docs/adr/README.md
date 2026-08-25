# Architecture Decision Records

ADRs capture significant, hard-to-reverse architectural decisions made for this project and the trade-offs accepted along with them.

See also: [../architecture/overview.md](../architecture/overview.md), [../architecture/data-model.md](../architecture/data-model.md)

| # | Title | Decision |
|---|-------|----------|
| 0001 | [Event-sourced session state](0001-event-sourced-session-state.md) | All session state — graphs, tables, statistics, debrief — derives from a single append-only event log; there is no second mutable data path. |
| 0002 | [Framework-independent simulation core](0002-framework-independent-simulation-core.md) | The simulation lives in plain TypeScript with no React/DOM dependencies, exposed through a small command/snapshot API and a `useSimState()` bridge. |
| 0003 | [Eligibility vs. experienced consequences invariant](0003-eligibility-vs-experienced-consequences-invariant.md) | The selected schedule controls reinforcement eligibility only; creature behavior is driven solely by actually experienced consequences, never by the selected schedule label. |
| 0004 | [Simple/Advanced as a UI-only toggle](0004-simple-advanced-as-ui-only-toggle.md) | Simple and Advanced modes run one shared simulation and event history; only labels, explanations, and exposed detail differ. |
| 0005 | [Speed as a simulation input](0005-speed-as-simulation-input.md) | Playback speed is a first-class simulation field and command, with timing windows fixed in simulated time so 0.5x carries no scoring penalty or bonus. |
| 0006 | [No v1 persistence](0006-no-v1-persistence.md) | v1 has no storage layer of any kind — no localStorage, no backend, no cross-session save; every session starts fresh. |
| 0007 | [visx behind adapter interfaces](0007-visx-behind-adapter-interfaces.md) | Charting uses visx, but only behind project-owned `chart-data`/`chart-view` interfaces so debrief logic stays decoupled from the charting library. |
