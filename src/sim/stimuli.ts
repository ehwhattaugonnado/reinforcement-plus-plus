/** The four v1 assessment stimuli. Display order is stable stimulus-ID order. */
export const STIMULUS_IDS = ['play', 'praise', 'toy', 'treat'] as const

export type StimulusId = (typeof STIMULUS_IDS)[number]

export const STIMULUS_LABELS: Record<StimulusId, string> = {
  play: 'Play',
  praise: 'Praise',
  toy: 'Toy',
  treat: 'Treat',
}

export function isStimulusId(id: string): id is StimulusId {
  return (STIMULUS_IDS as readonly string[]).includes(id)
}

/** All six unique unordered pairs, in stable order before seeded shuffling. */
export function allUniquePairs(): (readonly [StimulusId, StimulusId])[] {
  const pairs: (readonly [StimulusId, StimulusId])[] = []
  for (let i = 0; i < STIMULUS_IDS.length; i++) {
    for (let j = i + 1; j < STIMULUS_IDS.length; j++) {
      pairs.push([STIMULUS_IDS[i] as StimulusId, STIMULUS_IDS[j] as StimulusId])
    }
  }
  return pairs
}

export const TARGET_BEHAVIOR_ID = 'spin'
