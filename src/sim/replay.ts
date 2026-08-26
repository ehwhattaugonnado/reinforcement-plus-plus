import {
  CONFIG_VERSION,
  DEFAULT_SIM_CONFIG,
  resolveConfig,
  type SimConfig,
} from './config'
import type { SimEvent } from './events'
import { createInitialState } from './initial-state'
import { applyEvents } from './project'
import type { ReplayResult } from './types'

/**
 * Reconstructs a session from its seed and event log alone (ADR 0001).
 *
 * Configuration resolution follows ADR 0009:
 *
 * - With no explicit config, the current defaults are applied and a log whose
 *   `configVersion` does not match the current one is rejected. An old log is
 *   never silently reinterpreted under new thresholds.
 * - With an explicit config, that config is applied and no version comparison
 *   happens. This is the fixture path: pass the same override to
 *   `createSession` and to `replay` and the results are bit-identical.
 *
 * The reconstructed state is the state as of the **last recorded event**;
 * `elapsedSimMs` equals that event's `at`. Ticks that produced no events are
 * not recorded, so a live snapshot taken mid-interval is ahead of the log by
 * design.
 */
export function replay(
  seed: string,
  events: readonly SimEvent[],
  configOverrides?: Partial<SimConfig>,
): ReplayResult {
  const first = events[0]
  if (first === undefined) return { ok: false, reason: 'empty-log' }
  if (first.type !== 'session-started') {
    return {
      ok: false,
      reason: 'malformed-log',
      detail: `log starts with ${first.type}`,
    }
  }
  if (first.seed !== seed) {
    return {
      ok: false,
      reason: 'malformed-log',
      detail: `log seed ${first.seed} does not match ${seed}`,
    }
  }

  const explicit =
    configOverrides !== undefined && Object.keys(configOverrides).length > 0
  let config: SimConfig
  if (explicit) {
    config = { ...DEFAULT_SIM_CONFIG, ...configOverrides }
  } else {
    if (first.configVersion !== CONFIG_VERSION) {
      return {
        ok: false,
        reason: 'config-version-mismatch',
        detail: `log is ${first.configVersion}, current is ${CONFIG_VERSION}`,
      }
    }
    config = resolveConfig().config
  }

  const initial = createInitialState(seed, first.speed, config)
  return { ok: true, state: applyEvents(initial, events, config) }
}
