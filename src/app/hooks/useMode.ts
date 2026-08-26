import { useState } from 'react'

/**
 * Simple/Advanced is presentation-only (ADR 0004): both modes share one
 * simulation and one event history, so this lives in the UI and is deliberately
 * never passed to the simulation core. Switching modes must not reset or alter
 * anything the sim is doing.
 */
export type Mode = 'simple' | 'advanced'

export function useMode(initial: Mode = 'simple') {
  return useState<Mode>(initial)
}
