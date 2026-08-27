# ABA Concept Glossary

This glossary grounds the simulation's terminology in the field's standard
graduate textbook, so that in-game copy, debrief language, and future feature
work stay accurate to the source material rather than to folk understanding
of ABA terms.

**Source text:** Cooper, J. O., Heron, T. E., & Heward, W. L. (2020).
*Applied Behavior Analysis* (3rd ed.). Pearson. The full text was consulted
locally as `docs/ref/Applied Behavior Analysis.md` during research for this
glossary; that file is gitignored and not distributed with this repo, since
it is commercial copyrighted material, not project content. Line numbers
below refer to that local copy and will only resolve for someone who has
their own copy of the same edition at hand. Quotations are verbatim from the
textbook; where no single boxed definition exists, the entry is a close
paraphrase and is marked as such.

This is a working reference for the team, not learner-facing content. It is
not a substitute for SME review before public release (see
[Product Spec §5](product-spec.md#5-acceptance-and-release-criteria)).

See also: [Product Spec](product-spec.md) · [Core Loop](core-loop.md) ·
[Data Model](architecture/data-model.md)

---

## How to read this document

Each entry has:
- **Definition** — the textbook's own wording (quoted) or a close paraphrase (marked *paraphrase*).
- **Source** — chapter, section heading, and approximate line number in the archived text, plus the textbook's own in-text citation where one exists.
- **Relevance** — how the concept maps to the simulation as currently specified. These notes describe conceptual relevance only; they do not assert that the sim's current design is complete or correct beyond what's noted in the "Findings" section below.

Ambiguities the source subagents flagged are consolidated in
[Open questions and ambiguities](#open-questions-and-ambiguities) at the end,
and concrete documentation issues found while cross-checking the project's
existing docs are in [Findings applied to the project's docs](#findings-applied-to-the-projects-docs).

---

## 1. Foundational concepts

### Behavior
**Definition:** "Behavior is that portion of an organism's interaction with its environment that involves movement of some part of the organism" (Johnston & Pennypacker, 2009, p. 31), building on Skinner's (1938) "the movement of an organism or of its parts in a frame of reference provided by the organism or by various external objects or fields" (p. 6). Behavior is not a property or attribute of the organism — it exists only as an interaction between organism and environment.
**Source:** Ch. 2, "Behavior" (line ~1690–1708).
**Relevance:** The simulation should represent the pet's trainable actions as observable, environment-interacting movement — not as an inferred internal state.

### Response / Response Class
**Definition:** A **response** is "action of an organism's effector" (Michael, 2004, p. 8) — a single instance of behavior. A **response class** is "a group of responses with the same function (that is, each response in the group produces the same effect on the environment)." Topography (physical form) does not define a response class; function does.
**Source:** Ch. 2, "Behavior" (line ~1712–1720).
**Relevance:** "The target behavior" in the sim is a response class defined by its effect, not one exact motion — reinforcement should be understood as strengthening the class, not one identical repetition.

### Stimulus / Stimulus Change
**Definition:** A stimulus is "an energy change that affects an organism through its receptor cells" (Michael, 2004, p. 7). The environment influences behavior primarily through **stimulus change** — a change from one condition to another — not through static conditions.
**Source:** Ch. 2, "Environment" (line ~1734–1739).
**Relevance:** Antecedents and consequences in the sim should be modeled as discrete changes (a cue appearing, a treat being delivered), consistent with the event-sourced design already in place ([ADR 0001](adr/0001-event-sourced-session-state.md)).

### Antecedent / Consequence
**Definition:** "The term antecedent refers to environmental conditions or stimulus changes that exist or occur prior to the behavior of interest." "A consequence is a stimulus change that follows a behavior of interest." A **socially mediated contingency** is one in which another person presents the antecedent and/or consequence.
**Source:** Ch. 2, "Temporal Loci of Stimuli" (line ~1754–1763).
**Relevance:** Names the A and C of the three-term contingency; the sim's trainer character delivering stimuli is a socially mediated contingency, as it is in most applied ABA work with human or animal learners.

### Respondent Behavior vs. Operant Behavior
**Definition:** **Respondent behavior** "is elicited by antecedent stimuli" — a reflex, requiring nothing but the eliciting stimulus (e.g., pupil contraction to light); part of an organism's genetic endowment. **Operant behavior** "is any behavior determined primarily by its history of consequences" — "selected, shaped, and maintained by the consequences that have followed it in the past," defined functionally rather than topographically.
**Source:** Ch. 2, "Respondent Behavior" (line ~1811–1813); "Operant Behavior" (line ~1870–1884).
**Relevance:** The entire premise of the game is operant training. Respondent behavior is out of scope except as a contrast case for explaining why reflexive reactions differ from trained behaviors like "sit."

### Selection by Consequences / Operant Conditioning
**Definition:** Operant behavior is shaped by a selection process during the individual's lifetime (**ontogeny**), analogous to natural selection across a species' history (**phylogeny**); requires variation in behavior, some of which produces more favorable outcomes and is thereby "selected." **Operant conditioning** is "the process and selective effects of consequences on behavior." When conditioning increases response rate, **reinforcement** has occurred; when it decreases response rate, **punishment** has occurred.
**Source:** Ch. 2, "Selection by Consequences" (line ~1888–1930); "Operant Conditioning" (line ~1931–1943).
**Relevance:** Behavior in the sim should change gradually across repeated trials as a function of accumulated consequence history, not flip on/off from a single event.

### Five qualifications on how consequences affect behavior
**Definition** *(paraphrase of five named subsections)*:
1. **Consequences affect only future behavior** — a consequence cannot change the response that produced it, only future similar responses.
2. **Consequences select response classes, not individual responses** — "Reinforcement strengthens responses which differ in topography from the response reinforced" (Skinner, 1969, p. 131).
3. **Immediate consequences have the greatest effect** — "Events that are delayed more than a few seconds after the response do not directly increase its future frequency" (Michael, 2004, p. 110).
4. **Consequences select any behavior** — "So far as the organism is concerned, the only important property of the contingency is temporal... How this is brought about does not matter" (Skinner, 1953, p. 85) — the basis for superstitious behavior.
5. **Operant conditioning occurs automatically** (**automaticity of reinforcement**) — behavior is modified by consequences "regardless of whether the individual is aware that her behavior is, or has been, reinforced."
**Source:** Ch. 2, "Operant Conditioning" (line ~1943–2013).
**Relevance:** Points 3 and 4 directly justify the sim's immediate-feedback design and its tracking of *noncontingent* deliveries (a delivery near, but not caused by, a response can still reinforce whatever preceded it) — see `stimulus-delivered` event's `contingency` field in the [data model](architecture/data-model.md).

### Reinforcement (general) / Positive & Negative Reinforcement
**Definition:** "When a response is followed by a stimulus change that results in similar responses occurring more often, reinforcement has taken place." Two forms: **positive reinforcement** — "a response is followed immediately by the presentation of a stimulus that results in similar responses occurring more often"; **negative reinforcement** — "a behavior occurs more often because past responses have resulted in the withdrawal or termination of a stimulus." The text explicitly warns that the most common student error is equating negative reinforcement with punishment — negative reinforcement always *increases* behavior.
**Source:** Ch. 2, "Reinforcement" (line ~2015–2041); elaborated in Ch. 11 and Ch. 12 (§2, below).
**Relevance:** V1 is positive-reinforcement only (no negative-reinforcement scenarios are in scope per [Product Spec §4](product-spec.md#4-mvp-scope)). If any future copy mentions negative reinforcement for contrast, it must not be described as punishment.

### Punishment (general)
**Definition:** "When a response is followed immediately by a stimulus change that results in similar responses occurring less often, punishment has taken place." **Positive punishment** presents a consequence; **negative punishment** withdraws one. "Positive"/"negative" denote only the stimulus-change operation, not desirability.
**Source:** Ch. 2, "Punishment" (line ~2043–2049).
**Relevance:** The product spec is explicit that "there are no punishment mechanics" ([Product Spec §1](product-spec.md#1-concept-summary)) — this definition is retained only so the team can correctly describe *why* the sim avoids punishment mechanics if asked.

### Stimuli have no fixed reinforcing/punishing property
**Definition:** "There is no concept that predicts reliably when events will be reinforcers or punishers; the defining characteristics of reinforcers and punishers are how they change behavior" (Morse & Kelleher, 1977). Classification is strictly functional; the same stimulus can function differently by individual, condition, or moment.
**Source:** Ch. 2, "Stimulus Changes That Function as Reinforcers and Punishers" (line ~2053–2109).
**Relevance:** Reinforces why the sim must never assert a stimulus "is a reinforcer" a priori — see §2 below, "preferred stimulus vs. demonstrated reinforcer," which is the same principle applied specifically to preference assessment.

### Unconditioned vs. Conditioned Reinforcer
**Definition:** An **unconditioned (primary) reinforcer** "functions as reinforcement even though the learner has had no particular learning history with it" (e.g., food, water). A **conditioned (secondary) reinforcer** "has acquired the capability to function as a reinforcer through stimulus-stimulus pairing with one or more unconditioned reinforcers or conditioned reinforcers"; a **generalized conditioned reinforcer** does not depend on a current motivating operation for any single paired reinforcer (e.g., praise, tokens, money).
**Source:** Ch. 2, "Conditioned Reinforcers and Punishers" (line ~2083–2109); Ch. 11, "Classifying Reinforcers" (line ~9868–9900).
**Relevance:** The sim's v1 stimulus set (toy, treat, praise, play) mixes likely-unconditioned (treat) and likely-conditioned (praise) reinforcers; this distinction is background knowledge, not something v1 needs to expose in the UI.

### Discriminated Operant, Stimulus Control, and the Three-Term Contingency
**Definition:** "A behavior that occurs more often under some antecedent conditions than it does in others is called a discriminated operant" and is said to be under **stimulus control**; the controlling antecedent is a **discriminative stimulus (S<sup>D</sup>)**. "The three-term contingency — antecedent, behavior, and consequence — is sometimes called the ABCs of behavior analysis" and is "considered the basic unit of analysis in the analysis of operant behavior" (Glenn, Ellis, & Greenspoon, 1992, p. 1332). Per Skinner (1969, p. 7): a full account "must always specify three things: (1) the occasion upon which a response occurs; (2) the response itself; and (3) the reinforcing consequences."
**Source:** Ch. 2, "The Discriminated Operant and Three-Term Contingency" (line ~2111–2131).
**Relevance:** This is the structural backbone the training rounds implement: antecedent (an eligible-response window / cue) → behavior (target response) → consequence (stimulus delivery). Note: the textbook mentions a **four-term contingency** (adding motivating operations) is detailed in Ch. 11/16 — the three-term contingency alone does not capture satiation effects.

### Contingent / Contingency
**Definition:** "When a reinforcer (or punisher) is said to be contingent on a particular behavior, the behavior must be emitted for the consequence to occur." *Contingency* carries two senses: dependency of the consequence on the behavior, and temporal contiguity between them.
**Source:** Ch. 2, "The Discriminated Operant and Three-Term Contingency" (line ~2133–2142).
**Relevance:** Directly names the `contingency: 'response-contingent' | 'noncontingent'` field already in the [data model's `SimEvent` union](architecture/data-model.md#3-event-log).

### Operant Extinction (contrast with respondent extinction)
**Definition:** "If reinforcement is withheld for all members of a previously reinforced response class... the behavior will gradually decrease in rate to its pre-reinforcement level or cease to occur altogether." **Respondent extinction** is a distinct concept: repeated presentation of a conditioned stimulus without the unconditioned stimulus until the CS no longer elicits the conditioned response.
**Source:** Ch. 2, "Reinforcement" (line ~2039); "Respondent Extinction" (line ~1852–1854). Full treatment in Ch. 24 (see §5, below).
**Relevance:** The sim's Round 3 uses *operant* extinction only. Respondent extinction is unrelated and should never be conflated with it in glossary or UI text.

---

## 2. Reinforcement, stimulus preference assessment, and reinforcer assessment

*Source chapters: Ch. 11 "Positive Reinforcement," Ch. 12 "Negative Reinforcement" (Smith & Iwata), lines 9560–11224.*

### Positive Reinforcement
**Definition:** "Positive reinforcement occurs when a response is followed immediately by the presentation of a stimulus change that increases the future occurrence of similar responses."
**Source:** Ch. 11, "Operation and Defining Effect of Positive Reinforcement" (line ~9615).
**Relevance:** The sim's core mechanic. Definition is strictly functional — defined by measured effect on future behavior, not by whether a stimulus "seems pleasant." In-game/debrief copy should avoid asserting a stimulus is reinforcing except where the data support it (see reinforcer-evidence rule below).

### Reinforcer — vocabulary precision
**Definition:** "The stimulus that is presented as a consequence, and that is responsible for the subsequent increase in responding, is called a positive reinforcer, or, more simply, a reinforcer" (quoting Skinner, 1953, p. 87). A reinforcer does not strengthen the response that produced it (already occurred); it changes the *future probability* of the class. Table 11.1 (citing Catania, 2013, p. 66) fixes part-of-speech usage: *reinforcer* = noun (a stimulus); *reinforcing* = adjective; *reinforcement* = the process; *to reinforce* = verb applying to **responses**, never to organisms ("reinforce the behavior," not "reinforce the pet").
**Source:** Ch. 11, "Operation and Defining Effect of Positive Reinforcement" (line ~9617–9621).
**Relevance:** A concrete copy-writing rule for the game: never write "reward the dog" or "reinforce the creature" — reinforce the *behavior*/*response*.

### Reinforcement is not circular
**Definition:** "If we can show that a response increases in frequency because (and only because) it is followed by a particular stimulus, we call that stimulus a reinforcer and its presentation, reinforcement" (Epstein, 1982, p. 4).
**Source:** Ch. 11, "Reinforcement Is Not a Circular Concept" (line ~9651–9673).
**Relevance:** Pedagogically load-bearing: the debrief must show the underlying evidence (a demonstrated increase over baseline) before labeling anything a reinforcer, not assert the label first.

### Immediacy of Reinforcement
**Definition:** "The direct effects of reinforcement involve 'temporal relations between behavior and its consequences that are on the order of a few seconds'" (Michael, 2004, p. 161). Even a 1-second delay can reduce effectiveness relative to immediate delivery; delayed effects beyond roughly 30 seconds in humans typically reflect rule-governed behavior, not direct reinforcement.
**Source:** Ch. 11, "Immediacy of Reinforcement" (line ~9625–9649).
**Relevance:** Directly supports the sim's `promptDeliveryWindowMs` = 1500 ms threshold and its `timing: 'prompt' | 'delayed' | 'no-response'` classification ([Data Model §3, §6](architecture/data-model.md)) — a real, textbook-grounded reason immediacy matters, not an arbitrary UI number.

### Motivating Operations (brief; full treatment in §4)
**Definition:** "Motivating operations (MOs) are environmental variables that have two effects on behavior: (1) They alter the operant reinforcing effectiveness of some specific stimuli... (the value-altering effect); and (2) They alter the momentary frequency of all behavior that has been reinforced by those stimuli... (the behavior-altering effect)" (Michael, 2004, p. 31). An **establishing operation (EO)** increases reinforcer effectiveness; an **abolishing operation (AO)** decreases it.
**Source:** Ch. 11, "The Role of Motivation" (line ~9744–9772); full treatment deferred by the book itself to Ch. 16.
**Relevance:** Grounds the sim's satiation/current-value mechanic; see §4 for the full definitions.

### Reinforcer preferences shift over time
**Definition:** "Reinforcer preferences shift, and the transitory and idiosyncratic nature of preference has been reported repeatedly in the literature." A review of 13 studies (Logan & Gast, 2001) concluded preferred stimuli do not always function as reinforcers, and preferences change over time.
**Source:** Ch. 11, "Identifying Potential Reinforcers" (line ~10008–10010).
**Relevance:** Supports the core educational point that a preference assessment is a snapshot, not a permanent ranking — consistent with the sim modeling in-session satiation that can shift a stimulus's `currentValue`.

### Stimulus Preference Assessment (SPA)
**Definition:** "Stimulus preference assessment (SPA) refers to a variety of procedures used to determine (a) the stimuli that the person differentially selects, (b) the relative hierarchical preference value of those stimuli (high preference to low preference), (c) the conditions under which those preference values change when task demands, deprivation states, or schedules of reinforcement are modified, and (d) whether highly preferred items ultimately serve as effective reinforcers." Conducted as a three-step process: (1) gather a pool of candidate stimuli, (2) present them systematically to identify preference, (3) "test" high- (and sometimes low-) preference items experimentally (Livingston & Graff, 2018).
**Source:** Ch. 11, "Identifying Potential Reinforcers" > "Stimulus Preference Assessment" (line ~10022–10024).
**Relevance:** This is exactly what the sim's Phase A implements: steps (1)–(2). Step (3) — reinforcer assessment — is exactly what Phase B (CRF round) provides evidence for. **The sim's overall Phase A → Phase B structure mirrors the textbook's own SPA → reinforcer-assessment sequence.**

### Reinforcer Assessment (and the preferred ≠ reinforcer distinction)
**Definition:** "Reinforcer assessment refers to a variety of direct, data-based methods used to present one or more stimuli contingent on a target response and then measuring the future effects on the rate of responding." Quoting Piazza, Fisher, Hagopian, Bowman, & Toole (1996, pp. 1–2): "During preference assessments, a relatively large number of stimuli are evaluated to identify preferred stimuli. The reinforcing effects of a small subset of stimuli... are then evaluated during reinforcer assessment. Although the preference assessment is an efficient procedure identifying potential reinforcers from a large number of stimuli, it does not evaluate the reinforcing effects of the stimuli." "The only way to know for sure whether a given stimulus serves as a reinforcer is to present it immediately following the occurrence of a behavior and note its effects on responding" (echoing Skinner, 1953, pp. 72–73: "The only way to tell whether or not a given event is reinforcing to a given organism under given conditions is to make a direct test.")
**Source:** Ch. 11, "Identifying Potential Reinforcers" (line ~10012–10020); "Reinforcer Assessment" (line ~10244–10262).
**Relevance:** **This is the single most important concept for the project's learning objectives.** It is a textbook-verified, direct match for the sim's design principle — stated explicitly in [Product Spec §2](product-spec.md#2-learning-objectives-and-educational-boundaries) objective 2 and enforced by the `reinforcerEvidence*` thresholds in the [data model](architecture/data-model.md#5-derived-metrics). The textbook frames the preference-assessment result as "efficient and workable assumptions with which to begin" rather than a final answer — good source language for in-game framing text.

### Paired-Stimulus (Forced-Choice) Method — the method the sim implements
**Definition:** "Each trial in the paired-stimuli presentation method, also sometimes called the 'forced choice' method, consists of the simultaneous presentation of two stimuli. The observer records which of the two stimuli the learner chooses. To conduct a paired-stimuli assessment, each stimulus is matched randomly with all other stimuli in the proposed group of stimuli to be compared" (Fisher et al., 1992). Preference hierarchies are established by rank-ordering stimuli by percentage of times each was chosen.
**Source:** Ch. 11, Figure 11.10 (line ~10035) and "Paired Stimuli" (line ~10200–10211). **Original citation: Fisher, W. W., Piazza, C. C., Bowman, L. G., Hagopian, L. P., Owens, J. C., & Slevin, I. (1992). A comparison of two approaches for identifying reinforcers for persons with severe and profound disabilities.** *Journal of Applied Behavior Analysis, 25*, 491–498.
**Relevance:** **This is the exact method [Core Loop, Phase A](core-loop.md#phase-a-paired-stimulus-preference-assessment) specifies** — four stimuli, six unique pairs (every possible pairing presented once, C(4,2)=6), matching the textbook's "each stimulus is matched randomly with all other stimuli" structure precisely. **See [Findings](#findings-applied-to-the-projects-docs) below — the project's existing citation list attributes this method to the wrong paper.**

Trial-count note: "The number in the group is at the discretion of the analyst. For example, Piazza and colleagues (1996) used 66 to 120 paired-stimuli trials." There is no single textbook-mandated trial count; the sim's six-trial (one pass through all pairs) design is a legitimate simplification for a short session, not something the source claims is standard.

High/low-preference thresholds (for reference, not currently implemented as sim thresholds): "Items that received engagement, play, manipulation, or selection over 80% of the pairings are deemed high-preference items. Low-preference items were selected at the 50% level."
**Source:** Ch. 11, "Paired Stimuli" (line ~10200).

Accuracy rationale: "Pace and colleagues (1985) found that paired-stimuli presentations yielded more accurate distinctions between high- and low-preference items than did single-stimulus presentations." DeLeon and Iwata (1996) noted "the more consistent results produced by the PS method may indicate that stable preferences can be determined in fewer, or even single, sessions" (p. 520).
**Source:** Ch. 11, "Paired Stimuli" (line ~10200–10210).
**Relevance:** Textbook-sourced justification for choosing PS over single-stimulus for accuracy, even though (per the next entry) PS is not the fastest method.

### Single-Stimulus (SS) Method — not used in v1
**Definition:** "Across a series of trials, stimuli are presented one at a time. Approach responses... are recorded. Preference hierarchies are established by calculating the percentage of approach responses per stimulus." Weakness: "false positive results, less likely to identify relative preferences than MSWO and PS methods except when duration of engagement is also measured" (Karsten, Carr, & Lepper, 2011).
**Source:** Ch. 11, Figure 11.10 (line ~10034, citing Pace et al., 1985); "Single Stimulus" (line ~10188–10198).
**Relevance:** Explicitly out of v1 scope ([Product Spec §4](product-spec.md#4-mvp-scope)); retained here for glossary completeness and future-scope discussions.

### Multiple-Stimulus Without Replacement (MSWO) — not used in v1
**Definition:** "At the start of each session, multiple stimuli are placed in front of the individual, who can select one. Approach responses are recorded. The selected item is not replaced, and the positions of the remaining stimuli are changed... Continue in this manner until all items have been selected or the individual stops selecting items."
**Source:** Ch. 11, Figure 11.10 (line ~10036). **Original citation: DeLeon, I. G., & Iwata, B. A. (1996). Evaluation of a multiple-stimulus presentation format for assessing reinforcer preferences.** *Journal of Applied Behavior Analysis, 29*, 519–532.
**Relevance:** "DeLeon and Iwata (1996) found that multiple stimuli without replacement identified preferred items in approximately half the time that a paired-stimulus comparison procedure did" — MSWO is faster but PS is more accurate/stable, which is the textbook's own trade-off framing. **Explicitly out of v1 scope; see Findings below for a citation-attribution fix this glossary motivates.**

### Multiple-Stimulus With Replacement (MSWI) — not used in v1
**Definition:** "In the multiple stimuli with replacement procedure, the item chosen by the learner remains in the array and items that were not selected are replaced with new items." Extension of the paired-stimulus procedure (Fisher et al., 1992; Windsor, Piche, & Locke, 1994).
**Source:** Ch. 11, "Multiple Stimuli" (line ~10212–10214). Note: the textbook's own abbreviation is **MSWI**, not "MSW."
**Relevance:** Out of v1 scope; noted for terminology precision if this method is ever discussed.

### Free-Operant Preference Assessment — not used in v1
**Definition:** "Observing and recording what activities the target person engages in when she can choose during a period of unrestricted access to numerous activities is called free operant observation." No response requirement; items are never removed; duration of engagement per item is the measure. **Contrived** (environment "salted" with predetermined items) or **naturalistic** (observed in everyday environment) variants.
**Source:** Ch. 11, "Free Operant Observation" (line ~10153–10176).
**Relevance:** Out of v1 scope; "less likely to identify multiple reinforcers than other methods" but "less likely to evoke problem behavior" (Karsten, Carr, & Lepper, 2011) — useful contrast if a future assessment mode is considered.

### Preference Hierarchy
**Definition:** *(paraphrase)* The rank-ordering of stimuli from most to least preferred, established via percentage of approach/selection (SS, PS methods) or duration of engagement (FO method).
**Source:** Ch. 11, Figure 11.10 and "Paired Stimuli" (line ~10034–10200).
**Relevance:** Matches [Core Loop, Phase A](core-loop.md#phase-a-paired-stimulus-preference-assessment)'s output exactly: "Rank stimuli by selection percentage... The result is labeled a **preference hierarchy**."

### High-Preference (HP) vs. Low-Preference (LP) stimulus — low preference ≠ non-reinforcing
**Definition:** See thresholds above (>80% HP, 50% LP for PS data). Important nuance: in a concurrent-schedule study (Roscoe, Iwata, & Kang, 1999), HP stimuli produced more responding than LP stimuli *when pitted against each other*, but LP stimuli still functioned as effective reinforcers when presented alone: participants "showed increased levels of responding over baseline, similar to those obtained with the HP stimuli in the concurrent schedule."
**Source:** Ch. 11, "Reinforcer Assessment" (line ~10266–10275).
**Relevance:** Important accuracy guardrail: the sim should not imply a low-preference item "doesn't work" as a reinforcer — it may simply be weaker *in competition* with a higher-preference alternative, which is directly relevant to [Product Spec §2](product-spec.md#2-learning-objectives-and-educational-boundaries) objective 2's "distinguish a preferred stimulus... from a reinforcer whose effect has been demonstrated."

### Noncontingent Reinforcement (NCR) — control-procedure term
**Definition:** "Noncontingent reinforcement (NCR) is the presentation of a potential reinforcer on a fixed-time (FT) or variable-time (VT) schedule independent of the occurrence of the target behavior."
**Source:** Ch. 11, "Noncontingent Reinforcement" (line ~10336–10342, citing Thompson & Iwata, 2005).
**Relevance:** Distinguish from the sim's `contingency: 'noncontingent'` event classification, which flags *player errors* (a delivery with no associated response), not a deliberate NCR procedure — same underlying concept (delivery independent of the response), different purpose. Worth a one-line note in the data model if this ambiguity ever comes up in review.

### Negative Reinforcement, Escape, Avoidance — out of scope for v1
**Definition:** "A negative reinforcement contingency is one in which the occurrence of a response produces the termination, reduction, postponement, or avoidance of a stimulus, which leads to an increase in the future occurrence of that response." **Escape** contingency: a response terminates an ongoing aversive stimulus. **Avoidance** contingency: a response prevents or postpones an aversive stimulus (discriminated, with a warning signal, or free-operant, with no signal).
**Source:** Ch. 12, "Definition of Negative Reinforcement" (line ~10769–10772); "Escape and Avoidance Contingencies" (line ~10799–10828).
**Relevance:** Confirmed correctly out of scope: [Product Spec §4](product-spec.md#4-mvp-scope) explicitly excludes "Negative reinforcement scenarios." Retained here only so the team can correctly explain the concept if asked, and so it is never conflated with punishment (see next entry).

### Negative Reinforcement vs. Punishment — the textbook's own explicit warning
**Definition:** "In a negative reinforcement contingency, a stimulus that was present is terminated by a response, which leads to an increase in responding; in a punishment contingency, a stimulus that was absent is presented following a response, which leads to a decrease in responding." "The terms positive and negative... do not refer to 'good' and 'bad' but to the type of stimulus change (presentation versus termination) that follows behavior" (Catania, 2013). The book calls this "the most common student error" and gives it dedicated cross-chapter attention (Ch. 11 flags it, Ch. 12 addresses it fully).
**Source:** Ch. 12, "Negative Reinforcement Versus Punishment" (line ~10795–10798); Ch. 11, Box 11.1 (line ~9702).
**Relevance:** A durable content-accuracy rule for any future copy that touches negative reinforcement or punishment concepts, even in passing/contrast.

---

## 3. Schedules of reinforcement

*Source chapter: Ch. 13 "Schedules of Reinforcement," lines 11224–12065.*

### Schedule of Reinforcement (general)
**Definition:** "A schedule of reinforcement is a rule that describes a contingency of reinforcement, the environmental arrangements that determine conditions by which behaviors will produce reinforcement" — "a rule that establishes the probability that a specific occurrence of a behavior will produce reinforcement."
**Source:** Ch. 13, opening paragraph (line ~11242); Summary point 1 (line ~11843).
**Relevance:** The umbrella concept the sim's `SchedulePlan` type implements ([Data Model §2](architecture/data-model.md#2-session-state)).

### Continuous Reinforcement (CRF) and Extinction (EXT) — the two boundary cases
**Definition:** "A schedule of continuous reinforcement (CRF) provides reinforcement for each occurrence of behavior." "During extinction (EXT), no occurrence of the behavior produces reinforcement." CRF and EXT are "the boundaries for all other schedules of reinforcement."
**Source:** Ch. 13, opening paragraph (line ~11242).
**Relevance:** Frames the sim's schedule spectrum (100% reinforcement → 0%) with CRF and extinction at the two ends and VR-3 in between — matches the product's Round 0/1/2/3 progression (baseline → CRF → VR → optional extinction). Note: the chapter itself does **not** use the label "FR-1" for CRF (see [Findings](#findings-applied-to-the-projects-docs)).

### Acquisition (CRF) vs. Maintenance (Intermittent/VR) — the rationale for the sim's two-round structure
**Definition:** "CRF is used to strengthen behavior, primarily during the initial stages of learning new behaviors." "Intermittent reinforcement (INT) is used to maintain an established behavior, especially during maintenance stages of learning." Worked example: a study-behavior program that used CRF correctly to *establish* a behavior failed when the schedule was stopped abruptly instead of thinned — the fix offered is to keep reinforcing but "gradually offer fewer encouragements." A second example (music instruction) shows heavy near-continuous reinforcement early, thinning gradually as proficiency develops, until the activity contacts naturally occurring reinforcement.
**Source:** Ch. 13, "INTERMITTENT REINFORCEMENT" (line ~11244–11262).
**Relevance:** **Directly grounds the sim's CRF → VR-3 progression** ([Core Loop, Phase B](core-loop.md#phase-b-training-and-reinforcement-practice)). This is not an arbitrary two-stage design; it mirrors the textbook's own account of how acquisition and maintenance schedules are used together and why abrupt schedule termination (rather than gradual thinning) causes extinction.

### Ratio vs. Interval Schedules
**Definition:** "Ratio schedules require a number of responses before one response produces reinforcement... The participant's response rate determines the rate of reinforcement" (self-controlled). "Interval schedules require an elapse of time before a response produces reinforcement... The availability of reinforcement is time-controlled."
**Source:** Ch. 13, "Ratio and Interval Schedules" (line ~11266–11272, citing Lattal & Neef, 1996 for ratio-schedule prevalence in applied treatment).
**Relevance:** Confirms ratio schedules (not interval) are the right family for a simulation where response *pace* should matter — validates VR as the v1 maintenance schedule choice over FI/VI.

### Fixed vs. Variable
**Definition:** "With a fixed schedule, the response ratio or the time requirement remains constant. With a variable schedule, the response ratio or the time requirement can change from one reinforced response to another." Combined with ratio/interval, these define the four basic intermittent schedules: FR, VR, FI, VI.
**Source:** Ch. 13, "Fixed and Variable Schedules" (line ~11276).

### Fixed Ratio (FR) — contrast case, not used in v1
**Definition:** "A fixed ratio (FR) schedule of reinforcement requires the completion of a fixed number of responses for a reinforcer" (e.g., every 4th response on FR 4).
**Response pattern:** "Break-and-run" — little hesitation once the ratio run starts, followed by a **postreinforcement pause**. Larger ratios and/or lower reinforcement magnitude tend to produce longer pauses (Schlinger, Derenne, & Baron, 2008, p. 43).
**Source:** Ch. 13, "Fixed Ratio Defined" (line ~11294–11296, citing Skinner, 1938); "Fixed Ratio Schedule Effects" (line ~11304–11320).
**Relevance:** The contrast case that motivates choosing VR: FR's postreinforcement pause is exactly the pattern the sim's VR-3 should *not* exhibit.

### Variable Ratio (VR) — the sim's v1 maintenance schedule
**Definition:** "A variable ratio (VR) schedule of reinforcement requires the completion of a variable number of responses to produce a reinforcer. A number representing the average (e.g., mean) number of responses required for reinforcement identifies the VR schedule" (e.g., VR 10 example: responses of 1, 14, 5, 19, 11 average to 10).
**Response pattern:** "VR schedules produce consistent, steady rates of response. They typically do not produce a postreinforcement pause, as do FR schedules... Responding remains steady because the next response may produce reinforcement."
**Source:** Ch. 13, "Variable Ratio Defined" (line ~11322–11324); "Variable Ratio Schedule Effects" (line ~11334–11342).
**Relevance:** **This is the textbook's own characterization of the pattern VR-3 should produce in the sim** — steady response rate, no postreinforcement pause. This is a checkable property when validating the sim's response-generation model.

### VR construction in applied settings — direct support for VR-3 built from [2, 3, 4]
**Definition:** "Teachers can plan variable ratios by (a) selecting a maximum ratio for a given activity (e.g., 15 responses) and (b) using a table of random numbers to produce the specific variable ratios for the schedule of reinforcement" — e.g., a sequence like 8, 1, 1, 14, 3, 10, 14, 15, 6 producing "a VR 8 schedule of reinforcement... with the ratios ranging from 1 to 15 responses." Classroom examples build pools with repeated low values (e.g., "five 1s, five 2s, five 3s"; Kauffman, Cullinan, Scranton, & Wallace, 1972).
**Source:** Ch. 13, "Variable Ratio Schedules in Applied Settings" (line ~11344–11426).
**Relevance:** Supports building a VR schedule from a small pool of values around the target mean — the method the book describes for hand-constructed applied VR schedules is structurally the same approach as v1's shuffled `[2, 3, 4]` block (mean 3). **Caveat (see Open Questions):** the book's own worked examples use wider, more varied pools than three closely-spaced values, and it never states a minimum pool size/variability — so this is *supportive precedent*, not textbook confirmation that a 3-value block is sufficient to reproduce the "no postreinforcement pause" effect.

### Schedule thinning — direct precedent for the CRF → VR-3 transition
**Definition:** "If a student has answered addition facts effectively and responded well to a CRF schedule for two or three sessions, the teacher might thin the reinforcement contingency slowly from one correct addition fact (CRF) to a VR 2 or VR 3 schedule." Analysts "should use small increments of schedule changes during thinning and ongoing evaluation of the learner's performance."
**Source:** Ch. 13, "THINNING INTERMITTENT REINFORCEMENT" (line ~11518–11541).
**Relevance:** **The textbook's own worked example of the first thinning step from CRF explicitly names "VR 2 or VR 3."** This is strong, direct precedent for the v1 default of thinning straight from CRF acquisition to VR-3 maintenance ([Core Loop, Round 2](core-loop.md#round-2-vr-maintenance); [`vrMeanRatio` = 3](architecture/data-model.md#6-configuration-constants)).

### Ratio Strain
**Definition:** "Ratio strain can result from abrupt increases in ratio requirements when moving from denser to thinner reinforcement schedules," or when the ratio becomes too large for reinforcement to maintain responding. "Common behavioral characteristics associated with ratio strain include avoidance, aggression, and unpredictable pauses in responding."
**Source:** Ch. 13, "THINNING INTERMITTENT REINFORCEMENT" (line ~11543–11544).
**Relevance:** Not directly modeled in v1 (no schedule-thinning-over-time feature beyond the single CRF→VR-3 step), but relevant background if a future version adds progressive thinning.

### Fixed Interval (FI) and Variable Interval (VI) — not used in v1
**Definition:** FI: "provides reinforcement for the first response following a fixed duration of time"; produces an **FI scallop** — "an initially slow but accelerating rate of response... toward the end of the interval." VI: "provides reinforcement for the first correct response following the elapse of variable durations of time... in a random or nearly random order" (Ferster & Skinner, 1957, p. 326); produces "a constant, stable rate of response," typically low to moderate.
**Source:** Ch. 13, "Fixed Interval Schedules" (line ~11428–11468); "Variable Interval Schedules" (line ~11470–11500).
**Relevance:** Explicitly out of v1 scope ([Product Spec §4](product-spec.md#4-mvp-scope): "FI, FR values other than FR-1/CRF, and VI schedules"). Retained for glossary completeness and possible future work.

### Compound Schedules — out of scope for v1, noted for future work
**Definition:** *(brief, as given)* **Concurrent** — two+ independent, simultaneous schedules, each with its own S<sup>D</sup>. **Multiple** — two+ schedules alternating (usually randomly), each with its own S<sup>D</sup>. **Chained** — like multiple, but fixed order, and completing each element is conditioned reinforcement for the next. **Mixed** — like multiple, no S<sup>D</sup>s. **Tandem** — like chained, no S<sup>D</sup>s. **Alternative** — reinforcement on whichever of two+ simultaneously available schedules is completed first. **Conjunctive** — reinforcement requires completing two+ schedule requirements together.
**Source:** Ch. 13, "COMPOUND SCHEDULES OF REINFORCEMENT" (line ~11650–11764).
**Relevance:** None needed for v1's single-schedule design; flagged as the natural vocabulary for future multi-behavior or multi-schedule features (e.g., a chained trick sequence).

### Caution: schedule effects are best-established in controlled/lab settings
**Definition:** "Many behavior analysts today question the generality of the schedule effects presented in the next sections... Verbal behavior allows humans to make and use rules that can influence their responses to schedules of reinforcement (i.e., rule-governed behavior)." Applied behavior analysts "should use caution in extrapolating these effects to applied settings" because "most applied applications of schedules of reinforcement only approximate true laboratory schedules of reinforcement" (Nevin, 1998).
**Source:** Ch. 13, "SCHEDULE EFFECTS AND CONSISTENCY OF PERFORMANCE" (line ~11282–11292); "PERSPECTIVES ON USING SCHEDULES OF REINFORCEMENT IN APPLIED SETTINGS" (line ~11799–11816).
**Relevance:** Legitimate basis for presenting the FR/VR/FI/VI response-pattern signatures in the sim as *idealized/expected* patterns rather than guaranteed real-world outcomes — worth a caveat anywhere the debrief claims "VR produces steady responding" in absolute terms.

### Intended vs. actually-delivered schedule — direct precedent for the sim's core invariant
**Definition:** The chapter repeatedly distinguishes a schedule's *label* (the planned, average contingency) from what is *actually delivered*: "A number representing the average (e.g., mean) number of responses required for reinforcement identifies the VR schedule" (actual per-cycle ratios vary around that mean); for FI, "a common procedural misunderstanding... is to assume that the elapse of time alone is sufficient for the delivery of a reinforcer... more time than the fixed interval can elapse between reinforced responses." The book also distinguishes true schedule instances from everyday situations that only "approximate" a schedule.
**Source:** Ch. 13, "Ratio and Interval Schedules" (line ~11268); "Variable Ratio Defined" (line ~11324); "Fixed Interval Schedules" (line ~11430–11434).
**Relevance:** **This is the closest textbook anchor to [ADR 0003](adr/0003-eligibility-vs-experienced-consequences-invariant.md), the project's "eligibility vs. experienced consequences" invariant.** A labeled schedule (e.g., VR-3) describes the long-run intended average, not a promise about any specific cycle — exactly the distinction the sim's data model encodes by separating `criterion-met` (eligibility) from `stimulus-delivered` (the experienced consequence).

---

## 4. Motivating operations

*Source chapter: Ch. 16 "Motivating Operations," lines 13587–14270.*

### Motivating Operation (MO), Establishing Operation (EO), Abolishing Operation (AO)
**Definition:** "An MO can be defined as an environmental variable that has two effects: value-altering and behavior-altering effects." The **value-altering effect** is "(a) an increase in the reinforcing effectiveness of some stimulus... in which case the MO is an establishing operation (EO); or (b) a decrease in reinforcing effectiveness, in which case the MO is an abolishing operation (AO)." The **behavior-altering effect** is "(a) an increase in the current frequency of behavior that has been reinforced by some stimulus... called an evocative effect; or (b) a decrease... called an abative effect." Term proposed by Laraway, Snycerski, Michael, & Poling (2003) to cover both strengthening and weakening effects.
**Source:** Ch. 16, "Definition and Characteristics of Motivating Operations" (line ~13619–13661).
**Relevance:** This is the formal basis for the sim's `currentValue` field on each stimulus and its mood/satiation mechanics ([Data Model §2, §4](architecture/data-model.md)). Note the textbook separates *value* (potency as a reinforcer) from *behavior frequency* (rate of the reinforced response) as two distinct, only loosely coupled effects — the sim's design docs currently treat these somewhat interchangeably via a single `currentValue` number; worth a note if the model is ever refined (see Open Questions).

### Unconditioned Motivating Operation (UMO) / Conditioned Motivating Operation (CMO)
**Definition:** UMOs have "unconditioned value-altering effects... in the absence of prior learning" — e.g., "food deprivation and painful stimulation are unconditioned motivating operations." CMOs "alter the reinforcing effectiveness of other stimuli... as a result of the organism's learning history," with three subtypes: **surrogate (CMO-S)**, **reflexive (CMO-R)**, and **transitive (CMO-T)**.
**Source:** Ch. 16, "Unconditioned Motivating Operations" (line ~13739–13749); "Conditioned Motivating Operations" (line ~13835–13996).
**Relevance:** Food/treat deprivation as the pet's baseline drive is a UMO, matching the book's own primary example. CMOs are likely out of scope for v1's single-session design; flagged for any future "learned cue predicts treat availability" feature, which should be modeled carefully to avoid conflating a CMO with a discriminative stimulus (see next entry).

### MOs vs. Discriminative Stimuli (S<sup>D</sup>) — a guardrail for any future cueing feature
**Definition:** "An S<sup>D</sup> affects behavior because its presence has been correlated with the differential *availability* of an effective reinforcer... An MO, in contrast, controls behavior because of its relation to the differential *effectiveness* of a reinforcer... In nontechnical terms, an S<sup>D</sup> tells you that something you want is available; an MO makes you want something."
**Source:** Ch. 16, "DISTINGUISHING BETWEEN MOs AND S<sup>D</sup>s" (line ~13703–13737).
**Relevance:** If the sim ever adds a visible cue (e.g., a treat pouch), it should be modeled as an S<sup>D</sup> (signals availability) rather than as an MO (changes value) — these are mechanically distinct and should not be conflated in the simulation's event model.

### Satiation and Deprivation
**Definition:** Not given single boxed definitions; operationalized as AO/UMO processes. "Food ingestion (consuming food) is an AO that decreases the effectiveness of food as a reinforcer (value-altering effect) and abates all behavior that has been followed by food reinforcement (behavior-altering effect)." Conversely, "water deprivation momentarily establishes the effectiveness of water as a reinforcer and evokes all behaviors that have produced water."
**Source:** Ch. 16, "Definition and Characteristics of Motivating Operations" (line ~13639); Tables 16.1–16.2 (line ~13751–13791).
**Relevance:** Direct grounding for [Data Model §4](architecture/data-model.md#4-response-generation-and-learning)'s "repeated access gradually reduces a stimulus's `currentValue`" — satiation is specifically an AO/value-altering effect, and the textbook separately identifies a *behavior-altering* effect (reduced reinforcer-seeking) that the sim should also expect to see reflected in `currentRatePerMinute`, not just in a hidden value number.

---

## 5. Extinction

*Source: Ch. 24 (within Part 9, "Decreasing Behavior with Nonpunishment Procedures"), lines 19880–20200.*

### Extinction — procedure, process, and principle
**Definition:** "Extinction as a behavior change tactic occurs when reinforcement of a previously reinforced behavior is discontinued; as a result, the occurrence of that behavior decreases in the future." Three technical senses: "(a) withholding the reinforcer for a previously reinforced behavior (the procedure), (b) a decreasing response rate under an extinction procedure (the process), or (c) the functional relation between withholding reinforcement for a previously reinforced behavior and the resultant diminishing rate of response (the principle)." "An extinction procedure does not prevent the target behavior from occurring. Rather, extinction terminates the response–reinforcer relation."
**Source:** Ch. 24, "EXTINCTION DEFINED" (line ~19911–19925).
**Relevance:** Directly grounds Round 3 of the sim ([Core Loop, Round 3](core-loop.md#round-3-optional-extinction-effects-demonstration)) and confirms extinction requires a *previously reinforced* response — v1's design correctly gates extinction behind an established VR history.

### Caution: "extinction" as a precise technical term
**Definition:** "With the possible exception of negative reinforcement, extinction is the most misunderstood and misused technical term in applied behavior analysis." Four documented misuses: (1) calling *any* decrease in behavior "extinction" even when caused by an AO, punishment, or differential reinforcement; (2) confusing extinction with forgetting ("In forgetting, a behavior is weakened by the passage of time... In extinction, behavior is weakened because it does not produce reinforcement"); (3) confusing response blocking with extinction ("response blocking prevents the occurrence of the target behavior" — it is not an extinction procedure); (4) confusing noncontingent reinforcement (NCR) with extinction ("Extinction diminishes behavior by eliminating the reinforcing consequence; NCR diminishes behavior by creating an abolishing operation").
**Source:** Ch. 24, "Extinction: Misuses of a Technical Term" and Box 24.1 (line ~19941–19991).
**Relevance:** Directly supports the project's own caution about precise terminology use — copy should never describe a behavior as having "extinguished" merely because it decreased for any reason (satiation, an AO, or simply less player engagement).

### Extinction Burst — likelihood, not inevitability
**Definition:** "A common effect of the extinction procedure is an immediate increase in the rate of the response after removing the positive, negative, or automatic reinforcement... The behavioral literature uses the term extinction burst to identify this initial increase in rate of response." Operational definition (Lerman, Iwata, & Wallace, 1999, p. 3): "an increase in responding during any of the first three treatment sessions above that observed during all of the last five baseline sessions or all of baseline."
**Source:** Ch. 24, "Extinction Burst" (line ~20062–20064).

**On prevalence — important for the sim's "not inevitable" framing:** the textbook states, verbatim: **"The extinction burst is well documented in basic research, but not well documented in applied research (Lerman & Iwata, 1995, 1996a). When reported, the bursts have occurred for only a few sessions without notable problems."** The chapter does **not** give a quantified base rate for how often bursts occur in applied settings, and never claims universality.
**Relevance:** This textbook passage is consistent with — but does not itself supply — the "an extinction burst may occur... a burst is not inevitable" language already in [Core Loop, Round 3](core-loop.md#round-3-optional-extinction-effects-demonstration) and the [derived-metrics burst rule](architecture/data-model.md#5-derived-metrics). The project's separate citation of **Muething et al. (2024)** for burst prevalence is a different, more recent source outside this textbook (published after the 3rd edition) and was not re-verified as part of this pass — the two sources should be cited separately and not conflated (the textbook establishes the *qualitative* "documented but not universal" framing; Muething et al. would need to independently support any *quantitative* prevalence claim).

### Other secondary effects of extinction
**Definition:**
- **Response variation** (*extinction-induced variability*): "Diverse and novel forms of behavior are sometimes observed during the extinction process" (Kinloch, Foster, & McEwan, 2009) — can be undesirable or desirable/adaptive.
- **Initial increase in response magnitude**: intensity/force of the response may increase early in extinction, distinct from a rate increase.
- **Spontaneous recovery**: "the reappearance of the behavior after it has diminished to its pre-reinforcement level or stopped entirely," even though it still produces no reinforcement; "short-lived and limited if the extinction procedure remains in effect" (Rescorla, 2004).
- **Resurgence**: "An operant behavior that has undergone extinction can return ('resurge') when a second operant that has replaced it itself undergoes extinction" (Winterbauer, Lucke, & Bouton, 2013) — requires a specific three-phase history (target reinforced → target extinguished while an alternative is reinforced → both extinguished). **Not the same as spontaneous recovery**, and not applicable unless the sim models an alternative-behavior-reinforcement phase.
- **Emotional responding/aggression**: extinction "may occasion an increase in intensity or force of the response, and may evoke other emotional or aggressive behaviors" (Vollmer & Athens, 2011) — framed as possible ("may"), not guaranteed.
**Source:** Ch. 24, "SECONDARY EFFECTS OF EXTINCTION" (line ~20054–20118).
**Relevance:** Response variation and magnitude increase are secondary effects distinct from a rate-based "burst" and could, if the sim wants finer fidelity, be visualized separately. **Resurgence should not be used to label the sim's Round 3 outcome** — v1 has no alternative-behavior-reinforcement phase, so only spontaneous recovery (not resurgence) would technically apply.

### Resistance to Extinction and its variables
**Definition:** "Behavior analysts refer to continued responding during an extinction procedure as resistance to extinction. Resistance to extinction is a relative concept." Variables affecting it, per the book's own **"tentative statements"**:
- **Schedule history**: "Intermittent reinforcement (INT) may produce behavior with greater resistance to extinction than behavior previously reinforced by continuous reinforcement (CRF)" and "variable schedules... may yield behavior more resistant to extinction than fixed schedules" — but the book itself notes mixed findings (e.g., Lerman et al., 1996 found extinction bursts more likely following CRF than INT; MacDonald et al., 2013 found *more* persistence following CRF than INT in one study).
- **Motivating operations**: "resistance to extinction is greater when extinction is carried out under high motivation than under low" (Keller & Schoenfeld, 1950, p. 75).
- **Number, magnitude, and quality of reinforcement**: longer reinforcement history and higher-quality/-magnitude reinforcers tend to produce more resistant behavior.
- **Number of prior extinction exposures**: "with each successive application of extinction, decreases in behavior become increasingly rapid."
- **Response effort**: "A response requiring greater effort diminishes more quickly during extinction than a response requiring less effort" (Lerman & Iwata, 1996a).
**Source:** Ch. 24, "VARIABLES AFFECTING RESISTANCE TO EXTINCTION" (line ~20120–20146).
**Relevance:** The schedule-history and motivating-operation variables are the strongest candidates for driving the sim's seeded, probabilistic extinction outcome (per [Data Model §4](architecture/data-model.md#4-response-generation-and-learning), "extinction transitions are parameterized and seeded"). **Important accuracy note:** the book explicitly hedges these as "tentative statements," not firm laws, and reports at least one contradicting applied finding — any in-sim claim that "VR always produces more resistant behavior than CRF" would overstate the source.

---

## Findings applied to the project's docs

Two concrete, textbook-verified issues surfaced during this pass:

1. **Citation attributed to the wrong preference-assessment method (resolved).** An earlier Product Spec revision cited DeLeon & Iwata (1996) without clarifying that it describes **MSWO**, which is explicitly **out of scope for v1** ([Product Spec §4](product-spec.md#4-mvp-scope)). [Product Spec §7](product-spec.md#7-educational-references) now identifies Fisher et al. (1992) as the source for the paired-stimulus method v1 implements and retains DeLeon & Iwata only as background for the deferred MSWO format.

2. **"FR-1" is a reasonable inference, not the textbook's own label for CRF.** Ch. 13 defines CRF on its own terms and does not equate it with "FR-1" notation in the assigned range; "FR-1" is a natural but inferred equivalence (a ratio requirement of 1). This doesn't require a doc change — [Product Spec §2](product-spec.md#2-learning-objectives-and-educational-boundaries) and [Core Loop](core-loop.md) already write "CRF/FR-1" together, which reads as the intended informal equivalence rather than a misattributed quote — flagged here only so nobody cites Ch. 13 as the source of the term "FR-1" specifically.

The product spec's educational-references list has been updated accordingly (see diff in this change).

---

## Open questions and ambiguities

Consolidated from all four extraction passes. None of these require immediate action; they're flagged so design decisions that touch them are made knowingly rather than by accident.

1. **No single "required" trial/pairing count for paired-stimulus assessment.** The book leaves trial count to analyst discretion (citing Piazza et al., 1996's 66–120 trials as one example, not a rule). V1's six-trial (one full pass) design is a legitimate simplification for session-length reasons, not a textbook-mandated number — should not be described as "the standard" trial count.
2. **VR pool/block construction — sufficiency of a 3-value block is untested by the source.** The book's own VR-construction examples use larger, more varied pools (e.g., ratios 1–15 for VR 8) than v1's `[2, 3, 4]` block. The text neither confirms nor rules out whether a 3-value block reproduces the "no postreinforcement pause" effect it attributes to VR schedules generally — this is a genuine gap, not something the source resolves.
3. **Extinction burst prevalence has no quantified base rate in this textbook.** It documents the phenomenon's existence and applied-research scarcity but gives no percentage. The project's Muething et al. (2024) citation is a separate, more recent source and should not be presented as if it were validated by this textbook passage.
4. **Value-altering vs. behavior-altering effects of an MO are conceptually distinct** but the sim's data model currently represents satiation with a single `currentValue` number per stimulus, without a separately modeled behavior-altering/abative effect on response rate. Not a defect — v1's response-rate model does account for "the delivered stimulus's current value" as one input ([Data Model §4](architecture/data-model.md#4-response-generation-and-learning)) — but if the team wants tighter fidelity to the MO framework later, the two effects could be modeled (and possibly visualized) separately.
5. **Resurgence vs. spontaneous recovery.** V1's extinction round has no alternative-behavior-reinforcement phase, so any "the behavior came back" moment in the sim is, at most, spontaneous recovery — never resurgence, which requires the specific three-phase history described above. Debrief/coaching copy should avoid the word "resurgence."
6. **Schedule-history resistance-to-extinction claims are explicitly "tentative" in the source**, with at least one contradicting applied finding cited by the book itself. Any debrief language implying VR maintenance *guarantees* more persistent responding under extinction than CRF would overstate the textbook.
7. **The word "putative"** (used in [Core Loop, Phase A](core-loop.md#phase-a-paired-stimulus-preference-assessment) — "candidate/putative reinforcers") does not itself appear in Ch. 11–12; the underlying concept (preferred ≠ demonstrated reinforcer) is thoroughly and repeatedly present, just under different phrasing ("potential reinforcers," "presumed... reinforcer," "highly preferred stimuli may not always function as reinforcers"). No change recommended — this is a fine, standard field term — flagged only for traceability.
8. **Aversive stimulus** is flagged by the textbook's own notes as used with more than one meaning across the literature (termination-reinforcer, presentation-punisher, or MO) — not directly relevant to v1's punishment-free design, but worth avoiding if this term is ever used loosely in future copy.
