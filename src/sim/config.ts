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
  /**
   * Exponent on current stimulus value in the paired-stimulus choice rule.
   * Higher values sharpen discrimination between the two offered stimuli.
   */
  assessmentChoiceSensitivity: number
  /**
   * Peak probability that the creature approaches neither stimulus, reached
   * when both items in the pair have no value left. Scales with
   * `1 - highest current value in the pair`.
   */
  assessmentNoSelectionScale: number
  /** Proportional value lost from one period of post-selection access. */
  assessmentSatiationPerAccess: number
  /**
   * Floor on a satiated stimulus, as a fraction of its `basePreference`. This
   * is what bounds satiation so trial order cannot dominate the hierarchy.
   */
  assessmentSatiationFloorFraction: number

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
  /**
   * Lower/upper bounds on the accepted running average of
   * responses-per-delivery for a VR delivery to be credited `on-schedule`
   * (ADR 0010). Not a per-cycle exact target: there is no hidden number a
   * live delivery must hit, only whether accepting this gap would keep the
   * round's average in range.
   */
  vrAcceptableRatioMin: number
  vrAcceptableRatioMax: number
  /**
   * Each of `vrAverageSeedCount` phantom prior entries counts as this value
   * toward the VR running average, so the first few real deliveries are
   * judged against a reasonable prior instead of wild swings from a
   * near-empty sample (ADR 0010).
   */
  vrAverageSeedValue: number
  vrAverageSeedCount: number
  /**
   * Consecutive identical *real* accepted gaps (the phantom seed is
   * excluded and can never itself trigger this) that classify the next
   * matching delivery `not-variable` instead of `on-schedule`: a schedule
   * that averages correctly but never varies is a fixed ratio in disguise,
   * not VR (ADR 0010).
   */
  vrPatternRepeatThreshold: number
  vrCyclesToComplete: number
  vrCoachingPauseMs: number
  /** Duration of the optional, observational extinction round. */
  extinctionDurationMs: number

  reinforcerEvidenceMinDeliveries: number
  reinforcerEvidenceWindowMs: number
  reinforcerEvidenceRelativeIncrease: number
  reinforcerEvidenceAbsoluteIncrease: number

  burstDetectionWindowMs: number
  burstReferenceWindowMs: number
  burstMinReferenceWindowMs: number
  burstRelativeIncrease: number
  burstAbsoluteIncrease: number
  /**
   * Minimum response count required in the reference window before a
   * burst/no-burst verdict is trusted; below it, the result is
   * `indeterminate` with reason `'insufficient-samples'`. Deliberately
   * separate from `burstMinDetectionResponses`: the reference window is up
   * to `burstReferenceWindowMs` (60s) long and, at this model's typical
   * elevated end-of-round rates, usually clears a low floor easily, so this
   * floor mainly guards the genuinely-thin cases (a short preceding round,
   * or a low-rate creature) rather than being the primary noise filter --
   * that job belongs to `burstMinDetectionResponses`. A 150-seed cohort
   * sweep found the reference side was the dominant, unnecessary rejector
   * of real primed transients at a single shared floor (see
   * `extinction-transition.test.ts`), which is why the floor is split.
   */
  burstMinReferenceResponses: number
  /**
   * Minimum response count required in the (fixed-duration,
   * `burstDetectionWindowMs`) detection window before a burst/no-burst
   * verdict is trusted; below it, `indeterminate`/`'insufficient-samples'`.
   * This is the primary noise filter: a single extra (or missing)
   * Poisson-arrival response can otherwise swing a low-count window's rate
   * past the burst thresholds on sampling noise alone, which is not
   * evidence of a real transient increase.
   *
   * This floor alone (at a 30s `burstDetectionWindowMs`) was not enough: a
   * 150-seed cohort measured only a ~58% primed detection rate against a
   * ~4% unprimed false-burst rate, and ~65-70% of *all* runs landed
   * `indeterminate` because the model's default 2-4/min rates rarely
   * produce 6 responses in 30s. Widening `burstDetectionWindowMs` to 90s
   * and moving `extinctionBurstPeakDelayMs` to sit mid-window (so the
   * transient isn't already decayed by the time most of the window's
   * samples land) fixed that: at the current defaults, the same cohort
   * measures roughly primed burst 61%/indeterminate 10%/no-burst 29% vs.
   * unprimed burst 10%/indeterminate 51%/no-burst 39%. The unprimed
   * false-burst rate rose slightly (4% to 10%, a longer window has more
   * opportunity for a noise cluster) but stayed far below the pre-fix
   * baseline (~28-30%), and the honest no-burst verdict is now reachable
   * live for both groups instead of being nearly as rare as false
   * positives were. See `extinction-transition.test.ts`.
   *
   * IMPORTANT constraint for whoever builds the extinction round's UI/timing
   * (Milestone 7/8): this measured distribution assumes the extinction round
   * provides comfortably more than `burstDetectionWindowMs` (90s) of
   * simulated time after the first withheld criterion -- a 150-seed sweep
   * found the distribution stable from ~150s down to ~92s, degrading
   * gradually (not a cliff) as available time shrinks further: at 60s past
   * the anchor, unprimed `indeterminate` rises to ~73% (vs. ~51% at 150s)
   * and the healthy burst/no-burst split narrows accordingly. No production
   * round-duration constant exists yet; whatever one is chosen should give
   * the detection window room to complete, not merely exceed it.
   */
  burstMinDetectionResponses: number

  /**
   * Probability, drawn once per session from the seed, that this creature's
   * extinction-transition state includes a genuine transient response-rate
   * increase after reinforcement stops. A simulation-tuning knob for this
   * fictional creature, not a claimed clinical prevalence (data-model
   * section 4).
   */
  extinctionBurstProbability: number
  /**
   * Peak responses/minute a fully-learned, fully-valued, maximally-scaled
   * transient adds on top of the ordinary rate at `extinctionBurstPeakDelayMs`
   * after the last experienced consequence. Scales with the same
   * `learnedStrength * stimulusValue` factors as the ordinary post-delivery
   * rate term, so a creature with a weaker reinforcement history has a
   * smaller possible burst.
   *
   * At the current default (20) with a 90s `burstDetectionWindowMs` and
   * `extinctionBurstPeakDelayMs` at 35s, a 150-seed cohort measured
   * `responseRateCeilingPerMinute` (20) clamping the rate at some point
   * during extinction for roughly 6% of primed creatures -- i.e. the
   * burst's true peak is flattened by the ceiling only occasionally, not
   * routinely. Higher gains detect more primed seeds (e.g. 40 reaches ~76%
   * primed detection) but clamp far more often (~48% at gain 40) as the
   * burst pegs the same ceiling calibrated for ordinary CRF/VR responding;
   * this default trades some detection sensitivity for a burst shape that
   * usually looks like a real rise-and-fall in the Advanced live chart
   * rather than a flat line at the cap. See `extinction-transition.test.ts`.
   */
  extinctionBurstMagnitudeGainPerMinute: number
  /**
   * Simulated ms since the last experienced consequence at which a primed
   * creature's transient rate increase peaks. Zero at cessation, rising to
   * the peak here, then decaying — never a step function.
   *
   * Set to roughly the midpoint of `burstDetectionWindowMs` (90s) rather
   * than near its start: peaking too early means most of the detection
   * window instead samples the post-peak decay tail, diluting the average
   * rate the detector compares against the reference and substantially
   * lowering primed detection (a 150-seed cohort measured primed burst
   * detection rising from ~53% to ~61-77% as this moved from 15s to
   * 25-45s into a 90s window, at no cost to the unprimed false-burst rate,
   * which depends only on `burstMinDetectionResponses` and is unaffected
   * by this constant).
   */
  extinctionBurstPeakDelayMs: number

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
  assessmentChoiceSensitivity: 4,
  assessmentNoSelectionScale: 0.15,
  assessmentSatiationPerAccess: 0.05,
  assessmentSatiationFloorFraction: 0.85,

  promptDeliveryWindowMs: 1500,
  reinforcementDueWindowMs: 10000,
  baselineDurationMs: 45000,

  crfMinOnScheduleDeliveries: 8,
  crfAcquisitionRelativeIncrease: 0.25,
  crfAcquisitionAbsoluteIncrease: 1.5,
  crfAcquisitionWindowMs: 30000,
  crfCoachingPauseMs: 180000,

  vrMeanRatio: 3,
  vrAcceptableRatioMin: 2,
  vrAcceptableRatioMax: 4,
  vrAverageSeedValue: 3,
  vrAverageSeedCount: 3,
  vrPatternRepeatThreshold: 3,
  vrCyclesToComplete: 6,
  vrCoachingPauseMs: 240000,
  extinctionDurationMs: 150000,

  reinforcerEvidenceMinDeliveries: 6,
  reinforcerEvidenceWindowMs: 60000,
  reinforcerEvidenceRelativeIncrease: 0.2,
  reinforcerEvidenceAbsoluteIncrease: 1.0,

  burstDetectionWindowMs: 90000,
  burstReferenceWindowMs: 60000,
  burstMinReferenceWindowMs: 20000,
  burstRelativeIncrease: 0.5,
  burstAbsoluteIncrease: 2.0,
  burstMinReferenceResponses: 3,
  burstMinDetectionResponses: 6,

  extinctionBurstProbability: 0.5,
  extinctionBurstMagnitudeGainPerMinute: 20,
  extinctionBurstPeakDelayMs: 35000,

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
export const CONFIG_VERSION = 'v1.5.0'

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
