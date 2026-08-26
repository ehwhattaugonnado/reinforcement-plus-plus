/** Small shared formatting helpers for the chart-view layer only. */

/** Formats simulated milliseconds as `M:SS` for axis ticks and table cells. */
export function formatSimTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
