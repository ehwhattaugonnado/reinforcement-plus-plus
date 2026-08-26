# ADR 0003: Selected schedule controls eligibility only; experienced consequences drive behavior

**Status:** Accepted
**Date:** 2026-08-25

## Context

This is the single most important invariant in the whole design: **the selected schedule controls reinforcement eligibility; only experienced consequences influence subsequent creature behavior.** The game's pedagogical purpose is to teach that procedural fidelity matters — that choosing the "correct" schedule on paper is not the same as implementing it correctly — and the debrief needs to be able to meaningfully compare "intended vs. implemented" schedule (see [../core-loop.md](../core-loop.md) and [../product-spec.md](../product-spec.md)).

## Decision

The creature's response-rate model never takes the selected `SchedulePlan` type as an input. Its inputs are: baseline rate/learned strength, the history/contingency/latency of actual stimulus deliveries, the delivered stimulus's current value, time since the last experienced consequence, extinction-transition state, and small seeded variability. If a player implements VR as CRF, misses eligible responses, delivers late, or delivers noncontingently, the learner model reacts to those actual events — not to the schedule label the player chose. This invariant has a dedicated Vitest test as "the central causal invariant" (see [../testing-strategy.md](../testing-strategy.md)).

Cooper, Heron, & Heward (2020), Ch. 13, distinguish a schedule's *label* (the planned, average contingency, e.g. "VR-3") from what is *actually delivered* on a given cycle, and warn against the "common procedural misunderstanding" of assuming a schedule requirement is met just because its nominal condition (elapsed time, planned ratio) has occurred. This textbook framing is the closest published anchor for this invariant; see the [ABA Concept Glossary](../aba-glossary.md#intended-vs-actually-delivered-schedule--direct-precedent-for-the-sims-core-invariant) for the sourced passages.

## Consequences

- The debrief can meaningfully compare intended vs. implemented schedule, because behavior is provably driven by what was actually delivered, not by a selected label.
- The simulation is pedagogically honest: it teaches that procedural fidelity, not schedule choice alone, drives outcomes.
- This is meaningfully more complex to implement than a simpler, more "gamified" design that keys response-rate acceleration directly off the selected schedule type.
- A player who selects the pedagogically correct schedule but executes it poorly will see a worse in-game outcome than a player who executes a suboptimal schedule flawlessly. This is intentional and is recorded here explicitly as a deliberate design choice, not an oversight, since it can otherwise look like a bug or an unfair scoring outcome.
