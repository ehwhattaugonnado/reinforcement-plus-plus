/** Small shared formatting and geometry helpers for the chart-view layer only. */

/**
 * Both charts share one viewBox width and one horizontal margin so that, at
 * equal container widths, they scale by the same factor: their plot areas
 * line up with each other and their tick text renders at the same on-screen
 * size. Heights may differ; widths and horizontal margins may not.
 */
export const CHART_VIEWBOX_WIDTH = 480

/**
 * Wide enough that no axis label lands outside the viewBox. visx places the
 * left axis label at `-(tickLength + labelOffset)` and the bottom label at
 * `tickLength + labelOffset + tickLabelFontSize + labelFontSize` past the
 * axis line; both must fit inside these margins or the `overflow: hidden`
 * viewBox clips them away entirely.
 */
export const CHART_MARGIN = { top: 20, right: 20, bottom: 48, left: 64 }

/** visx defaults (36 / 8) measured against the margins above. */
export const AXIS_LEFT_LABEL_OFFSET = 36
export const AXIS_BOTTOM_LABEL_OFFSET = 8

/** Formats simulated milliseconds as `M:SS` for axis ticks and table cells. */
export function formatSimTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Tick values from 0 to `max` in whole multiples of `unit`, at most five of
 * them. Used where d3's default tick choice would produce fractions of a
 * discrete thing — a fifth of a response, or a 2.5-second time tick that
 * `formatSimTime` would round to a misleading label.
 *
 * `stepLadder` optionally restricts the step to a preferred set of multiples
 * of `unit` (e.g. 10s/30s/1m/5m for a time axis) so a long session gets round
 * tick labels rather than an arbitrary exact division.
 */
export function wholeStepTicks(
  max: number,
  unit: number,
  stepLadder?: readonly number[],
): number[] {
  const units = Math.max(1, Math.ceil(max / unit))
  const fits = (step: number) => Math.ceil(units / step) <= 4
  const stepUnits = stepLadder?.find(fits) ?? Math.max(1, Math.ceil(units / 4))
  const values: number[] = []
  for (let i = 0; i * stepUnits <= units; i++) {
    values.push(i * stepUnits * unit)
  }
  return values
}
