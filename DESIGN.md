---
name: Reinforcement++
description: A browser-based pet-training simulation teaching paired-stimulus preference assessment and positive reinforcement.
colors:
  paper: '#efe9dd'
  paper-deep: '#e4dcc9'
  paper-edge: '#d8ceb5'
  ink: '#2f2b26'
  ink-soft: '#5c5346'
  pencil: '#948a72'
  flag: '#e8b93a'
  flag-ink: '#4a3a0a'
  ballpoint: '#2f4f8f'
  ballpoint-deep: '#22396b'
  stamp: '#a4372a'
typography:
  display:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.6rem'
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  headline:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.375rem'
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  title:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1.125rem'
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  body:
    fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 'normal'
  caption:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: '0.9rem'
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 'normal'
  label:
    fontFamily: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"
    fontSize: '0.75rem'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: '0.05em'
rounded:
  none: '0'
  sm: '0.3rem'
  md: '0.4rem'
  lg: '0.5rem'
  full: '999px'
spacing:
  xs: '0.5rem'
  sm: '0.75rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2rem'
components:
  button-primary:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '0.55rem 1.1rem'
  button-primary-hover:
    backgroundColor: '{colors.paper-deep}'
    textColor: '{colors.ink}'
  button-stamp:
    backgroundColor: '{colors.ballpoint}'
    textColor: '{colors.paper}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '0.55rem 1.1rem'
    height: '4.5rem'
  button-stamp-hover:
    backgroundColor: '{colors.ballpoint-deep}'
    textColor: '{colors.paper}'
---

# Design System: Reinforcement++

## Overview

**Creative North Star: "The Trial Data Sheet"**

The whole app is drawn as one continuous ruled clipboard sheet, the kind an
RBT already fills out during a real session, not a dashboard wrapped around
one. There is no card grid, no KPI tile, no sidebar chrome: every screen is
the same sheet with different fields filled in, clipped to a board at the
top of the viewport. The world is a working object, not a decorative
reference — data reads as tallies and ruled tables, status reads as filled
or blank form fields, and an earned conclusion reads as a rubber-stamped
seal, not a colored badge.

The system deliberately refuses the two AI-generated-UI defaults it could
easily have landed on: the cheerful gamified pet-app (badges, confetti,
mascot energy) and the cold clinical dashboard (dark analytics chrome with
no character). Both would undercut a tool that teaches real professional
technique to caregivers and RBT trainees in the same session. Cute here
means "an honest observational record," not "trivial."

**Key Characteristics:**
- One continuous ruled sheet, never a card grid.
- Ballpoint blue is the only saturated color spent on interaction; the rest
  of the palette is paper, ink, and one highlighter accent.
- Data, timestamps, and field labels are always monospace; prose is always
  the sans body face. The two never swap roles.
- Status is never conveyed by color alone: shape (stamped ring, dotted
  rule, dashed box) always carries the state too.

## Colors

A cream clipboard-paper neutral family carries the whole surface; one
saturated blue is spent on everything interactive, and two narrow accents
(a highlighter yellow, a stamp red) are reserved for two specific,
non-interchangeable meanings.

### Primary
- **Ballpoint Blue** (`#2f4f8f`): every primary action, selection state,
  and focus ring. The delivery-target button, radio/checkbox
  `accent-color`, links, and `::selection`'s companion — the one color a
  learner is trained to associate with "this is the live control."
- **Ballpoint Blue, Deep** (`#22396b`): hover/pressed state of the above,
  never a separate meaning.

### Secondary
- **Highlighter Yellow** (`#e8b93a`): attention and "due now," never
  decoration. Used for the assessment's recording hint, and as the literal
  `::selection` highlight color — the one place the metaphor and the
  browser affordance are the same object.
- **Flag Ink** (`#4a3a0a`): the only text color ever set against the
  highlighter fill, chosen for contrast, not palette variety.

### Tertiary
- **Accession Stamp Red** (`#a4372a`, dark mode `#d9705d`): reserved for
  evidence that has actually been earned — the selected item in an
  observed trial, and the accession-seal ring on the debrief's two
  headline conclusions (reinforcer status, extinction-burst status). Never
  used for a generic destructive or error state; this product has no error
  states in that sense.

### Neutral
- **Paper** (`#efe9dd`): the sheet's ground.
- **Paper, Deep** (`#e4dcc9`): panels set into the sheet — session
  controls, status fields, chart backgrounds, tables.
- **Paper Edge** (`#d8ceb5`): every hairline rule and default border.
- **Graphite Ink** (`#2f2b26`): primary text, always ≥10:1 against paper.
- **Soft Ink** (`#5c5346`): secondary text, a darkened tint of graphite
  ink (never a desaturated gray), tuned to clear 4.5:1 against
  `paper-deep`, the darkest surface it ever sits on.
- **Pencil** (`#948a72`): provisional marks — dashed/dotted borders, the
  scrollbar thumb, the clipboard clip — never body text.

### Named Rules
**The One Ledger Rule.** The whole product is one sheet. A new screen
never introduces a card, a sidebar, or a second background color family;
it adds a new ruled section to the same document.

**The Earned-Color Rule.** Stamp red only ever marks something the event
log has actually evidenced (a recorded selection, a demonstrated
reinforcer, a detected burst). It never marks a generic warning or a
merely-selected-but-unconfirmed state — that is ballpoint blue's job.

## Typography

**Body Font:** IBM Plex Sans (with `system-ui, -apple-system, "Segoe UI",
sans-serif`)
**Label/Mono Font:** IBM Plex Mono (with `ui-monospace, "SFMono-Regular",
Menlo, monospace`)

**Character:** A workhorse pairing with no separate display face — this is
an Operate surface, not a persuasive one, so Plex Sans carries headings at
a heavier weight instead of introducing a third typeface. Plex Mono is
reserved for anything that is data, a measurement, or a field label; it
never appears as a "technical" costume on prose.

### Hierarchy
- **Display / H1** (700, 1.6rem, 1.15 line-height): the product wordmark
  only; appears once, in the sheet's letterhead.
- **Headline / H2** (700, 1.375rem): screen-level section titles
  (Preference assessment, Training, Session debrief).
- **Title / H3** (700, 1.125rem): subsection titles. Inside a training
  round (`.crf-round`, `.vr-round`, `.extinction-round`) it takes the
  Stamped Condition Header treatment instead (see Components).
- **H4** (600, 1rem, uppercase, 0.04em tracking, soft ink): field-group
  titles, e.g. "Preference hierarchy." Shares Body's size; the uppercase
  tracking alone carries the distinction.
- **Body** (400, 1rem, 1.55 line-height, 68ch max measure): all prose.
- **Caption** (400, 0.9rem, mono, soft ink): secondary/data text that
  isn't a field label — session elapsed time, coaching progress lines,
  table body and captions, chart summaries, the keyboard-shortcut hint,
  `.boundary-note`. One step below Body, not four scattered ones: this
  role replaced five near-duplicate values (0.95/0.9/0.85/0.8rem) that
  had drifted apart with no rationale, caught by the design-system-font-size
  hook.
- **Label** (500, 0.75rem, uppercase, 0.05em tracking, mono, soft ink):
  `fieldset legend`, table column headers.
- **`kbd` exception** (0.85em, relative to its context, not a ramp step):
  the single keyboard-shortcut glyph scales off its surrounding text
  rather than the fixed type scale, since it always sits inline next to
  body or caption text of varying size.

### Named Rules
**The Two-Voice Rule.** Sans is prose and headings; mono is data,
timestamps, and labels. A component never borrows the other face for
emphasis — weight and size carry emphasis instead.

## Layout

A single-column sheet, `max-width: 46rem`, centered, floating on a deeper
paper-edge backdrop. The sheet's own background is a horizontal rule
pattern (`repeating-linear-gradient`, one line every 1.7rem) — the page is
never a flat fill. One breakpoint at `36rem`: below it the sheet loses its
radius and margin and becomes edge-to-edge (the clipboard fills the
viewport rather than floating on a desk), controls stack to full width,
and the session-controls fieldsets wrap.

Vertical rhythm follows the ruled background: section spacing (`h2`
margin-top `2rem`, `h3` margin-top `1.75rem`) is a multiple of the rule
spacing so headings land on a line rather than between two.

## Elevation & Depth

Mostly flat-on-paper: panels (`paper-deep`) sit in the sheet by border and
fill alone, never a shadow. The sheet itself gets one soft, physically
plausible shadow (`0 1px 2px` plus a diffuse `0 12px 28px -14px`, both
tinted from `--shadow-color` rather than pure black) — paper resting on a
desk, not a card floating in a design system.

### Shadow Vocabulary
- **Sheet ambient** (`0 1px 2px rgb(var(--shadow-color) / 0.12), 0 12px
  28px -14px rgb(var(--shadow-color) / 0.35)`): the `.app-shell` only.
- **Clip drop** (`0 3px 6px -2px rgb(var(--shadow-color) / 0.4)`): the
  clipboard clip hardware only.
- **Stamp press** (`0 4px 0 var(--ballpoint-deep)`, compressing to `0 1px
  0` on press with a `translateY` shift): a deliberate, singular
  exception to the soft-shadow rule above, scoped to `.delivery-target`
  only — see Named Rules.

### Named Rules
**The One Hard Shadow Rule.** The flat, zero-blur `0 4px 0` stamp shadow
belongs to exactly one element: the delivery-target button, the single
most-pressed control in the product. It is a physical reference to a
rubber stamp's mechanical press, not a depth system — no other button,
card, or panel may adopt it.

## Shapes

Corners follow two real steps: `sm` (0.3rem — the sheet itself, kbd,
stamped condition headers, small tags) and `md` (0.4rem — buttons, fields,
panels, the debrief conclusion box, chart containers), plus `lg` (0.5rem)
reserved for the delivery-target alone, and `full` (999px/50%) for pills
and circles (the clip bar, the accession seal). Two close-but-different
one-off values (0.35rem on several `md`-scale elements, 0.25rem on the
sheet) were caught by the design-system-radius hook and folded into `sm`/
`md` rather than kept as their own steps — a token used once is not a
system. Borders do the differentiating work color would otherwise have to
do: a 1–1.5px `paper-edge` border is the default field edge; a 2px `ink`
border marks a hard rule (the letterhead underline, stamped condition
headers); a dashed `pencil` border marks an observation/in-progress box; a
dotted `pencil` bottom rule marks a status field, like a line waiting to
be filled in.

Two radii stay outside the token scale on purpose, not by drift: the
clip's bottom tab (`0 0 0.6rem 0.6rem`) is a bespoke shape belonging only
to that one decorative signature component (see The Clip), not a reusable
step — folding a one-off decorative curve into the system scale would
pollute it for every future component. A `:focus-visible` corner nudge
that used to ride on every focused element regardless of its own shape was
removed outright rather than documented, since it had no real
justification beyond habit.

## Components

### Buttons
- **Shape:** `0.4rem` radius (`md`), `1.5px solid ink` border, no fill
  beyond `paper`/`paper-deep`.
- **Default:** `paper` background, `ink` text and border; hover deepens to
  `paper-deep`; press is a `1px` `translateY`, never a color change alone.
- **Disabled (`aria-disabled`):** `pencil` text and border, background
  unchanged — legible without relying on opacity or color alone.
- **Stamp (signature, `.delivery-target` only):** `ballpoint` fill,
  `paper` text at `1.2rem` (its own size, one step above Body — the single
  most-pressed control earns the one bespoke font size in the system,
  same logic as the One Hard Shadow Rule), a `3px double paper` border
  inside a `2px ballpoint` outline, and the One Hard Shadow (see
  Elevation). This is the only button that gets a saturated fill; every
  other button stays
  paper-on-paper.

### Fields (fieldset/legend)
- **Style:** `paper-edge` bordered box, `0.4rem` radius; the legend sits
  in a Label-style mono caption (`SPEED`, `DETAIL`, `WHAT TO DELIVER`,
  `RECORD WHAT YOU OBSERVED`) — a real HTML `<legend>`, never a decorative
  kicker over a heading.
- **Radios/checkboxes:** native controls, themed only via
  `accent-color: var(--ballpoint)` — no custom-drawn control.

### Status / Notice Fields
- **Style:** `paper-deep` background, `paper-edge` border, `1px dotted
  pencil` bottom rule — a form field waiting to be read, not a callout
  card.
- **Attention variant** (`.assessment-hint`, "due now"): a highlighter
  wash (`color-mix(in srgb, flag 22%, paper-deep)`) with a matching
  yellow-tinted border. **Never** a colored `border-left`/`border-right`
  accent bar — that pattern was built once, caught by the design
  detector, and removed; see Do's and Don'ts.

### Tables
- **Style:** `2px solid ink` under `thead`, `1px solid paper-edge` between
  rows, `paper-deep` row hover, mono `tabular-nums`, uppercase
  0.75rem/0.04em tracked column headers, caption in Body-on-soft-ink above
  the table.

### Stamped Condition Header (signature)
- Inline-block `h3` inside `.crf-round`/`.vr-round`/`.extinction-round`:
  `2px solid ballpoint` border, `0.3rem` radius, `-1.25deg` rotation,
  uppercase, `0.03em` tracking. Marks which condition a block of trials
  belongs to, the way a real data sheet stamps its condition header.

### Accession Seal (signature)
- A fixed `2.35rem` circle on `.debrief-conclusion`/
  `.debrief-burst-conclusion`, drawn as two concentric rings with a
  `radial-gradient` in `stamp` red, `-9deg` rotated, positioned top-right
  independent of how the paragraph wraps. Marks a conclusion the event log
  has actually evidenced.

### The Clip (signature)
- Two CSS-only shapes pinned to the top-center of `.app-shell` via
  `::before`/`::after`: a `pencil`-colored bar and a `paper-deep` tab,
  reading as the physical clip holding the sheet to a board. No image
  asset.

### Navigation
None: the product is a single linear flow (assessment → baseline → CRF →
VR-3 → optional extinction → debrief) with no persistent nav chrome by
product design (ADR 0002/0004). `SessionControls` (pause, speed, detail
mode) is the closest analog and is styled as a `paper-deep` hardware strip
directly under the letterhead, not a nav bar.

## Do's and Don'ts

### Do:
- **Do** keep the whole product as one ruled sheet (`max-width: 46rem`,
  ruled-line background); a new screen adds a section, never a second
  surface.
- **Do** put anything that is data, a timestamp, or a field label in IBM
  Plex Mono; keep prose in IBM Plex Sans. Never swap the two for emphasis.
- **Do** theme browser-native surfaces from the palette: `::selection`,
  `caret-color`, `accent-color`, focus rings, and both scrollbar APIs are
  all set — an unthemed browser default is the cheapest tell that a page
  was assembled, not built.
- **Do** mark the "due now" / attention state with the highlighter wash
  (`color-mix(in srgb, flag ..%, paper-deep)`), never a colored border
  accent.
- **Do** keep dark mode inside the same paper material family (dark kraft
  ground, warm parchment ink) — never fall back to a generic slate/neon
  dark theme; the use scene is the same clipboard read by a desk lamp.

### Don't:
- **Don't** add a colored `border-left`/`border-right` accent to any box.
  This system shipped one once (on the status-line notices), the design
  detector flagged it as the recognizable AI-tool tell, and it was
  replaced with the dotted-rule/highlighter-wash pattern above. It does
  not come back.
- **Don't** apply the delivery-target's flat `0 4px 0` stamp shadow to any
  other element. It is a named, singular exception (see Elevation), not a
  depth system.
- **Don't** introduce a card grid, an icon-plus-heading-plus-text
  scaffold, or a sidebar. The One Ledger Rule holds even when a new screen
  feels like it wants its own visual identity.
- **Don't** add a kicker or eyebrow label above a heading. Existing
  uppercase mono labels in this system are real `<legend>`/`<h4>`
  elements doing structural work, not decorative kickers riding above a
  headline.
- **Don't** theme the visx charts (`src/app/charts/*.tsx`) directly; they
  already draw in `currentColor` and inherit from `.chart`'s CSS. New
  chart styling belongs in `styles.css`, never in the chart components
  themselves (ADR 0007 keeps visx behind one file per chart).
