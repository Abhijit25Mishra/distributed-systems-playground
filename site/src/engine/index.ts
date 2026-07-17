import type { SimConfig, SimEngine } from './types'

export type * from './types'
export type * from './eventLog'

/**
 * Factory for the hand-written engine.
 * TODO(human): implement the engine (see the contract in types.ts) and make
 * this return it. The skipped tests in engine.test.ts define "done".
 */
export function createSimEngine(config: SimConfig): SimEngine {
  void config
  throw new Error('TODO(human): sim engine not implemented yet — see site/src/engine/types.ts')
}
