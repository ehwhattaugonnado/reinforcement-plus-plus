import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { MoodState } from '../../sim'
import { Creature } from './Creature'

const MOODS: MoodState[] = ['content', 'neutral', 'disinterested', 'frustrated']

describe('Creature', () => {
  it('is decorative: the svg is hidden from assistive tech', () => {
    const { container } = render(
      <Creature moodState="neutral" trigger={null} />,
    )
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('reflects the mood prop on the svg', () => {
    for (const mood of MOODS) {
      const { container } = render(<Creature moodState={mood} trigger={null} />)
      expect(container.querySelector('svg')).toHaveAttribute('data-mood', mood)
    }
  })

  it('draws a different mouth curve per mood', () => {
    const paths = MOODS.map((mood) => {
      const { container } = render(<Creature moodState={mood} trigger={null} />)
      return container.querySelector('.mouth')?.getAttribute('d')
    })
    expect(new Set(paths).size).toBe(MOODS.length)
  })

  it('renders no trigger modifier class when idle', () => {
    const { container } = render(
      <Creature moodState="neutral" trigger={null} />,
    )
    const rig = container.querySelector('.creature-rig')
    expect(rig).not.toBeNull()
    expect(rig?.getAttribute('class')).not.toMatch(/creature-rig--/)
  })

  it('adds the matching modifier class for a response trigger', () => {
    const { container } = render(
      <Creature
        moodState="neutral"
        trigger={{ kind: 'response', key: 'response-1' }}
      />,
    )
    expect(container.querySelector('.creature-rig--response')).not.toBeNull()
  })

  it('adds the matching modifier class for a delivery trigger', () => {
    const { container } = render(
      <Creature
        moodState="neutral"
        trigger={{ kind: 'delivery', key: 'delivery-1' }}
      />,
    )
    expect(container.querySelector('.creature-rig--delivery')).not.toBeNull()
  })

  it('remounts the rig group when the trigger key changes, so its CSS animation restarts', () => {
    // The rig is keyed on `trigger.key`; React treats a changed key as a new
    // element rather than an update, which is what lets a fresh CSS
    // animation play on a second response even if the first one's flourish
    // hasn't finished. jsdom does not run real CSS animations, so this
    // checks the DOM node identity that the restart depends on instead.
    const { container, rerender } = render(
      <Creature moodState="neutral" trigger={{ kind: 'response', key: 'a' }} />,
    )
    const firstRig = container.querySelector('.creature-rig')

    rerender(
      <Creature moodState="neutral" trigger={{ kind: 'response', key: 'b' }} />,
    )
    const secondRig = container.querySelector('.creature-rig')

    expect(firstRig).not.toBe(secondRig)
  })
})
