/**
 * HAND-WRITTEN — yours. Do not let an agent fill these in.
 *
 * Two ways of assigning a key to a node:
 *   - `hash()` feeds the consistent hashing ring (see ring.ts)
 *   - `assignModN()` is the naive baseline the page exists to argue against
 *
 * Keeping both here makes the contrast obvious: they use the *same* hash, and
 * differ only in what they do with the result.
 */

import type { KeyId, NodeId, Position } from './types'

/**
 * TODO(human): map a string to a position on the ring, in [0, 2^32).
 *
 * Suggestion: **FNV-1a**, 32-bit. Around eight lines:
 *   - start from the offset basis 2166136261
 *   - for each character: xor the char code into the accumulator, then
 *     multiply by the prime 16777619
 *   - return the accumulator as unsigned
 *
 * Same JavaScript traps as the rng: use `Math.imul` for the multiply, and
 * `>>> 0` to return unsigned.
 *
 * The property that matters is **uniform distribution with avalanche** —
 * flipping one input bit should change about half the output bits. If the
 * hash clusters, virtual nodes stop helping and the whole visualization
 * shows the wrong lesson. There is a test for this.
 *
 * Do not reach for SHA-256: cryptographic strength is irrelevant here and the
 * cost is real when you are hashing 10^5 keys per run.
 */
export function hash(input: string): Position {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }

  // Finalizer (MurmurHash3's fmix32). AGENT-WRITTEN, at your request: these
  // are published constants, not a derivation.
  //
  // FNV-1a's last act is `imul(h ^ lastChar, PRIME)`, which leaves a linear
  // relationship between inputs sharing a prefix: `n1#0` and `n1#1` land
  // exactly one FNV prime apart, `n1#2` three primes further, and so on. Since
  // every virtual node id is `<nodeId>#<replica>`, all 150 replicas of a node
  // land in a handful of tight clumps instead of scattering around the ring,
  // load skew stops falling as V rises, and the page shows the wrong lesson.
  //
  // Each `h ^= h >>> k` folds high bits down into the low ones; each multiply
  // propagates them back across the whole word. Twice through and every input
  // bit has influenced every output bit, which is what kills the linearity.
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16

  // Math.imul returns a SIGNED 32-bit int, so this is not cosmetic: without it
  // hash can return a negative number, `assignModN` computes a negative array
  // index, and the baseline silently drops keys.
  return h >>> 0
}

/**
 * TODO(human): the naive baseline — assign a key by `hash(key) % nodeCount`.
 *
 * Three lines. This is the comparison the whole page is built around: it
 * distributes keys perfectly evenly, and then relocates almost *all* of them
 * the moment `nodeIds.length` changes. Watching that happen next to the ring
 * is what teaches why consistent hashing exists.
 *
 * Return undefined when there are no nodes.
 */
export function assignModN(key: KeyId, nodeIds: readonly NodeId[]): NodeId | undefined {
  return nodeIds.length === 0 ? undefined : nodeIds[hash(key) % nodeIds.length];
}
