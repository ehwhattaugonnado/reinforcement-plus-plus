import { describe, expect, it } from 'vitest'
import { DEFAULT_SIM_CONFIG } from './config'
import { createInitialState } from './initial-state'

const config = DEFAULT_SIM_CONFIG

describe('createInitialState extinction-burst priming', () => {
  it('is deterministic for a given seed', () => {
    const a = createInitialState('priming-seed', 1, config)
    const b = createInitialState('priming-seed', 1, config)
    expect(a.creature.targetBehavior.extinctionBurstPrimed).toBe(
      b.creature.targetBehavior.extinctionBurstPrimed,
    )
    expect(a.creature.targetBehavior.extinctionBurstMagnitudeScale).toBe(
      b.creature.targetBehavior.extinctionBurstMagnitudeScale,
    )
  })

  it('keeps the magnitude scale within [0.5, 1.5]', () => {
    const SEEDS = Array.from({ length: 30 }, (_, i) => `scale-seed-${i}`)
    for (const seed of SEEDS) {
      const state = createInitialState(seed, 1, config)
      const scale = state.creature.targetBehavior.extinctionBurstMagnitudeScale
      expect(scale).toBeGreaterThanOrEqual(0.5)
      expect(scale).toBeLessThanOrEqual(1.5)
    }
  })

  it('primes roughly extinctionBurstProbability of seeds across a cohort', () => {
    const SEEDS = Array.from({ length: 200 }, (_, i) => `cohort-seed-${i}`)
    let primed = 0
    for (const seed of SEEDS) {
      const state = createInitialState(seed, 1, config)
      if (state.creature.targetBehavior.extinctionBurstPrimed) primed++
    }
    const fraction = primed / SEEDS.length
    // Tolerant cohort bound, not a hard count (AGENTS.md probabilistic
    // guidance): default probability is 0.5, so expect roughly 30-70%.
    expect(fraction).toBeGreaterThan(0.3)
    expect(fraction).toBeLessThan(0.7)
  })
})
