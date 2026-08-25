# ADR 0004: Simple/Advanced mode as a UI-only toggle over one shared simulation

**Status:** Accepted
**Date:** 2026-08-25

## Context

The product serves two audiences with different vocabulary needs: caregivers and support staff, who need plain language, and RBT trainees / BCBA-adjacent staff, who need ABA terminology, a cumulative record, and the raw event log (see [../product-spec.md](../product-spec.md)). We considered building a simplified simulation for one audience and a full one for the other, but rejected this in favor of one simulation shared by both.

## Decision

There is exactly one simulation. Mode (Simple/Advanced) is a UI-layer toggle only: both modes run the identical simulation and read from the identical session event history. Only labels, explanations, and the amount of exposed detail change between modes. A learner can switch modes mid-session without resetting the session.

## Consequences

- There is a single simulation core to build and test, rather than two.
- Both audiences always see conclusions derived from the same facts — the debrief is guaranteed consistent across modes, which is itself an acceptance criterion: "Simple and Advanced views produce equivalent conclusions from the same session summary."
- Switching modes mid-session is possible essentially for free, since no simulation state is mode-specific.
- The debrief/summary layer must be written generically enough to render two very different vocabularies and detail levels from one summary object, which constrains how summary data can be shaped.
- Because the underlying simulation is identical across modes, the actual mechanics (e.g., easier thresholds) cannot be tuned for a beginner audience — only the language can be simplified. This is out of scope by design, but is a real limitation if it turns out beginners need mechanically lower stakes, not just simpler wording.
