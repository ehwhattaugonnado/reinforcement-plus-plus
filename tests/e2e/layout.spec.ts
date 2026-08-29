import { expect, test, type Page } from '@playwright/test'
import { PAUSE_REASON_TEXT } from '../../src/app/components/pause-copy'

/**
 * Layout regressions the unit suite structurally cannot catch.
 *
 * jsdom has no layout engine, so every assertion in `src/**` passes whether an
 * element is on screen, off screen, or underneath another one. Every UI/UX
 * defect in `docs/roadmap.md` 2.1.1 and 2.1.2 was found by measuring a real
 * browser, and several were found *after* the unit suite went green on the
 * same change. These tests are that measurement, kept.
 *
 * See `docs/testing-strategy.md`, "Layout and presentation defects", for the
 * practice these encode.
 */

/** Widths inside the below-50rem band, not only at its ends. */
const BAND_WIDTHS = [375, 414, 560, 580, 600, 700, 799] as const

/**
 * The reserve was wrong three times before it was right, and twice the miss
 * was in the middle of the band: a value tuned at 375px and 800px was 24px
 * short at 580px, where the bar takes an arrangement neither end shows.
 */
async function barAndReserve(page: Page): Promise<{
  bar: number
  reserve: number
}> {
  return page.evaluate(() => {
    const bar = document.querySelector('.session-controls')
    const shell = document.querySelector('.app-shell')
    if (bar === null || shell === null) throw new Error('shell not rendered')
    return {
      bar: bar.getBoundingClientRect().height,
      reserve: Number.parseFloat(getComputedStyle(shell).paddingBottom),
    }
  })
}

/** Two frames, so a ResizeObserver write has landed before we measure. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }),
  )
}

/** Records every trial as "no selection", which is enough to finish Phase A. */
async function completeAssessment(page: Page): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const next = page.getByRole('button', { name: /show next pair/i })
    if (!(await next.isEnabled())) break
    await next.click()
    await page
      .getByRole('button', { name: /neither \(no selection\)/i })
      .click()
  }
}

test.describe('the fixed control bar below 50rem', () => {
  test('reserves its own height at every width in the band', async ({
    page,
  }) => {
    await page.goto('/')
    for (const width of BAND_WIDTHS) {
      await page.setViewportSize({ width, height: 700 })
      await settle(page)
      const { bar, reserve } = await barAndReserve(page)
      expect(bar, `bar has no height at ${width}px`).toBeGreaterThan(0)
      expect(
        reserve,
        `reserve ${reserve}px does not cover the ${bar}px bar at ${width}px`,
      ).toBeGreaterThanOrEqual(bar)
    }
  })

  test('reserves its height under every message it can show', async ({
    page,
  }) => {
    await page.goto('/')

    // Data-driven off the component's own table: a new pause reason is
    // covered automatically rather than remembered. The bar's tallest
    // arrangement differs by width — "you left this tab" wraps worst at
    // 375px, the coaching message at 799px — so both ends are checked.
    for (const width of [375, 799]) {
      await page.setViewportSize({ width, height: 700 })
      for (const message of Object.values(PAUSE_REASON_TEXT)) {
        await page.evaluate((text) => {
          const status = document.querySelector('.session-status')
          if (status !== null) status.textContent = `${text} 1× speed.`
        }, message)
        await settle(page)
        const { bar, reserve } = await barAndReserve(page)
        expect(
          reserve,
          `reserve ${reserve}px does not cover the ${bar}px bar at ${width}px showing "${message}"`,
        ).toBeGreaterThanOrEqual(bar)
      }
    }
  })

  test('does not cover the end of the sheet, where the next-round button is', async ({
    page,
  }) => {
    for (const width of [375, 580]) {
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')
      await completeAssessment(page)

      const advance = page.getByRole('button', {
        name: /continue to training/i,
      })
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      )
      await settle(page)

      // Geometry alone missed this: the bar intercepted the click while the
      // button's own rect still looked fine. Hit-test the point, then
      // actually click — a real click is what caught it.
      const box = await advance.boundingBox()
      expect(box, `no next-round button at ${width}px`).not.toBeNull()
      const hit = await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y)
          return el?.closest('button')?.textContent ?? null
        },
        [box!.x + box!.width / 2, box!.y + box!.height / 2] as [number, number],
      )
      expect(
        hit,
        `something covers the next-round button at ${width}px`,
      ).toMatch(/continue to training/i)
      await advance.click({ timeout: 5_000 })
    }
  })

  test('never makes the page scroll sideways', async ({ page }) => {
    for (const width of BAND_WIDTHS) {
      await page.setViewportSize({ width, height: 700 })
      await page.goto('/')
      await settle(page)
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      )
      expect(
        overflow,
        `page scrolls sideways at ${width}px`,
      ).toBeLessThanOrEqual(0)
    }
  })

  test('keeps pause on screen through a round, at the width where it used to scroll away', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await page.goto('/')
    await completeAssessment(page)
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    )
    await settle(page)

    // docs/accessibility.md: pause and 0.5x stay available during timed
    // rounds. The panel's bottom edge measured 148px, then 671px, *above*
    // the viewport before this became a fixed bar.
    const onScreen = await page.evaluate(() => {
      const bar = document.querySelector('.session-controls')
      if (bar === null) return false
      const rect = bar.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })
    expect(onScreen).toBe(true)
    await expect(page.getByRole('button', { name: /^pause$/i })).toBeVisible()
  })
})

test.describe('the creature next to the delivery target', () => {
  // The `.creature-state` box already has a documented defect (see the
  // "reserves its height under every message it can show" test above) where
  // a change in its own size shifted the delivery target under the
  // learner's cursor. Pip's SVG sits directly above that box, so the same
  // failure mode is one escaped rotation away: an ear or brow transform
  // that pushes geometry outside the fixed viewBox, or a flourish animating
  // something other than `transform`, would grow the box and shove
  // everything below it down mid-round.
  //
  // Moods and the flourish are driven by simulated events this test would
  // otherwise have to wait out at the mercy of the seeded RNG. Poking the
  // attributes directly exercises every state deterministically, the same
  // way `barAndReserve`'s sibling test above sets `.session-status`'s text
  // directly instead of triggering every real pause reason.
  test('never changes size across moods or mid-flourish', async ({ page }) => {
    await page.goto('/')
    await completeAssessment(page)
    await page.getByRole('button', { name: /continue to training/i }).click()

    const svg = page.locator('.creature-svg')
    const stateBox = page.locator('.creature-state')
    await expect(svg).toBeVisible()

    const baselineSvgBox = await svg.boundingBox()
    const baselineStateY = (await stateBox.boundingBox())?.y
    expect(baselineSvgBox).not.toBeNull()
    expect(baselineStateY).not.toBeUndefined()

    for (const mood of [
      'content',
      'neutral',
      'disinterested',
      'frustrated',
    ] as const) {
      await page.evaluate((m) => {
        document.querySelector('.creature-svg')?.setAttribute('data-mood', m)
      }, mood)
      const box = await svg.boundingBox()
      expect(box, `creature svg box changed size in "${mood}" mood`).toEqual(
        baselineSvgBox,
      )
      const stateY = (await stateBox.boundingBox())?.y
      expect(
        stateY,
        `creature-state moved when Pip's mood became "${mood}"`,
      ).toBe(baselineStateY)
    }

    // Force the flourish's modifier class on, mid-animation, rather than
    // waiting for a real response event.
    await page.evaluate(() => {
      document
        .querySelector('.creature-rig')
        ?.classList.add('creature-rig--response')
    })
    const midFlourishBox = await svg.boundingBox()
    expect(
      midFlourishBox,
      'creature svg box changed size mid-flourish',
    ).toEqual(baselineSvgBox)
    const midFlourishStateY = (await stateBox.boundingBox())?.y
    expect(
      midFlourishStateY,
      'creature-state moved while the flourish animation was playing',
    ).toBe(baselineStateY)
  })
})

test.describe('focus order', () => {
  // One test per width rather than a loop over one page: a Tab press depends
  // on which element the page last focused, so each width needs a document
  // that has just loaded, not one navigated on top of the previous case.
  for (const width of [375, 799, 1440] as const) {
    test(`reaches the task before the controls at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/')

      // The controls used to render before <main>, so Pause was the first
      // focusable element on every screen: one Tab and Space stopped a
      // session the learner had not begun.
      await page.keyboard.press('Tab')
      await expect(
        page.getByRole('button', { name: /show next pair/i }),
      ).toBeFocused()
    })
  }
})
