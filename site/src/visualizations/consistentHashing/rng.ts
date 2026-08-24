/**
 * HAND-WRITTEN — yours. Do not let an agent fill these in.
 *
 * A seeded pseudo-random generator. Everything random in a run draws from one
 * of these, so the same seed reproduces the run exactly. That is what makes
 * seeking backwards possible and what makes the tests repeatable.
 */

import type { KeyId, Rng } from './types'

/**
 * TODO(human): implement a seeded PRNG.
 *
 * Suggestion: **mulberry32** — about six lines, fast, and good enough for a
 * visualization. Do NOT use Math.random anywhere: it cannot be seeded, which
 * would break replay.
 *
 * The shape of mulberry32, in words:
 *   - keep a 32-bit integer state, initialised from the seed
 *   - each call: advance the state by a large odd constant (0x6D2B79F5)
 *   - scramble it with a couple of xor/shift/multiply steps
 *   - divide by 2^32 to land in [0, 1)
 *
 * Two things to watch in JavaScript:
 *   - JS bitwise operators coerce to *signed* 32-bit. Use `>>> 0` to force an
 *     unsigned result before dividing.
 *   - `Math.imul(a, b)` does true 32-bit multiplication; plain `*` will lose
 *     precision above 2^53 and silently ruin the distribution.
 *
 * `nextInt(min, max)` is inclusive at both ends.
 */


function mulberry32(seed: number): () => number {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// const random = mulberry32(42); // Seed with 42
// console.log(random()); // Always ~0.5377 for this seed
// console.log(random()); // Next: ~0.8913

export function createRng(seed: number): Rng {
  const generator = mulberry32(seed);
  return {
    seed,
    next(): number {
      return generator();
    },
    nextInt(min: number, max: number): number {
      const range = max - min + 1;
      return Math.floor(generator() * range) + min;
    }
  };
}

/**
 * TODO(human): generate `count` key ids from the generator.
 *
 * Three or four lines. The ids only need to be distinct and reproducible —
 * something like `key:<n>` where n is drawn from the rng, or a simple counter
 * combined with a random component. Your call; the only hard requirement is
 * that the same rng state produces the same list.
 */
export function generateKeys(rng: Rng, count: number): KeyId[] {
  const keys: KeyId[] = [];
  for (let i = 0; i < count; i++) {
    keys.push(`${rng.next()}`);
  }
  return keys;
}
