import type { SimConfig } from './config'
import { createRng } from './rng'
import { STIMULUS_IDS, TARGET_BEHAVIOR_ID, allUniquePairs } from './stimuli'
import type { SessionState } from './types'

/**
 * Derives the seeded starting conditions. Every value here is a pure function
 * of the seed, which is what lets replay reconstruct a session from the seed
 * plus the event log alone (ADR 0009).
 *
 * Each new run seeds a new initial motivating condition; because v1 has no
 * persistence, nothing carries across sessions (ADR 0006).
 */
export function createInitialState(
  seed: string,
  speed: 0.5 | 1,
  config: SimConfig,
): SessionState {
  const setupRng = createRng(seed, 'setup')

  // Latent preferences vary between runs. Spread them enough that a hierarchy
  // is discoverable, without making any stimulus a certainty.
  const basePreferences = setupRng
    .shuffle([0.85, 0.65, 0.4, 0.2])
    .map((p) => p + (setupRng.next() - 0.5) * 0.08)

  const stimuli = STIMULUS_IDS.map((stimulusId, i) => {
    const basePreference = basePreferences[i] as number
    return { stimulusId, basePreference, currentValue: basePreference }
  })

  const baselineRatePerMinute = 2 + setupRng.next() * 2

  // The six unique pairs are generated once, in seeded order, with seeded
  // left/right placement (core loop, Phase A).
  const plannedPairs = setupRng
    .shuffle(allUniquePairs())
    .map((pair) =>
      setupRng.next() < 0.5 ? pair : ([pair[1], pair[0]] as const),
    )

  // Drawn last, after every other setupRng usage above, so no existing
  // seed's assessment pairs or baseline rate shift.
  const extinctionBurstPrimed =
    setupRng.next() < config.extinctionBurstProbability
  const extinctionBurstMagnitudeScale = 0.5 + setupRng.next() * 1

  return {
    id: `session-${seed}`,
    seed,
    phase: 'assessment',
    elapsedSimMs: 0,
    speed,
    paused: false,
    creature: {
      id: 'creature-1',
      name: 'Pip',
      moodState: 'neutral',
      stimuli,
      targetBehavior: {
        behaviorId: TARGET_BEHAVIOR_ID,
        baselineRatePerMinute,
        learnedStrength: 0,
        currentRatePerMinute: baselineRatePerMinute,
        extinctionBurstPrimed,
        extinctionBurstMagnitudeScale,
      },
    },
    assessment: {
      plannedPairs,
      trials: [],
      currentTrialIndex: 0,
      complete: false,
    },
    schedulePlan: null,
    events: [],
  }
}
