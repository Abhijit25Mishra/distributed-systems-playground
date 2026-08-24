/**
 * AGENT-OWNED — playback clock for the request timeline.
 *
 * Hooks only, no components: a module that exports both breaks react-refresh's
 * ability to hot-reload either one.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Speed } from './timeline'

/**
 * Longest frame delta we will believe, in seconds.
 *
 * requestAnimationFrame stops while the tab is hidden, so the first frame back
 * reports however long the visitor was away. Integrating that verbatim would
 * teleport the cursor to the end of the run and, worse, make it look as though
 * the animation had played while nobody was watching.
 */
const MAX_FRAME_SECONDS = 0.1

export interface Timeline {
  readonly cursor: number
  readonly playing: boolean
  readonly speed: Speed
  readonly play: () => void
  readonly pause: () => void
  readonly toggle: () => void
  readonly seek: (cursor: number) => void
  readonly stepBy: (steps: number) => void
  readonly restart: () => void
  readonly setSpeed: (speed: Speed) => void
}

export function useTimeline(
  requestCount: number,
  secondsPerRequest: number,
  autoPlay: boolean,
): Timeline {
  const [cursor, setCursor] = useState(0)
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState<Speed>(1)

  const frameRef = useRef<number | undefined>(undefined)
  const lastRef = useRef<number | undefined>(undefined)
  const speedRef = useRef<Speed>(speed)
  speedRef.current = speed

  // Read through a ref inside the frame loop. The pace changes with the key
  // count, and putting it in the effect's dependencies would tear down and
  // rebuild the rAF loop on every drag of the key slider.
  const paceRef = useRef(secondsPerRequest)
  paceRef.current = secondsPerRequest

  // Restarting from the end is what a visitor means by "play" at that point;
  // otherwise the button appears dead.
  const play = useCallback(() => {
    setCursor((current) => (current >= requestCount ? 0 : current))
    setPlaying(true)
  }, [requestCount])

  const pause = useCallback(() => setPlaying(false), [])
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play])

  const seek = useCallback(
    (next: number) => {
      setCursor(Math.min(Math.max(next, 0), requestCount))
    },
    [requestCount],
  )

  /**
   * Stepping snaps to whole requests. Mid-flight, a step back means "restart
   * this one" rather than "go to the previous one" — the same convention as a
   * track skip, and it makes a half-watched request re-watchable without
   * overshooting.
   */
  const stepBy = useCallback(
    (steps: number) => {
      setPlaying(false)
      setCursor((current) => {
        const base = steps < 0 ? Math.ceil(current) : Math.floor(current)
        return Math.min(Math.max(base + steps, 0), requestCount)
      })
    },
    [requestCount],
  )

  const restart = useCallback(() => {
    setCursor(0)
    setPlaying(true)
  }, [])

  useEffect(() => {
    if (!playing) {
      lastRef.current = undefined
      return
    }

    const tick = (now: number) => {
      const previous = lastRef.current
      lastRef.current = now

      if (previous !== undefined) {
        const elapsed = Math.min((now - previous) / 1000, MAX_FRAME_SECONDS)
        const advance = (elapsed * speedRef.current) / paceRef.current

        setCursor((current) => {
          const next = current + advance
          if (next >= requestCount) {
            setPlaying(false)
            return requestCount
          }
          return next
        })
      }

      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current)
      }
      lastRef.current = undefined
    }
  }, [playing, requestCount])

  // A changed run (new seed, different node count) invalidates the position.
  useEffect(() => {
    setCursor(0)
  }, [requestCount])

  return { cursor, playing, speed, play, pause, toggle, seek, stepBy, restart, setSpeed }
}

/**
 * Whether the visitor has asked the system for less animation.
 *
 * Respected by not autoplaying. The controls stay fully functional, so the
 * content is never withheld — the visitor drives it instead of being driven,
 * which is the actual request behind the setting.
 */
/**
 * Hold a value still for `ms` between updates.
 *
 * The narration panel needs this and the canvas does not. At two thousand keys
 * a flight lasts 25ms, so the panel's five rows would rewrite forty times a
 * second: unreadable as text and unpleasant to look at. The canvas is fine at
 * that rate because a moving dot is what it is meant to look like.
 *
 * `ms <= 0` returns the value untouched rather than routing it through state,
 * so the common case adds no extra render.
 */
export function useThrottled<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value)
  const lastRef = useRef(0)

  useEffect(() => {
    if (ms <= 0) {
      return
    }

    const elapsed = performance.now() - lastRef.current

    if (elapsed >= ms) {
      lastRef.current = performance.now()
      setHeld(value)
      return
    }

    const timer = setTimeout(() => {
      lastRef.current = performance.now()
      setHeld(value)
    }, ms - elapsed)

    return () => clearTimeout(timer)
  }, [value, ms])

  return ms <= 0 ? value : held
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion(): boolean {
  // Read synchronously in the initialiser, not in an effect.
  //
  // This looked fine as an effect and was not. `useTimeline` seeds its
  // `playing` state from `autoPlay`, and a useState initialiser runs once: by
  // the time an effect had flipped this to true, playback had already been
  // seeded true and the later value was ignored. Every visitor who had asked
  // the OS for less motion got an autoplaying animation anyway, and nothing
  // errored to say so.
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches,
  )

  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    setReduced(query.matches)

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
