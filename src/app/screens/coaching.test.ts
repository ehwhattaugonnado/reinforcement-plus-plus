import { describe, expect, it } from 'vitest'
import type { CrfMetrics } from '../../sim'
import {
  COACHING_COPY,
  deriveCrfCoaching,
  deriveVrCoaching,
  type CoachingFinding,
} from './coaching'

/**
 * A coaching pause fires on elapsed time alone. Before this derivation
 * existed, the copy it triggered told every learner they had repeated one
 * response count — an accusation the event log routinely contradicted, in a
 * product whose first principle is that nothing is asserted and everything
 * is derived. These tests pin the finding to the evidence.
 */

function crfMetrics(overrides: Partial<CrfMetrics> = {}): CrfMetrics {
  return {
    deliveries: 0,
    contingentDeliveries: 0,
    noncontingentDeliveries: 0,
    prematureDeliveries: 0,
    onScheduleDeliveries: 0,
    overrunDeliveries: 0,
    promptContingentDeliveries: 0,
    missedCriteria: 0,
    abandonedCycles: 0,
    contingentDeliveryRate: null,
    promptDeliveryRate: null,
    scheduleFidelity: null,
    medianLatencyMs: null,
    ...overrides,
  }
}

const vrTally = (o: Partial<Parameters<typeof deriveVrCoaching>[0]> = {}) => ({
  deliveries: 0,
  noncontingent: 0,
  notVariable: 0,
  premature: 0,
  overrun: 0,
  onSchedule: 0,
  ...o,
})

describe('deriveCrfCoaching', () => {
  it('reports a clean round as on-track rather than inventing a fault', () => {
    const metrics = crfMetrics({
      deliveries: 8,
      contingentDeliveries: 8,
      promptContingentDeliveries: 8,
      onScheduleDeliveries: 8,
      contingentDeliveryRate: 1,
      promptDeliveryRate: 1,
      scheduleFidelity: 1,
    })
    expect(deriveCrfCoaching(metrics)).toBe('on-track')
  })

  it('names an empty round as such', () => {
    expect(deriveCrfCoaching(crfMetrics())).toBe('no-deliveries')
  })

  it('prioritises noncontingent deliveries, which cannot reinforce anything', () => {
    const metrics = crfMetrics({
      deliveries: 5,
      contingentDeliveries: 4,
      noncontingentDeliveries: 1,
      promptContingentDeliveries: 4,
      promptDeliveryRate: 1,
    })
    expect(deriveCrfCoaching(metrics)).toBe('noncontingent')
  })

  it('reports lateness when most contingent deliveries missed the prompt window', () => {
    const metrics = crfMetrics({
      deliveries: 6,
      contingentDeliveries: 6,
      promptContingentDeliveries: 1,
      promptDeliveryRate: 1 / 6,
    })
    expect(deriveCrfCoaching(metrics)).toBe('late')
  })

  it('reports missed opportunities only when they outnumber the reinforced ones', () => {
    const base = {
      deliveries: 2,
      contingentDeliveries: 2,
      promptContingentDeliveries: 2,
      promptDeliveryRate: 1,
    }
    expect(deriveCrfCoaching(crfMetrics({ ...base, missedCriteria: 5 }))).toBe(
      'missed',
    )
    expect(deriveCrfCoaching(crfMetrics({ ...base, missedCriteria: 1 }))).toBe(
      'on-track',
    )
  })
})

describe('deriveVrCoaching', () => {
  it('does not tell a correctly varying learner to vary their pattern', () => {
    // The exact shape of the run that produced the original misdiagnosis:
    // credited deliveries, nothing blocked, simply not finished yet.
    expect(deriveVrCoaching(vrTally({ deliveries: 4, onSchedule: 4 }))).toBe(
      'on-track',
    )
  })

  it('reports an over-predictable pattern only when the log shows one', () => {
    expect(deriveVrCoaching(vrTally({ deliveries: 5, notVariable: 3 }))).toBe(
      'not-variable',
    )
  })

  it('distinguishes premature from overrun deliveries', () => {
    expect(deriveVrCoaching(vrTally({ deliveries: 4, premature: 3 }))).toBe(
      'premature',
    )
    expect(deriveVrCoaching(vrTally({ deliveries: 4, overrun: 3 }))).toBe(
      'overrun',
    )
  })

  it('puts noncontingent deliveries ahead of any fidelity finding', () => {
    expect(
      deriveVrCoaching(
        vrTally({ deliveries: 6, noncontingent: 1, notVariable: 4 }),
      ),
    ).toBe('noncontingent')
  })
})

describe('COACHING_COPY', () => {
  const findings: CoachingFinding[] = [
    'no-deliveries',
    'noncontingent',
    'late',
    'missed',
    'not-variable',
    'premature',
    'overrun',
    'on-track',
  ]

  it('covers every finding in both presentation modes', () => {
    for (const finding of findings) {
      expect(COACHING_COPY[finding].simple('Pip')).toBeTruthy()
      expect(COACHING_COPY[finding].advanced('Pip')).toBeTruthy()
    }
  })

  it('never blames the learner for variability when the finding is on-track', () => {
    // Both modes must reach the same conclusion (ADR 0004).
    for (const mode of ['simple', 'advanced'] as const) {
      const text = COACHING_COPY['on-track'][mode]('Pip')
      expect(text).not.toMatch(/rather than|instead of|too predictable/i)
      expect(text).toMatch(/nothing is going wrong|no fidelity problem/i)
    }
  })

  it('reinforces a response, never the creature (aba-glossary)', () => {
    for (const finding of findings) {
      for (const mode of ['simple', 'advanced'] as const) {
        expect(COACHING_COPY[finding][mode]('Pip')).not.toMatch(
          /reinforce Pip\b/i,
        )
      }
    }
  })
})
