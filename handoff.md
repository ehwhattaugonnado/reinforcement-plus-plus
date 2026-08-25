# Handoff Doc: Reinforcement & Preference Assessment Teaching Game

## 1. Concept Summary

A small, browser-based pet-training simulator that teaches core ABA principles (preference assessment, reinforcement, schedules of reinforcement) through direct, hands-on interaction with a virtual creature. The same underlying simulation supports three audiences at different depths: caregivers, support staff, and RBT trainees, through a Simple/Advanced mode toggle rather than separate builds.

**Tone:** cute, wholesome, low-stakes. No punishment mechanics, no fail states, only more or less effective training.

**Session length:** 10-20 minutes per session.

## 2. Audience & Mode Design

| Mode | Audience | Language | Data shown |
|---|---|---|---|
| Simple | Caregivers, support staff new to ABA | Plain language ("reward right after," "sometimes reward") | Creature mood, a simple progress bar |
| Advanced | RBT trainees, BCBA-adjacent staff | ABA terminology (FR, VR, FI, VI, EO, AO, MO, extinction burst) | Running data graph, session data log, technical debrief |

Mode is a toggle, not a separate build. Both modes run the exact same underlying simulation, only the labels and level of exposed detail change. This keeps the tool honest (no "dumbed down" fake mechanic for beginners) and keeps engineering scope small (one sim, two presentation layers).

## 3. Core Loop

Each session has two phases:

### Phase A: Preference Assessment
Player runs a brief assessment to determine what the creature currently values, before any training begins.

- **Paired-stimulus** or **MSWO (multiple stimulus without replacement)** format
- Player presents 2+ items/activities (toy, treat, praise, play) and observes the creature's approach/engagement response
- Output: a ranked preference hierarchy for that session (preferences are not fixed; they can shift session to session to illustrate satiation and motivating operations)

### Phase B: Reinforcement & Shaping
Player selects a target behavior and uses the assessed reinforcers to shape it.

- Player chooses a reinforcer (informed, ideally, by Phase A results, though nothing stops them from ignoring the data, this is itself a teaching moment)
- Player chooses a schedule: continuous (CRF), fixed ratio (FR), variable ratio (VR), fixed interval (FI), variable interval (VI)
- Player delivers consequences in response to the creature's behavior in real time (or the sim auto-delivers per schedule, TBD, see Open Questions)
- Creature's behavior visibly responds: response rate changes, extinction bursts appear if reinforcement is withheld, satiation reduces reinforcer effectiveness over time, etc.

### Debrief
After the session, a summary screen recaps what happened:
- Simple mode: plain-language recap ("Your pet learned fastest when treats came right after the trick, but got tired of the same treat over time.")
- Advanced mode: technical recap with schedule used, response rate graph, notes on any extinction bursts or satiation effects observed, and how the session data would be interpreted in practice

## 4. Data Model (Creature State)

Minimal state needed for v1:

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

`currentValue` on each preference item should decay during a session when that stimulus is used repeatedly (satiation) and slowly recover over time (deprivation/MO), this is what makes the Phase A assessment meaningfully different session to session instead of a static lookup table.

## 5. Simulation Rules (v1 scope)

Keep the underlying model simple and legible rather than fully realistic:

- **Response probability** per behavior opportunity = function of (reinforcer's currentValue, schedule type, time/count since last reinforcement, small random noise)
- **Schedule behavior**, standard ABA patterns to reproduce visually:
  - FR: steady responding with a post-reinforcement pause
  - VR: high, steady response rate (most resistant to extinction), this is the one worth making feel obviously different from FR
  - FI: scalloped pattern, slow responding after reinforcement, speeding up near the interval end
  - VI: slow, steady response rate
- **Extinction burst**: if reinforcement is withheld after an established schedule, briefly spike response rate before it drops off, an easy, high-value "aha" moment for the debrief screen
- **Satiation**: repeated use of the same reinforcer within a session gradually lowers its `currentValue`, reducing its effectiveness, encouraging the player to vary reinforcers or notice the drop-off

None of this needs to be a rigorous behavioral model. It needs to be legible enough that a learner can watch the pattern and correctly identify "oh, that's a VR schedule" from the shape of the response curve.

## 6. MVP Scope (recommended v1)

**In scope:**
- One creature, one target behavior
- Paired-stimulus preference assessment (simplest format to build and explain)
- Two schedules to start: CRF and VR (biggest visual contrast, teaches the core "why does this work" point fastest)
- Simple/Advanced mode toggle
- Session debrief screen

**Explicitly out of scope for v1** (stretch goals):
- Multiple creatures/characters
- MSWO and single-stimulus assessment formats
- FI/FR/VI schedules (add after CRF/VR prove the loop works)
- Generalization/maintenance mechanics across multiple sessions
- Negative reinforcement scenarios
- Multi-behavior chaining
- Save/progress persistence across visits
- Any social/comparison features

Resist scope creep here. The teaching value comes from one clean, well-explained loop, not from breadth.

## 7. Suggested Tech Stack

Given "small, browser-based, cute":

- **Plain HTML/CSS/JS or a lightweight framework** (no build system needed for something this size). A single-page app is sufficient.
- **Visuals**: simple sprite-based or SVG creature with a handful of states (content, neutral, disinterested, animated response to reinforcement). Doesn't need to be elaborate, a few frames of animation per state goes a long way for "cute."
- **Charting** (Advanced mode data graph): a lightweight charting library, or even hand-rolled SVG/canvas line chart given the data is simple (time vs. response events)
- **No backend needed for v1**: session state can live in memory/local session only. Persistence across visits is a stretch goal, not a requirement.

## 8. Open Questions for Design Discussion

1. **Real-time vs. simulated delivery**: does the player manually click "reinforce" each time the creature responds (more hands-on, more teaching value, more player error possible, which is itself instructive), or does the sim auto-apply the chosen schedule and the player just observes? Recommend manual delivery for v1, it's the mechanism that actually teaches schedule mechanics through doing rather than watching.
2. **Assessment format for v1**: paired-stimulus is recommended as the simplest to implement and explain, but confirm before scoping.
3. **Single creature personality or a customizable one?** A single default creature keeps v1 scope tight; naming/customization could be a cheap, high-value stretch goal for "cute and wholesome" appeal.
4. **Debrief depth in Advanced mode**: how much of a full technical write-up (e.g., something resembling actual session notes) is wanted vs. a lighter annotated graph?
5. **Standalone tool vs. course companion**: is this meant to live on its own, or alongside other training materials/curriculum? Affects whether onboarding/context-setting needs to be built into the tool itself.

## 9. Next Steps

- Confirm scope decisions in Section 8
- Confirm MVP schedule pair (CRF + VR recommended)
- Build creature state model and a static preference-assessment screen first (lowest-risk, most self-contained piece)
- Build reinforcement/shaping phase with CRF only, validate the response-curve visualization reads clearly, then add VR
- Build debrief screen last, once real session data exists to summarize