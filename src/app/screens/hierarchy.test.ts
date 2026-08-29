import { describe, expect, it } from 'vitest'
import { rankLabel, tieNote, tiedRanks } from './hierarchy'

/** Standard competition ranking, as `deriveAssessmentSummary` produces it. */
const withTies = [{ rank: 1 }, { rank: 1 }, { rank: 3 }, { rank: 3 }]
const noTies = [{ rank: 1 }, { rank: 2 }, { rank: 3 }, { rank: 4 }]

describe('tiedRanks', () => {
  it('reports every rank shared by more than one stimulus', () => {
    expect([...tiedRanks(withTies)].sort()).toEqual([1, 3])
  })

  it('reports nothing when every stimulus has its own rank', () => {
    expect(tiedRanks(noTies).size).toBe(0)
  })

  it('handles an empty hierarchy', () => {
    expect(tiedRanks([]).size).toBe(0)
  })

  it('reports a partial tie without implicating the untied ranks', () => {
    const tied = tiedRanks([{ rank: 1 }, { rank: 2 }, { rank: 2 }, { rank: 4 }])
    expect([...tied]).toEqual([2])
  })
})

describe('rankLabel', () => {
  it('names the tie so a skipped rank is explained, not just observed', () => {
    const tied = tiedRanks(withTies)
    expect(rankLabel(1, tied)).toBe('1 (tied)')
    expect(rankLabel(3, tied)).toBe('3 (tied)')
  })

  it('leaves an untied rank as a bare number', () => {
    expect(rankLabel(2, tiedRanks(noTies))).toBe('2')
  })
})

describe('tieNote', () => {
  it('says nothing when there is nothing to explain', () => {
    expect(tieNote(noTies, 'Pip')).toBeNull()
  })

  it('explains the skip in terms of how often the creature chose each item', () => {
    const note = tieNote(withTies, 'Pip')
    expect(note).not.toBeNull()
    expect(note).toContain('Pip')
    expect(note).toContain('equally often')
  })

  it('never calls a preferred stimulus a reinforcer (aba-glossary)', () => {
    expect(tieNote(withTies, 'Pip')).not.toMatch(/reinforcer/i)
  })

  it('keeps system units out of learner-facing copy (AGENTS.md)', () => {
    expect(tieNote(withTies, 'Pip')).not.toMatch(/\bms\b|stimulusId|\d\.\d{3}/)
  })
})
