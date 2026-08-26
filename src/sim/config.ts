/**
 * Simulation configuration constants.
 *
 * Every threshold in the simulation is a named field of this single object,
 * never a literal scattered through rules or UI. Tests override it explicitly;
 * the production UI never reads or writes it.
 *
 * See docs/architecture/data-model.md section 6.
 */

export type SimConfig = {
  /** Window after a response within which a delivery is classified `prompt`. */
  promptDeliveryWindowMs: number
  /** How long reinforcement stays due before the cycle is abandoned. */
  reinforcementDueWindowMs: number
  /** Duration of the non-instructional baseline round. */
  baselineDurationMs: number

  crfMinOnScheduleDeliveries: number
  crfAcquisitionRelativeIncrease: number
  crfAcquisitionAbsoluteIncrease: number
  crfAcquisitionWindowMs: number
  crfCoachingPauseMs: number

  vrMeanRatio: number
  vrRequirementBlock: readonly number[]
  vrCyclesToComplete: number
  vrCoachingPauseMs: number

  reinforcerEvidenceMinDeliveries: number
  reinforcerEvidenceWindowMs: number
  reinforcerEvidenceRelativeIncrease: number
  reinforcerEvidenceAbsoluteIncrease: number

  burstDetectionWindowMs: number
  burstReferenceWindowMs: number
  burstMinReferenceWindowMs: number
  burstRelativeIncrease: number
  burstAbsoluteIncrease: number

  /** Cap on a single wall-clock tick delta, in wall-clock milliseconds. */
  maxTickDeltaMs: number
}

export const DEFAULT_SIM_CONFIG: SimConfig = {
  promptDeliveryWindowMs: 1500,
  reinforcementDueWindowMs: 10000,
  baselineDurationMs: 45000,

  crfMinOnScheduleDeliveries: 8,
  crfAcquisitionRelativeIncrease: 0.25,
  crfAcquisitionAbsoluteIncrease: 1.5,
  crfAcquisitionWindowMs: 30000,
  crfCoachingPauseMs: 180000,

  vrMeanRatio: 3,
  vrRequirementBlock: [2, 3, 4],
  vrCyclesToComplete: 6,
  vrCoachingPauseMs: 240000,

  reinforcerEvidenceMinDeliveries: 6,
  reinforcerEvidenceWindowMs: 60000,
  reinforcerEvidenceRelativeIncrease: 0.2,
  reinforcerEvidenceAbsoluteIncrease: 1.0,

  burstDetectionWindowMs: 30000,
  burstReferenceWindowMs: 60000,
  burstMinReferenceWindowMs: 20000,
  burstRelativeIncrease: 0.5,
  burstAbsoluteIncrease: 2.0,

  maxTickDeltaMs: 250,
}

/**
 * Identifies the constants a log was produced under, so an old log is never
 * silently reinterpreted under new thresholds. Bump this whenever any default
 * value, or the meaning of any field, changes.
 *
 * See ADR 0009.
 */
export const CONFIG_VERSION = 'v1.0.0'

/** Marks a log produced under a test override so it can never replay as default. */
export const OVERRIDE_CONFIG_VERSION = `${CONFIG_VERSION}+override`

export function resolveConfig(overrides?: Partial<SimConfig>): {
  config: SimConfig
  configVersion: string
} {
  if (overrides === undefined || Object.keys(overrides).length === 0) {
    return { config: DEFAULT_SIM_CONFIG, configVersion: CONFIG_VERSION }
  }
  return {
    config: { ...DEFAULT_SIM_CONFIG, ...overrides },
    configVersion: OVERRIDE_CONFIG_VERSION,
  }
}
