# ADR 0007: Charting library isolated behind project-owned interfaces

**Status:** Accepted
**Date:** 2026-08-25

## Context

Advanced mode needs a cumulative-record graph (time x cumulative responses, with delivery/event annotations) and a response-rate-by-round graph, and a Standard Celeration Chart is a deferred, out-of-v1-scope future feature. Every graph also needs an accessible text summary and data-table equivalent per [../accessibility.md](../accessibility.md).

## Decision

Use visx for rendering, but only behind project-owned `chart-data` and `chart-view` interfaces (see [../architecture/overview.md](../architecture/overview.md)), so debrief/summary logic is never coupled directly to the charting library.

## Consequences

- Summary/debrief logic and its tests don't need to render or import visx at all — they only produce or consume the project-owned `chart-data` shape.
- Swapping or upgrading the charting library later, or adding the deferred Standard Celeration Chart, doesn't require touching debrief logic.
- Because the accessible table required by [../accessibility.md](../accessibility.md) can be derived from the same `chart-data` used to draw the chart, there is no separately maintained copy of that data.
- This adds an extra abstraction layer/adapter to design and maintain versus calling visx directly from components.
- The interfaces need to be designed carefully enough up front to accommodate the deferred Celeration Chart without a rewrite, which is speculative design against a feature that isn't being built yet and could turn out to guess wrong.
