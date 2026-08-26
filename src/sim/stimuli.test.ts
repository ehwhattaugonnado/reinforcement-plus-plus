import { describe, expect, it } from 'vitest'
import { STIMULUS_IDS, allUniquePairs, isStimulusId } from './stimuli'

describe('stimuli', () => {
  it('generates all six unique pairs exactly once', () => {
    const pairs = allUniquePairs()
    expect(pairs).toHaveLength(6)
    const keys = pairs.map((p) => [...p].sort().join('|'))
    expect(new Set(keys).size).toBe(6)
  })

  it('lists stimulus ids in stable display order', () => {
    expect([...STIMULUS_IDS]).toEqual([...STIMULUS_IDS].sort())
  })

  it('validates stimulus ids', () => {
    expect(isStimulusId('treat')).toBe(true)
    expect(isStimulusId('sandwich')).toBe(false)
  })
})
