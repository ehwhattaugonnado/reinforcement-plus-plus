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

  // --- Milestone 3: baseline and experienced-consequence learning model ---

  /**
   * Time constant (simulated ms) over which the influence of learned
   * strength on response rate decays as time passes since the last
   * experienced consequence. Larger = slower decay.
   */
  responseRateConsequenceDecayMs: number
  /**
   * Maximum responses/minute that fully-learned strength, undecayed and at
   * full stimulus value, adds on top of the baseline rate.
   */
  learningRateGainPerMinute: number
  /** Learned-strength gain from a response-contingent, prompt delivery. */
  learnedStrengthGainPromptContingent: number
  /** Learned-strength gain from a response-contingent, delayed delivery. */
  learnedStrengthGainDelayedContingent: number
  /** Learned-strength gain from any noncontingent delivery. */
  learnedStrengthGainNoncontingent: number
  /** Floor on the modeled response rate, responses/minute. */
  responseRateFloorPerMinute: number
  /** Ceiling on the modeled response rate, responses/minute. */
  responseRateCeilingPerMinute: number

  /** Fraction a stimulus's current value drops on each delivery. */
  satiationDecayFraction: number
  /**
   * Time constant (simulated ms) for a satiated stimulus value's asymptotic
   * recovery toward its recovery ceiling.
   */
  satiationRecoveryTimeConstantMs: number
  /**
   * Recovery is bounded: a stimulus value never recovers above
   * `basePreference * satiationRecoveryCeilingFraction`, strictly less than
   * full restoration. V1 has no persistence, so this bound only applies
   * within one open session.
   */
  satiationRecoveryCeilingFraction: number
  /** Floor a stimulus's current value never decays below. */
  stimulusValueFloor: number
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

  responseRateConsequenceDecayMs: 20000,
  learningRateGainPerMinute: 6,
  learnedStrengthGainPromptContingent: 0.18,
  learnedStrengthGainDelayedContingent: 0.06,
  learnedStrengthGainNoncontingent: 0.02,
  responseRateFloorPerMinute: 0.5,
  responseRateCeilingPerMinute: 20,

  satiationDecayFraction: 0.12,
  satiationRecoveryTimeConstantMs: 15000,
  satiationRecoveryCeilingFraction: 0.92,
  stimulusValueFloor: 0.05,
}

/**
 * Identifies the constants a log was produced under, so an old log is never
 * silently reinterpreted under new thresholds. Bump this whenever any default
 * value, or the meaning of any field, changes.
 *
 * See ADR 0009.
 */
export const CONFIG_VERSION = 'v1.1.0'

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
