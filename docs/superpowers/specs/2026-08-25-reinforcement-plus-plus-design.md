# Design Spec: Reinforcement & Preference Assessment Teaching Game

**Status:** Approved for implementation planning
**Date:** 2026-08-25
**Repo:** https://github.com/ehwhattaugonnado/reinforcement-plus-plus

## 1. Concept Summary

A small, browser-based pet-training simulator that teaches core ABA
principles (preference assessment, reinforcement, schedules of
reinforcement) through direct, hands-on interaction with a virtual
creature. One underlying simulation supports caregivers, support
staff, and RBT trainees via a Simple/Advanced mode toggle rather than
separate builds.

**Tone:** cute, wholesome, low-stakes. No punishment mechanics, no
fail states, only more or less effective training.

**Session length:** 10-20 minutes.

## 2. Audience & Mode Design

| Mode | Audience | Language | Data shown |
|---|---|---|---|
| Simple | Caregivers, support staff new to ABA | Plain language ("reward right after," "sometimes reward") | Creature mood, a simple progress bar |
| Advanced | RBT trainees, BCBA-adjacent staff | ABA terminology (FR, VR, FI, VI, EO, AO, MO, extinction burst) | Live response-rate graph, session data log, technical debrief |

Mode is a UI-layer toggle only. Both modes run the exact same
simulation; only labels and exposed detail change. The tool is
**standalone**: brief inline explanations/tooltips are included so it
works without an external course/curriculum, since caregivers are a
target audience.

## 3. Core Loop

### Phase A: Preference Assessment
**Paired-stimulus format.** Player presents 2 items/activities at a
time (toy, treat, praise, play) and observes the creature's
approach/engagement response. Output: a ranked preference hierarchy
for that session. Preferences are not fixed — they shift session to
session via satiation/deprivation (motivating operations).

### Phase B: Reinforcement & Shaping
Player selects a target behavior and shapes it using assessed
reinforcers:

- Player chooses a reinforcer (informed by Phase A, but not enforced
  — ignoring the data is itself a teaching moment).
- Player chooses a schedule. **v1 supports CRF and VR** (biggest
  visual contrast; FI/FR/VI are stretch goals).
- **Reinforcement delivery is manual**: the player clicks "reinforce"
  each time the creature responds, in real time. This is the
  mechanism that teaches schedule mechanics through doing, and allows
  player error (e.g. reinforcing off-schedule) as a teaching moment.
- Creature's behavior visibly responds: response rate changes,
  extinction bursts appear if reinforcement is withheld, satiation
  reduces reinforcer effectiveness over time.

### Debrief
- **Simple mode:** plain-language recap generated from session
  summary stats (e.g. "Your pet learned fastest when treats came
  right after the trick, but got tired of the same treat over time.")
- **Advanced mode:** an annotated response-rate graph (callouts for
  extinction bursts / satiation) plus a short bullet list of
  technical observations, built from the same `sessionHistory` data
  — not a separate data path.

## 4. Data Model (Creature State)

```
Creature {
  id: string
  name: string
  moodState: enum [content, neutral, disinterested, frustrated]  // drives animation, not a fail state
  preferenceHierarchy: [
    { stimulusId: string, rank: number, currentValue: float }  // currentValue decays with satiation
  ]
  targetBehavior: {
    behaviorId: string
    baselineRate: float
    currentRate: float
  }
  sessionHistory: [
    {
      timestamp
      schedule: enum [CRF, FR, VR, FI, VI]
      reinforcerUsed: stimulusId
      responseLog: [ {time, responded: bool, reinforced: bool} ]
    }
  ]
}
```

`currentValue` decays during a session when a stimulus is used
repeatedly (satiation) and slowly recovers over time (deprivation/MO)
— this is what makes Phase A meaningfully different session to
session instead of a static lookup table.

## 5. Simulation Rules (v1 scope)

Legible over realistic:

- **Response probability** per opportunity = f(reinforcer's
  `currentValue`, schedule type, time/count since last reinforcement,
  small random noise).
- **Schedule behavior** (standard ABA visual patterns):
  - **CRF**: every response reinforced; simple, fast to teach the
    core loop.
  - **VR**: high, steady response rate, most resistant to extinction
    — the schedule most worth making feel obviously different from
    CRF.
  - *(Stretch, not v1)* FR: steady responding with post-reinforcement
    pause. FI: scalloped pattern. VI: slow, steady rate.
- **Extinction burst**: withholding reinforcement after an
  established schedule briefly spikes response rate before it drops
  off — a high-value "aha" moment for the debrief.
- **Satiation**: repeated use of the same reinforcer within a session
  gradually lowers its `currentValue`, encouraging the player to vary
  reinforcers or notice the drop-off.

None of this needs to be a rigorous behavioral model — a learner
should be able to watch the response-rate shape and correctly
identify "oh, that's a VR schedule."

## 6. MVP Scope (v1)

**In scope:**
- One creature (single default, no customization), one target
  behavior
- Paired-stimulus preference assessment
- CRF and VR schedules
- Manual reinforcement delivery
- Simple/Advanced mode toggle
- Session debrief screen (annotated graph + notes in Advanced; plain
  recap in Simple)

**Explicitly out of scope for v1** (stretch goals):
- Multiple creatures/characters, creature naming/customization
- MSWO and single-stimulus assessment formats
- FI/FR/VI schedules
- Generalization/maintenance mechanics across multiple sessions
- Negative reinforcement scenarios
- Multi-behavior chaining
- Save/progress persistence across visits
- Any social/comparison features
- Standard Celeration Chart support (see §8 — architecture leaves room
  for this, but it is not built in v1)

## 7. Architecture

### 7.1 Tech stack
**Vite + React + TypeScript.** No backend for v1 — session state
lives in memory only; persistence across visits is a stretch goal.
Deployment target is undecided for now (runs locally); hosting choice
deferred.

### 7.2 Sim core / React shell split
- **Sim core** (`src/sim/`): plain TypeScript, zero React/DOM
  dependencies. Owns the `Creature` state model, the response-
  probability function, and schedule behaviors (CRF, VR for v1).
  Exposes a small imperative API:
  - `createSession()`
  - `presentPair(a, b)` — assessment trial
  - `deliverReinforcer()` — manual reinforcement click
  - `tick(dt)` — time advance
  - `getState()` — snapshot read
  Pure functions/classes, independently unit-testable, RNG seedable
  for deterministic tests.
- **React shell** (`src/app/`): screens subscribe to sim state via a
  `useSimState()` hook (subscribe/getSnapshot pattern) and call the
  sim API. No simulation rules live in hooks or components — hooks
  only bridge sim state to React re-renders.
- **Mode toggle**: a single `mode: 'simple' | 'advanced'` flag lives
  in the UI layer only and is read by presentation components — it
  never touches sim core, per §2.
- **Data flow is one-directional**: sim core is the single source of
  truth → screens read snapshots and dispatch actions → sim core
  updates → UI re-renders. No screen mutates creature state directly.

### 7.3 Components
- **App shell**: holds the `mode` toggle and current screen
  (`assessment` → `shaping` → `debrief`), owns the sim instance.
- **AssessmentScreen**: renders paired-stimulus trials, records
  approach responses, produces the ranked preference hierarchy that
  unlocks Phase B.
- **ShapingScreen**: schedule selector (CRF/VR), reinforcer picker
  (seeded by Phase A ranking, not enforced), manual "reinforce"
  button, live creature animation state; Advanced mode adds a live
  `visx` response-rate chart and a running data log table.
- **DebriefScreen**: Simple mode renders a plain-language recap
  string from session summary stats; Advanced mode renders the
  annotated `visx` graph plus bullet-point technical notes — both
  built from the same `sessionHistory`, no separate data path.

### 7.4 Charting
**visx** (React bindings over D3's low-level primitives: scales,
axes, shapes). Chosen over a high-level chart component library
(e.g. Recharts) because of a known future goal: supporting a
**Standard Celeration Chart** (a fixed-format semi-logarithmic, 6-cycle
chart used in precision teaching) is on the roadmap. High-level
libraries don't model that fixed grid convention; visx gives the
control needed to build it later while still being a maintained
library rather than hand-rolled SVG math. v1 only needs a simple
linear response-rate-over-time chart with event annotations — the
celeration chart itself is not built in v1, but the charting choice is
made with it in mind.

## 8. Testing & Error Handling

- **Sim core**: unit tests (Vitest) on response-probability function,
  satiation decay/recovery curves, CRF vs. VR response-rate shape,
  extinction burst triggering, and preference-ranking output from
  paired trials. Highest-value test surface — framework-free and
  deterministic with a seeded RNG.
- **React shell**: lighter coverage — a few component/integration
  tests (React Testing Library) confirming screens render sim state
  correctly and the assessment → shaping → debrief flow transitions
  properly. Not chasing full coverage given v1 scope.
- **Error handling**: low-stakes local tool, no backend, no
  persistence — no network/data-loss failure mode to guard against.
  The only real "error" class is invalid sim inputs (e.g. delivering a
  reinforcer with no active session); handled by making illegal
  states unrepresentable where cheap, rather than a validation layer.
- **No persistence**: session state is in-memory only.

## 9. Open Items Deferred Beyond v1

- Standard Celeration Chart implementation (architecture reserves
  room for it via the visx choice).
- Hosting/deployment target.
- FI/FR/VI schedules, MSWO/single-stimulus assessment, multi-session
  persistence, creature customization — all explicitly deferred per
  §6.
