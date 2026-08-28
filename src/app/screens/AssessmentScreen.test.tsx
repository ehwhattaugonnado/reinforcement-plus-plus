import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { expectNoAxeViolations } from '../../../tests/setup/axe'
import { AppShell } from '../AppShell'

/**
 * Tabs forward from wherever focus currently is until it lands on a button
 * whose accessible name matches `name`, then activates it with Enter. Throws
 * if it never finds one within a generous number of tab stops, so a broken
 * tab order fails loudly instead of hanging.
 */
async function tabToButton(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp,
): Promise<void> {
  for (let i = 0; i < 40; i++) {
    await user.tab()
    const active = document.activeElement
    if (
      active instanceof HTMLElement &&
      active.tagName === 'BUTTON' &&
      name.test(active.textContent ?? '')
    ) {
      await user.keyboard('{Enter}')
      return
    }
  }
  throw new Error(`never tabbed onto a button matching ${String(name)}`)
}

describe('AssessmentScreen', () => {
  it('presents the first pair with a trial counter and a show-pair control', () => {
    render(<AppShell seed="assessment-screen-test" />)
    const section = screen.getByRole('region', {
      name: /preference assessment/i,
    })
    expect(within(section).getByText(/trial 1 of 6/i)).toBeInTheDocument()
    expect(
      within(section).getByRole('button', { name: /show next pair/i }),
    ).toBeInTheDocument()
  })

  it('requires recording before the next pair can be shown', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="assessment-screen-test" />)
    const section = screen.getByRole('region', {
      name: /preference assessment/i,
    })

    await user.click(
      within(section).getByRole('button', { name: /show next pair/i }),
    )
    expect(
      within(section).getByText(/record this trial before the next pair/i),
    ).toBeInTheDocument()

    // Show next pair is a guarded no-op while a trial is pending: clicking it
    // again does not advance past trial 1.
    await user.click(
      within(section).getByRole('button', { name: /show next pair/i }),
    )
    expect(within(section).getByText(/trial 1 of 6/i)).toBeInTheDocument()
  })

  it('separates the creature selection from the learner record, including a no-selection record', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="assessment-screen-test" />)
    const section = screen.getByRole('region', {
      name: /preference assessment/i,
    })

    await user.click(
      within(section).getByRole('button', { name: /show next pair/i }),
    )
    // The creature's choice is already visible as text before anything is
    // recorded -- this is an observation task, not a guessing game.
    expect(
      within(section).getByText(/approached:|made no selection/i),
    ).toBeInTheDocument()

    await user.click(
      within(section).getByRole('button', {
        name: /neither \(no selection\)/i,
      }),
    )
    expect(within(section).getByText(/trial 2 of 6/i)).toBeInTheDocument()
  })

  it('pairs a decorative approach scene with the authoritative text outcome', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="assessment-visual-test" />)
    await user.click(screen.getByRole('button', { name: /show next pair/i }))

    expect(
      screen.getByText(/approached:|made no selection/i),
    ).toBeInTheDocument()
    const scene = document.querySelector('.approach-scene')
    expect(scene).toHaveAttribute('aria-hidden', 'true')
    expect(scene).toHaveTextContent(/Pip/)
  })

  it('completes the whole six-trial assessment keyboard-only and shows an accessible hierarchy table', async () => {
    const user = userEvent.setup()
    render(<AppShell seed="assessment-keyboard-test" />)

    for (let trial = 0; trial < 6; trial++) {
      await tabToButton(user, /show next pair/i)
      // The record fieldset stays mounted for the whole phase (never
      // unmounts mid-trial), so the very next tab stop after "Show next
      // pair" is always the left-stimulus record button, regardless of
      // which stimulus that trial happens to pair. Exercising the real
      // stimulus button (not "Neither") is what proves the left/right
      // record path -- not just the no-selection path -- is keyboard
      // reachable and actually feeds the projector.
      await user.tab()
      await user.keyboard('{Enter}')
    }

    const section = screen.getByRole('region', {
      name: /preference assessment/i,
    })
    expect(
      within(section).getByText(/assessment complete: all 6 pairs presented/i),
    ).toBeInTheDocument()

    const table = within(section).getByRole('table')
    expect(
      within(table).getByRole('columnheader', { name: /rank/i }),
    ).toBeInTheDocument()
    // Header row plus one row per of the four stimuli.
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(5)
    // Recording every trial's left stimulus is not a no-op: some stimulus
    // must have been selected at least once, so the hierarchy is not the
    // degenerate all-zero, all-tied-at-rank-1 table a broken record handler
    // would also produce.
    const bodyRowText = rows.slice(1).map((row) => row.textContent ?? '')
    expect(bodyRowText.some((text) => !/\b0\b.*\b0%/.test(text))).toBe(true)

    expect(
      within(section).getAllByText(/preferred stimuli/i).length,
    ).toBeGreaterThan(0)
    expect(
      within(section).getByRole('button', { name: /continue to training/i }),
    ).toBeInTheDocument()
  })

  it('has no automatically detectable accessibility violations mid-assessment', async () => {
    const user = userEvent.setup()
    const { container } = render(<AppShell seed="assessment-axe-test" />)
    const section = screen.getByRole('region', {
      name: /preference assessment/i,
    })
    await user.click(
      within(section).getByRole('button', { name: /show next pair/i }),
    )
    await expectNoAxeViolations(container)
  })
})
