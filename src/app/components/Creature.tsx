import type { MoodState } from '../../sim'

export type CreatureTriggerKind = 'response' | 'delivery'

export type CreatureTrigger = {
  readonly kind: CreatureTriggerKind
  readonly key: string
}

const MOUTH_CURVE: Record<MoodState, number> = {
  content: 8,
  neutral: 2,
  disinterested: -1,
  frustrated: -5,
}

function mouthPath(mood: MoodState): string {
  const curve = MOUTH_CURVE[mood]
  return `M92,133 Q100,${133 + curve} 108,133`
}

/**
 * Pip's rendered form (locked design, GitHub issue #15: "Vantle · G4").
 * Decorative only — `.creature-state` already carries the name/mood/recency
 * facts as text, so this SVG is `aria-hidden`.
 *
 * The `<svg>` is a fixed 88x88 box with a fixed viewBox: nothing here may
 * change layout size, in any mood or mid-flourish, because this renders next
 * to the delivery target and a box that changes size has already moved that
 * target under the learner's cursor once (see the comment at
 * TrainingScreen.tsx around the "just responded" recency flag). Every
 * mood-pose and flourish rule below is a `transform`, never a box property.
 */
export function Creature({
  moodState,
  trigger,
  className,
}: {
  moodState: MoodState
  trigger: CreatureTrigger | null
  className?: string
}) {
  const rigClassName = [
    'creature-rig',
    trigger !== null ? `creature-rig--${trigger.kind}` : null,
    className,
  ]
    .filter((c): c is string => c !== null && c !== undefined)
    .join(' ')

  return (
    <svg
      className="creature-svg"
      width={88}
      height={88}
      viewBox="0 0 200 200"
      data-mood={moodState}
      aria-hidden="true"
    >
      {/* Changing `key` remounts this group, which is what restarts the CSS
          flourish keyframe below — the only "animation state" this component
          has is the `trigger` prop itself, never a timer or an
          `animationend` handler. */}
      <g key={trigger?.key ?? 'idle'} className={rigClassName}>
        <g
          className="stroke"
          fill="none"
          stroke="var(--ink)"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* The body ellipse's bottom edge sits at y=168 (cy 128 + ry 40);
              a leg starting at y=164 was mostly hidden under it, leaving
              only a couple of visible px at the 88px render size the shell
              actually uses — legible in the much larger design mockup, not
              here. Extended to y=180 so the stub reads as a leg. */}
          <line
            className="leg"
            x1={86}
            y1={164}
            x2={86}
            y2={180}
            strokeWidth={8}
          />
          <line
            className="leg-foot"
            x1={80}
            y1={181}
            x2={92}
            y2={181}
            strokeWidth={5}
          />
          <line
            className="leg"
            x1={114}
            y1={164}
            x2={114}
            y2={180}
            strokeWidth={8}
          />
          <line
            className="leg-foot"
            x1={108}
            y1={181}
            x2={120}
            y2={181}
            strokeWidth={5}
          />
          <ellipse className="body" cx={100} cy={128} rx={44} ry={40} />
          <g className="fuzz" strokeWidth={3}>
            <line x1={78} y1={90} x2={73} y2={81} />
            <line x1={122} y1={90} x2={127} y2={81} />
          </g>
          <g className="ear ear-l" style={{ transformOrigin: '90px 92px' }}>
            <path d="M90,92 Q85,82 86,77" strokeWidth={5} />
            <circle cx={86} cy={75} r={4} />
          </g>
          <g className="ear ear-r" style={{ transformOrigin: '110px 92px' }}>
            <path d="M110,92 Q115,82 114,77" strokeWidth={5} />
            <circle cx={114} cy={75} r={4} />
          </g>
          <g className="brow brow-l" style={{ transformOrigin: '82px 102px' }}>
            <line x1={78} y1={104} x2={90} y2={101} />
          </g>
          <g className="brow brow-r" style={{ transformOrigin: '118px 102px' }}>
            <line x1={110} y1={101} x2={122} y2={104} />
          </g>
          <circle className="eye" cx={86} cy={114} r={9} />
          <circle className="eye" cx={114} cy={114} r={9} />
          <path className="mouth" d={mouthPath(moodState)} />
        </g>
        <circle className="fill-ink pupil" cx={86} cy={114} r={3} />
        <circle className="fill-ink pupil" cx={114} cy={114} r={3} />
      </g>
    </svg>
  )
}
