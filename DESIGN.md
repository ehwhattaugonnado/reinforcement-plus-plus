---
name: Reinforcement++
description: A browser-based pet-training simulation teaching paired-stimulus preference assessment and positive reinforcement.
colors:
  paper: '#ffffff'
  paper-deep: '#eef0f2'
  paper-edge: '#d7dbe0'
  ink: '#1c1e22'
  ink-soft: '#52585f'
  pencil: '#8b929b'
  flag: '#e8b93a'
  flag-ink: '#3b2e05'
  ballpoint: '#2f4f8f'
  ballpoint-deep: '#22396b'
  ballpoint-shadow: '#22396b'
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
    lineHeight: '1.7rem'
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
  rule: '1.7rem'
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
- One continuous ruled ledger plus its control margin — never a card grid,
  a KPI tile, or a nav sidebar.
- Ballpoint blue is the only saturated color spent on interaction; the rest
  of the palette is paper, ink, and one highlighter accent.
- Data, timestamps, and field labels are always monospace; prose is always
  the sans body face. The two never swap roles.
- Status is never conveyed by color alone: shape (stamped ring, dotted
  rule, dashed box) always carries the state too.

## Colors

A true-white printed-stock neutral family carries the whole surface; one
saturated blue is spent on everything interactive, and two narrow accents
(a highlighter yellow, a stamp red) are reserved for two specific,
non-interchangeable meanings. An earlier pass used a warm kraft-paper
neutral family (`#efe9dd` ground); it read as brown rather than as paper
and was replaced outright, not tinted.

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
- **Paper** (`#ffffff`): the sheet's ground — true white printed stock,
  not an off-white tint.
- **Paper, Deep** (`#eef0f2`): panels set into the sheet — session
  controls, status fields, chart backgrounds, tables.
- **Paper Edge** (`#d7dbe0`): every hairline rule and default border.
- **Graphite Ink** (`#1c1e22`): primary text, ~16:1 against paper.
- **Soft Ink** (`#52585f`): secondary text, a darkened tint of graphite
  ink (never a desaturated gray), clearing 7:1 against paper and 6.4:1
  against `paper-deep`, the darkest surface it ever sits on.
- **Pencil** (`#8b929b`): provisional marks — dashed/dotted borders, the
  scrollbar thumb, the clipboard clip — never body text.

### Named Rules
**The One Ledger Rule.** The whole product is drawn from one paper
surface and one set of tokens. A new screen never introduces a card, a
second background-color family, or a floating panel with its own
elevation; it adds a new ruled section to the same document. The control
margin (see Layout) is not an exception — it is a `paper-deep` boxed
field, the same component the ledger already uses for status lines and
fieldsets, positioned in a fixed grid column instead of the vertical
flow.

**The Earned-Color Rule.** Stamp red only ever marks something the event
log has actually evidenced (a recorded selection, a demonstrated
reinforcer, a detected burst). It never marks a generic warning or a
merely-selected-but-unconfirmed state — that is ballpoint blue's job. Nor
does it mark chrome: the wordmark's dot is drawn in ballpoint, because
letterhead is on screen from first paint, before a single event exists.

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

A two-column sheet, `max-width: 68rem`, centered, floating on a deeper
paper-edge backdrop. The sheet's own background is a horizontal rule
pattern (`repeating-linear-gradient`, one line every 1.7rem) — the page is
never a flat fill.

The letterhead (`<header>`) spans the full width at the top. Below it, a
CSS grid splits the sheet into the ledger (`<main>`, `minmax(0, 1fr)`) and
a fixed `16rem` control margin (`SessionControls`: pause, speed, detail,
timer), separated by a `2.5rem` column gap. The margin holds `position:
sticky` at `top: 1.5rem` so pause and speed stay reachable through a long
training round without hunting back up the page. This replaced an earlier
single-column layout capped at `46rem` — on any laptop-or-wider viewport
it left most of the frame as empty backdrop and pushed the standing
controls into the vertical scroll of the trial content itself.

`SessionControls` sits *after* `<main>` in the DOM and is placed into the
margin by `grid-area`. Rendered first, it made Pause the document's first
focusable element on every screen, and put keyboard focus in the right-hand
margin before the left-hand ledger. Grid placement keeps the margin on the
right while focus follows reading order.

**Breakpoints:**
- **`50rem`:** the control margin no longer has room beside the ledger. The
  grid collapses to one column (`header` / `main`) and the controls become a
  fixed bar along the bottom edge — last in reading order, last in focus
  order, and always on screen. Stacking them *above* the task made a
  preferences box the first thing a cold visitor met, and leaving them
  statically positioned let pause and speed scroll away mid-round.
  `--control-bar-h` reserves the bar's height in the sheet's bottom padding,
  measured at runtime rather than predicted — the bar's height depends on the
  viewport *and* on which pause message the simulation is showing, and the
  end of a round is exactly the content a short reserve hides.
- **`36rem`:** the sheet loses its radius and outer margin and becomes
  edge-to-edge (the clipboard fills the viewport rather than floating on a
  desk), and the delivery-target/round-action buttons go full width.

**The Rule Is The Unit.** `--rule: 1.7rem` (27.2px) is the sheet's single
vertical unit. The ruled background paints one line every `--rule`, the body
line box *is* `--rule`, and every heading margin is a whole multiple of it
(`h2` `calc(--rule * 2)` above, `h3`/`h4` one). Consecutive lines of body
text therefore advance exactly one rule and stay parallel to the ruling
instead of walking across it.

This replaced a version where the claim was made but not implemented: the
sheet ruled every `1.7rem` while the body line box was `1.55 x 16px =
24.8px`, so each line landed 2.4px further off than the last, `h2`'s `2rem`
margin was 1.176 rules and `h3`'s `1.75rem` was 1.029, and no element in the
product ever touched a rule. The metaphor was decorative rather than
structural. Per-line drift is now zero; a section's *phase* against the
ruling can still be non-zero, because panel padding and chart heights are
not yet quantised to the unit — that is the remaining half of the work, not
a claim this file should make in advance.

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
- **Stamp press** (`0 4px 0 var(--ballpoint-shadow)`, compressing to `0 1px
  0` on press with a `translateY` shift): a deliberate, singular
  exception to the soft-shadow rule above, scoped to `.delivery-target`
  only — see Named Rules. The shadow uses its own token, not the hover
  fill: `--ballpoint-shadow` is always *darker* than the button face, while
  `--ballpoint-deep` moves toward higher contrast against its ground, which
  on a dark scheme means lighter. Sharing one token rendered the stamp lit
  from below in dark mode.

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

### The Stopped State (signature)

The session can stop *without being asked* — a backgrounded tab, or one of
the two automatic coaching checkpoints — so a stop has to read from the
trial content, not only from the control margin. (When this rule was
written the margin went `position: static` below `50rem` and sat several
hundred pixels above the viewport during a round; it is a fixed bottom bar
there now, but the rule stands on its own — a stop belongs where the work
is.)

- **`.paused-notice`:** a Status Field variant carrying the highlighter wash,
  a rotated `PAUSED` stamp mark (`::before`, the same device as the Stamped
  Condition Header), the reason for the stop in words, and an in-round
  `Resume session` button. Renders nothing while running.
- **`.app-shell[data-paused] > main`:** `filter: grayscale(0.9)`. The sheet
  is near-monochrome already, so the one thing this actually drains is the
  single saturated element in the trial area — the delivery target — which
  is precisely the control that has stopped working. Luminance is preserved,
  so text contrast is unaffected. Scoped to `main` rather than the shell
  because a filter creates a containing block and would break the control
  margin's `position: sticky`.
- **`.delivery-target[aria-disabled='true']`:** paper-deep fill, soft ink,
  pencil outline — the documented disabled treatment, not an opacity fade.
- **`.session-pause[aria-pressed='true']`:** the highlighter wash, so the
  standing toggle carries the state and not only its own label.

**Why the flag and not the stamp.** A stop is an attention state needing
action, which is exactly what Highlighter Yellow is for. Stamp red stays
reserved for evidence the event log has earned (see The Earned-Color Rule);
a pause is not an achievement.

### Navigation
None: the product is a single linear flow (assessment → baseline → CRF →
VR-3 → optional extinction → debrief) with no persistent nav chrome by
product design (ADR 0002/0004). `SessionControls` (pause, speed, detail
mode, elapsed time) is the closest analog and is styled as a `paper-deep`
boxed field standing in the sheet's control margin (see Layout) — a Status
Field variant, not a nav bar.

## Do's and Don'ts

### Do:
- **Do** keep the whole product as one ruled sheet with one fixed control
  margin (`max-width: 68rem`, ruled-line background); a new screen adds a
  ledger section, never a second card surface.
- **Do** put anything that is data, a timestamp, or a field label in IBM
  Plex Mono; keep prose in IBM Plex Sans. Never swap the two for emphasis.
- **Do** theme browser-native surfaces from the palette: `::selection`,
  `caret-color`, `accent-color`, focus rings, and both scrollbar APIs are
  all set — an unthemed browser default is the cheapest tell that a page
  was assembled, not built.
- **Do** mark the "due now" / attention state with the highlighter wash
  (`color-mix(in srgb, flag ..%, paper-deep)`), never a colored border
  accent.
- **Do** keep dark mode inside the same paper material family (a designed
  charcoal ground, not a dark tint of the light kraft palette) — never
  fall back to a generic slate/neon dark theme; the use scene is the same
  clipboard read by a desk lamp.

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
  scaffold, or a nav sidebar. The One Ledger Rule holds even when a new
  screen feels like it wants its own visual identity — the one sanctioned
  exception is the existing control margin, which is a Status Field
  component, not a new surface (see Layout, Navigation).
- **Don't** add a kicker or eyebrow label above a heading. Existing
  uppercase mono labels in this system are real `<legend>`/`<h4>`
  elements doing structural work, not decorative kickers riding above a
  headline.
- **Don't** theme the visx charts (`src/app/charts/*.tsx`) directly; they
  already draw in `currentColor` and inherit from `.chart`'s CSS. New
  chart styling belongs in `styles.css`, never in the chart components
  themselves (ADR 0007 keeps visx behind one file per chart). Chart
  *geometry* — viewBox, margins, scales, tick counts and domains — is the
  components' own business and lives in `src/app/charts/format.ts`, shared
  by both charts so they cannot drift apart again. They previously carried
  different viewBox widths (480 vs 420) and different left margins, so at
  one container width they rendered at two different scale factors: plot
  edges 19.6px apart and axis text at two different on-screen sizes on the
  same sheet. Both now share one viewBox width and one margin set.
- **Don't** let a live chart's domain track the clock continuously. The
  cumulative record's x-domain is rounded up to a step ladder (10s, 20s,
  30s, 1m, 2m…) so ticks land on round times and the plot advances in
  discrete steps. Bound to raw `elapsedSimMs` it rescaled every animation
  frame, drifting every mark and tick ~10px/second, permanently.

  **Known residual:** because the SVG is `width: 100%` over a fixed viewBox,
  axis text scales with the container — 14.25px at 1440px, 6.23px at 375px.
  Unifying the viewBox made the two charts consistent but not legible on a
  phone. No CSS `font-size` can fix this (SVG text is in viewBox units and
  scales identically); the real fix is a container-driven viewBox, which is
  a feature, not a tweak. Until then the accessible path carries it: every
  chart is `aria-hidden` decoration over a text summary and a data table
  derived from the same chart-data object.
- **Don't** revert the neutral palette to a warm kraft/brown cast. This
  system shipped that once, the product owner rejected it on sight, and it
  was replaced with the true-white family above.
