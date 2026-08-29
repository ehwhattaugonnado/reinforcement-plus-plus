import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Automated accessibility checks in a real browser, across the states and
 * schemes a single pass would miss.
 *
 * The unit-level axe helper disables `color-contrast`, because jsdom cannot
 * compute it. That makes this the only place contrast is checked at all — and
 * contrast is scheme-specific: dark mode has its own palette, so a regression
 * there is invisible to a light-mode-only run. The paused state matters for
 * the same reason: it introduces the highlighter wash, an `aria-disabled`
 * delivery target, and a desaturating filter over the ledger, none of which
 * exist while the session is running.
 *
 * A 4.48:1 label on the pressed Resume button was found exactly this way.
 */

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const report = results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact ?? 'unknown'}): ${v.help}\n` +
        v.nodes
          .map((n) => `    ${n.target.join(' ')} — ${n.failureSummary ?? ''}`)
          .join('\n'),
    )
    .join('\n\n')
  expect(results.violations, `${label}\n\n${report}`).toEqual([])
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme })

    for (const width of [1440, 375] as const) {
      test(`has no automatically detectable violations, running or paused, at ${width}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/')
        await expectNoViolations(page, `${colorScheme}, ${width}px, running`)

        await page.getByRole('button', { name: /^pause$/i }).click()
        await expect(
          page.getByRole('button', { name: /^resume$/i }),
        ).toBeVisible()
        await expectNoViolations(page, `${colorScheme}, ${width}px, paused`)
      })
    }
  })
}
