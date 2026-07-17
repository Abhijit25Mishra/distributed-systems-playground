/**
 * Acceptance tests for the hand-written sim engine.
 * All skipped until the human implements the engine — remove `.skip` from the
 * describe block as you go. These tests define "done" for layer L1.
 */
import { describe, expect, it } from 'vitest'
import { createSimEngine } from './index'
import type { Message, MessageBusConfig, SimNode } from './types'

const RELIABLE_NETWORK: MessageBusConfig = {
  latency: { kind: 'fixed', min: 1 },
  dropRate: 0,
  partitions: [],
}

function makeEchoNode(id: string, received: Message[]): SimNode {
  return {
    id,
    onMessage(message) {
      received.push(message)
    },
  }
}

describe.skip('sim engine (hand-written — unskip as you implement)', () => {
  it('same seed produces identical event log', () => {
    const config = { seed: 42, bus: RELIABLE_NETWORK, maxSteps: 1_000 }

    const runOnce = () => {
      const engine = createSimEngine(config)
      const received: Message[] = []
      engine.addNode(makeEchoNode('n1', received))
      engine.addNode(makeEchoNode('n2', received))
      engine.schedule(0, () => {
        engine.bus.send({ from: 'n1', to: 'n2', body: { kind: 'ping' } })
        engine.bus.send({ from: 'n2', to: 'n1', body: { kind: 'ping' } })
      })
      engine.run()
      return engine.getEventLog()
    }

    const first = runOnce()
    const second = runOnce()
    expect(JSON.stringify(first.events)).toEqual(JSON.stringify(second.events))
  })

  it('different seeds produce different event orders under random latency', () => {
    const randomLatency: MessageBusConfig = {
      latency: { kind: 'uniform', min: 1, max: 100 },
      dropRate: 0,
      partitions: [],
    }

    const runWithSeed = (seed: number) => {
      const engine = createSimEngine({ seed, bus: randomLatency, maxSteps: 1_000 })
      const received: Message[] = []
      engine.addNode(makeEchoNode('n1', received))
      engine.addNode(makeEchoNode('n2', received))
      engine.schedule(0, () => {
        for (let i = 0; i < 20; i += 1) {
          engine.bus.send({ from: 'n1', to: 'n2', body: { kind: 'ping', i } })
        }
      })
      engine.run()
      return engine.getEventLog()
    }

    const logA = runWithSeed(1)
    const logB = runWithSeed(2)
    expect(JSON.stringify(logA.events)).not.toEqual(JSON.stringify(logB.events))
  })

  it('message drop rate 1 prevents all delivery', () => {
    const engine = createSimEngine({
      seed: 7,
      bus: { latency: { kind: 'fixed', min: 1 }, dropRate: 1, partitions: [] },
      maxSteps: 1_000,
    })
    const received: Message[] = []
    engine.addNode(makeEchoNode('n1', received))
    engine.addNode(makeEchoNode('n2', received))
    engine.schedule(0, () => {
      engine.bus.send({ from: 'n1', to: 'n2', body: { kind: 'ping' } })
    })
    engine.run()
    expect(received).toHaveLength(0)
    expect(engine.getEventLog().events.some((event) => event.type === 'drop')).toBe(true)
  })

  it('network partition blocks cross-group messages but not intra-group ones', () => {
    const engine = createSimEngine({
      seed: 7,
      bus: {
        latency: { kind: 'fixed', min: 1 },
        dropRate: 0,
        partitions: [
          ['n1', 'n2'],
          ['n3'],
        ],
      },
      maxSteps: 1_000,
    })
    const received: Message[] = []
    engine.addNode(makeEchoNode('n1', received))
    engine.addNode(makeEchoNode('n2', received))
    engine.addNode(makeEchoNode('n3', received))
    engine.schedule(0, () => {
      engine.bus.send({ from: 'n1', to: 'n2', body: { kind: 'intra' } })
      engine.bus.send({ from: 'n1', to: 'n3', body: { kind: 'cross' } })
    })
    engine.run()
    expect(received.map((message) => message.body.kind)).toEqual(['intra'])
  })

  it('virtual clock advances to each executed event time, never backwards', () => {
    const engine = createSimEngine({ seed: 7, bus: RELIABLE_NETWORK, maxSteps: 1_000 })
    const observedTimes: number[] = []
    engine.schedule(30, () => observedTimes.push(engine.clock.now()))
    engine.schedule(10, () => observedTimes.push(engine.clock.now()))
    engine.schedule(20, () => observedTimes.push(engine.clock.now()))
    engine.run()
    expect(observedTimes).toEqual([10, 20, 30])
  })

  it('same-time events execute in scheduling (FIFO) order', () => {
    const engine = createSimEngine({ seed: 7, bus: RELIABLE_NETWORK, maxSteps: 1_000 })
    const order: string[] = []
    engine.schedule(5, () => order.push('first'))
    engine.schedule(5, () => order.push('second'))
    engine.schedule(5, () => order.push('third'))
    engine.run()
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('step() executes exactly one event and reports queue exhaustion', () => {
    const engine = createSimEngine({ seed: 7, bus: RELIABLE_NETWORK, maxSteps: 1_000 })
    const order: string[] = []
    engine.schedule(1, () => order.push('a'))
    engine.schedule(2, () => order.push('b'))
    expect(engine.step()).toBe(true)
    expect(order).toEqual(['a'])
    expect(engine.step()).toBe(true)
    expect(order).toEqual(['a', 'b'])
    expect(engine.step()).toBe(false)
  })

  it('run() halts at maxSteps even if events keep rescheduling themselves', () => {
    const engine = createSimEngine({ seed: 7, bus: RELIABLE_NETWORK, maxSteps: 50 })
    let executed = 0
    const reschedule = () => {
      executed += 1
      engine.schedule(engine.clock.now() + 1, reschedule)
    }
    engine.schedule(0, reschedule)
    engine.run()
    expect(executed).toBeLessThanOrEqual(50)
  })

  it('event log carries run metadata with the seed', () => {
    const engine = createSimEngine({ seed: 99, bus: RELIABLE_NETWORK, maxSteps: 10 })
    engine.run()
    expect(engine.getEventLog().meta.seed).toBe(99)
  })
})
