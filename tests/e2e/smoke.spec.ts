import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Milestone 0 smoke coverage: the shell loads, states its educational
 * boundary, and its always-available timing controls work in a real browser.
 *
 * The full required path (onboarding -> assessment -> baseline -> CRF -> VR ->
 * debrief), mode switching, background pausing, reduced motion, and the
 * accessible chart alternatives are added in Milestone 8.
 */
test('the shell loads and states its educational boundary', async ({
  page,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Reinforcement++' }),
  ).toBeVisible()
  await expect(page.getByText(/not clinical guidance/i)).toBeVisible()
})

test('pause and speed are operable and announced textually', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: /pause/i }).click()
  await expect(page.getByRole('status')).toContainText(/paused/i)

  await page.getByRole('radio', { name: '0.5×' }).check()
  await expect(page.getByRole('status')).toContainText('0.5')
})

test('the shell is keyboard operable', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /pause/i })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status')).toContainText(/paused/i)
})

test('has no automatically detectable accessibility violations', async ({
  page,
}) => {
  await page.goto('/')
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
