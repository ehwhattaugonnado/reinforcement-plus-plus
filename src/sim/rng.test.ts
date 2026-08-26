import { describe, expect, it } from 'vitest'
import { createRng } from './rng'

describe('seeded rng', () => {
  it('is reproducible for the same seed and label', () => {
    const a = createRng('s', 'behavior')
    const b = createRng('s', 'behavior')
    const draw = (r: ReturnType<typeof createRng>) =>
      Array.from({ length: 20 }, () => r.next())
    expect(draw(a)).toEqual(draw(b))
  })

  it('gives independent streams per label, so one round cannot shift another', () => {
    const a = createRng('s', 'setup')
    const b = createRng('s', 'behavior')
    expect(a.next()).not.toBe(b.next())
  })

  it('produces different sequences for different seeds', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next())
  })

  it('stays in range', () => {
    const r = createRng('range')
    for (let i = 0; i < 1000; i++) {
      const u = r.next()
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThan(1)
      const n = r.nextInt(2, 4)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(4)
    }
  })

  it('shuffles deterministically without dropping or duplicating items', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const a = createRng('sh').shuffle(items)
    const b = createRng('sh').shuffle(items)
    expect(a).toEqual(b)
    expect([...a].sort((x, y) => x - y)).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6]) // input untouched
  })

  it('counts draws so a rejected command can be proven to consume none', () => {
    const r = createRng('draws')
    expect(r.draws).toBe(0)
    r.next()
    r.next()
    expect(r.draws).toBe(2)
  })

  it('produces exponential samples with roughly the requested mean', () => {
    const r = createRng('exp')
    let total = 0
    const n = 20000
    for (let i = 0; i < n; i++) total += r.nextExponential(1000)
    expect(total / n).toBeGreaterThan(940)
    expect(total / n).toBeLessThan(1060)
  })
})
