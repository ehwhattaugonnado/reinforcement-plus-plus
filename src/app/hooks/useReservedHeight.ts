import { useEffect, useRef, useState } from 'react'

/**
 * Keeps a CSS custom property on `container` equal to the measured height of
 * `measured`, so layout can reserve space for an element that is out of flow.
 *
 * The fixed control bar below 50rem covers the bottom of the sheet, and the
 * bottom of a round is exactly where the next-round button lives. A static
 * reserve was wrong three times running — once per breakpoint, then again
 * once a longer pause message ("Paused because you left this tab.") wrapped
 * the bar onto a third row and took it to 181px against a 136px reserve.
 * The bar's height depends on the viewport *and* on copy the simulation
 * chooses at runtime, so it has to be measured rather than predicted.
 *
 * Presentation-only: this reads layout and writes one custom property. The
 * stylesheet's static value stays the fallback, used before the first
 * measurement and anywhere `ResizeObserver` is unavailable.
 */
export function useReservedHeight(property: string): {
  containerRef: (node: HTMLElement | null) => void
  measuredRef: (node: HTMLElement | null) => void
} {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [measured, setMeasured] = useState<HTMLElement | null>(null)
  const applied = useRef<number | null>(null)

  useEffect(() => {
    if (container === null || measured === null) return
    if (typeof ResizeObserver === 'undefined') return

    const apply = () => {
      const height = Math.ceil(measured.getBoundingClientRect().height)
      if (height === applied.current) return
      applied.current = height
      container.style.setProperty(property, `${height}px`)
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(measured)
    return () => {
      observer.disconnect()
      applied.current = null
      container.style.removeProperty(property)
    }
  }, [container, measured, property])

  // `useState` setters are referentially stable, so these are safe as ref
  // callbacks: React will not detach and re-attach them on every render.
  return { containerRef: setContainer, measuredRef: setMeasured }
}
