/**
 * AGENT-OWNED — seeded randomness for this visualization.
 *
 * This is a second copy of mulberry32. The first lives in the consistent
 * hashing folder, and importing it here would be the first brick of a shared
 * simulation engine, which PLAN.md defers to November on purpose: the engine
 * is meant to be *extracted* from three working visualizations rather than
 * designed before two of them exist. Duplication is the cheaper mistake, and
 * it is explicitly the sanctioned one.
 *
 * When the extraction happens, these two copies are the evidence for what the
 * shared interface actually needs to be.
 */

export interface Rng {
  readonly seed: number
  /** Next float in [0, 1). */
  next(): number
  /** Next standard normal, mean 0 and variance 1. */
  normal(): number
}

const MULBERRY_INCREMENT = 0x6d2b79f5

export function createRng(seed: number): Rng {
  let state = seed

  const next = (): number => {
    state = (state + MULBERRY_INCREMENT) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    seed,
    next,

    /**
     * Box-Muller, returning one of the two normals it produces and discarding
     * the other.
     *
     * Keeping the spare would halve the calls to `next`, and would also make
     * the generator's output depend on how many normals had been drawn before
     * it rather than only on the seed and the call count. Reproducibility is
     * worth more here than the saved multiply.
     */
    normal(): number {
      // log(0) is -Infinity, so the first uniform must be pushed off zero.
      const u1 = Math.max(next(), Number.EPSILON)
      const u2 = next()
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    },
  }
}
