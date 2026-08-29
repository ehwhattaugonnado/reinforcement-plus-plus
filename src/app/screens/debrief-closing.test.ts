import { describe, expect, it } from 'vitest'
import type { DebriefSummary } from '../../sim'
import { debriefClosing } from './debrief-closing'

/**
 * Constructed rather than seeded: the point of these is that the copy tracks
 * the counts it is given, including the shapes a cooperative seed rarely
 * produces (an abandoned session, a skipped VR round).
 */
function summary(over: {
  trialsRecorded?: number
  deliveries?: number
  vrCredited?: number
  vrRequired?: number
  totalResponses?: number
}): DebriefSummary {
  return {
    assessment: { trialsRecorded: over.trialsRecorded ?? 6 },
    crfMetrics: { deliveries: over.deliveries ?? 8 },
    vrCredited: over.vrCredited ?? 3,
    vrRequired: over.vrRequired ?? 3,
    totalResponses: over.totalResponses ?? 21,
  } as unknown as DebriefSummary
}

describe('debriefClosing', () => {
  it('reports what the log holds', () => {
    const text = debriefClosing(summary({}), 'Pip')
    expect(text).toContain('6 assessment trials')
    expect(text).toContain('8 deliveries')
    expect(text).toContain('3 of 3 variable-ratio cycles on schedule')
    expect(text).toContain('Pip responded 21 times')
  })

  it('omits a round the learner never ran rather than reporting a zero', () => {
    const text = debriefClosing(summary({ vrCredited: 0 }), 'Pip')
    expect(text).not.toMatch(/variable-ratio/)
    expect(text).toContain('8 deliveries')
  })

  it('concludes nothing when nothing was recorded', () => {
    const text = debriefClosing(
      summary({
        trialsRecorded: 0,
        deliveries: 0,
        vrCredited: 0,
        totalResponses: 0,
      }),
      'Pip',
    )
    expect(text).toMatch(/did not record enough/i)
    expect(text).toContain('Pip')
  })

  it('agrees with itself on singulars', () => {
    const text = debriefClosing(
      summary({
        trialsRecorded: 1,
        deliveries: 1,
        vrCredited: 0,
        totalResponses: 1,
      }),
      'Pip',
    )
    expect(text).toContain('recorded 1 assessment trial and made 1 delivery')
    expect(text).toContain('1 delivery')
    expect(text).toContain('responded 1 time')
  })

  it('never points the learner at the other presentation mode (ADR 0004)', () => {
    expect(debriefClosing(summary({}), 'Pip')).not.toMatch(
      /advanced|simple mode|switch to/i,
    )
  })

  it('keeps system units out of learner-facing copy (AGENTS.md)', () => {
    expect(debriefClosing(summary({}), 'Pip')).not.toMatch(
      /\bms\b|stimulusId|response-\d|\d\.\d{3}/,
    )
  })

  it('says nothing is saved, because nothing is (no persistence in v1)', () => {
    expect(debriefClosing(summary({}), 'Pip')).toMatch(/nothing is saved/i)
  })
})
