/**
 * Seeded, framework-independent pseudo-random number generation.
 *
 * The simulation never calls `Math.random`. Every stochastic decision draws
 * from a stream derived from the session seed, so a seed plus an event log
 * reconstructs a session exactly (ADR 0001).
 */

export type Rng = {
  /** Uniform in [0, 1). */
  next(): number
  /** Integer in [min, max]. */
  nextInt(min: number, max: number): number
  /** Exponentially distributed sample with the given mean. */
  nextExponential(meanMs: number): number
  /** Fisher-Yates shuffle returning a new array. */
  shuffle<T>(items: readonly T[]): T[]
  /** Number of draws consumed, so tests can assert a rejection drew nothing. */
  readonly draws: number
}

/** cyrb128: expands a string seed into four 32-bit values. */
function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [
    (h1 ^ h2 ^ h3 ^ h4) >>> 0,
    (h2 ^ h1) >>> 0,
    (h3 ^ h1) >>> 0,
    (h4 ^ h1) >>> 0,
  ]
}

/**
 * Creates an independent RNG stream. `label` namespaces the stream so that,
 * for example, drawing an extra assessment sample cannot shift the response
 * timings a later round would have produced.
 */
export function createRng(seed: string, label = 'default'): Rng {
  let [a, b, c, d] = hashSeed(`${seed}::${label}`)
  let draws = 0

  // sfc32
  function raw(): number {
    draws++
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }

  return {
    next: raw,
    nextInt(min, max) {
      return min + Math.floor(raw() * (max - min + 1))
    },
    nextExponential(meanMs) {
      // 1 - u avoids log(0) when raw() returns exactly 0.
      return -Math.log(1 - raw()) * meanMs
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(raw() * (i + 1))
        const atI = out[i] as T
        const atJ = out[j] as T
        out[i] = atJ
        out[j] = atI
      }
      return out
    },
    get draws() {
      return draws
    },
  }
}
