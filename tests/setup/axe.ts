import axe from 'axe-core'

/**
 * Runs automated accessibility checks against a rendered container.
 *
 * Automated checks are a floor, not a ceiling: they do not replace the manual
 * keyboard, screen-reader, touch, reduced-motion, and contrast reviews the
 * accessibility doc requires. Failures print the rule and the offending markup
 * so a violation is actionable from the test output alone.
 */
export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe.run(container, {
    // Colour contrast cannot be computed in jsdom; it is covered by the
    // end-to-end suite and by manual review.
    rules: { 'color-contrast': { enabled: false } },
  })

  if (results.violations.length > 0) {
    const report = results.violations
      .map(
        (v) =>
          `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n` +
          v.nodes.map((n) => `    ${n.html}`).join('\n'),
      )
      .join('\n\n')
    throw new Error(`Accessibility violations found:\n\n${report}`)
  }
}
