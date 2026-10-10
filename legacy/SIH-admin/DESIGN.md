---
name: ClassPulse Editorial Brutalist Design System
description: Swiss-monochrome editorial brutalist UI for smart classroom administration
colors:
  primary: "#111111"
  ink-hover: "#333333"
  ink-2: "#444444"
  neutral-bg: "#f6f6f3"
  surface: "#ffffff"
  surface-sunken: "#fafaf8"
  surface-hover: "#f1f1ee"
  surface-selected: "#f2f2ef"
  border: "#d7d7d2"
  border-strong: "#111111"
  border-input: "#cfcfca"
  border-soft: "#e2e2dd"
  border-faint: "#e8e8e3"
  text-primary: "#111111"
  text-secondary: "#555555"
  text-muted: "#777777"
  text-muted-2: "#888888"
  on-ink-muted: "#bdbdbd"
  on-ink-eyebrow: "#aaaaaa"
  success: "#111111"
  danger: "#111111"
typography:
  display:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "clamp(58px, 7vw, 94px)"
    fontWeight: 900
    lineHeight: "0.88"
    letterSpacing: "-5px"
  headline:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "31px"
    fontWeight: 700
    lineHeight: "1"
    letterSpacing: "-1.3px"
  body:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "1.6"
  eyebrow:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "9px"
    fontWeight: 900
    letterSpacing: "1.8px"
    textTransform: "uppercase"
  stat:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "46px"
    fontWeight: 900
    lineHeight: "1"
    letterSpacing: "-2px"
rounded:
  sm: "0"
  md: "0"
  lg: "0"
spacing:
  sm: "8px"
  md: "14px"
  lg: "22px"
  section: "78px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    minHeight: "46px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    minHeight: "46px"
---

# Design System: ClassPulse Editorial Brutalist

## Overview

**Creative North Star: "A Swiss-typography poster that became software"**

ClassPulse presents classroom administration on a warm off-white paper canvas (`#f6f6f3`) with pure-white cards, hairline 1px warm-grey borders (`#d7d7d2`) and a single ink colour (`#111`) doing all of the work. There is no accent colour, no gradient, no blur and no rounded corner anywhere. Hierarchy comes from weight (900 vs 400), scale (94px headlines beside 9px eyebrows), tracking (−5px on display type, +1.8px on micro-labels) and rule lines. Interaction is physical: a card lifts 4px and grows a hard, un-blurred black offset shadow (`6px 6px 0 #111`); a button is a black slab that merely darkens to `#333`.

**Key Characteristics:**
- **Paper Canvas**: flat `#f6f6f3` background, flat white surfaces, no texture.
- **Hairline Rules**: every border is `1px`. Default `#d7d7d2`, strong `#111`, inner rules `#e2e2dd`, row separators `#e8e8e3`.
- **Zero Radius**: every card, button, input, badge, avatar and modal is square. The only circle is the 7px status dot.
- **Hard Offset Shadows**: `6px 6px 0 #111` on hover, `8px 8px 0 #111` on static feature cards, `4px 4px 0 #ddd` on focused inputs. The modal is the sole soft shadow.
- **Black Hero Band**: `#111` band with two rotated 45° hairline square outlines bleeding off its right edge, a `#aaa` eyebrow, a `clamp(58px,7vw,94px)/900` headline and an inverted white primary button.
- **Inter Everywhere**: weights 400 / 700 / 800 / 900. No monospace, serif or handwriting fonts.

## Colors

Strictly monochrome. State (error, success, live, selected, correct) is expressed with ink borders, ink fills, weight and copy — never hue.

### Primary
- **Ink** (#111111): text, primary button background, hero band, strong borders, progress fill, hard shadows.
- **Ink Hover** (#333333): primary button hover; hero decoration outline colour.

### Neutral
- **Canvas** (#f6f6f3): page background.
- **Surface** (#ffffff): cards, panels, topbar, footer, inputs, modals.
- **Surface Sunken** (#fafaf8): icon boxes, quiet info blocks.
- **Surface Hover** (#f1f1ee): nav link / row hover.
- **Surface Selected** (#f2f2ef): selected or correct option rows.
- **Border** (#d7d7d2): default card / panel / topbar border.
- **Border Input** (#cfcfca): inputs, pills, badges, modal frame.
- **Border Soft** (#e2e2dd): inner rules (panel headers, metric grids).
- **Border Faint** (#e8e8e3): list row separators, progress track.
- **Muted Text** (#777777): eyebrows, captions, descriptions.
- **Secondary Text** (#555555): text links, badge copy, ghost buttons.
- **On-Ink Muted** (#bdbdbd): body copy on black surfaces.

### Named Rules
**The One-Ink Rule.** No hue accents. Success, danger, live and active states are all ink-bordered or ink-filled. Danger buttons are grey-bordered white slabs that fill black on hover.

## Typography

**Family:** Inter (Arial, Helvetica, sans-serif fallback), loaded via Google Fonts in `app/layout.jsx` (`--font-sans` custom property; Tailwind `font-sans` / `font-display`).

**Character:** Dense, confident Swiss editorial. Eyebrows, labels, badges and buttons are UPPERCASE and tracked wide; headings are sentence case with negative tracking. Micro-copy at 8–11px is normal.

### Hierarchy
- **Hero display** (`.cp-hero-title`, 900, clamp(58px, 7vw, 94px), 0.88 line-height, −5px): welcome band headline.
- **Page display** (`.cp-display`, 900, clamp(42px, 6vw, 76px), 0.9, −4px): page titles.
- **Stat value** (`.cp-stat-value`, 900, 46px, 1, −2px): metric numbers.
- **Section heading** (`.cp-h2`, 700, 31px, 1, −1.3px): section titles.
- **Panel title** (`.cp-h3`, 700, 20px, 1.15, −0.5px): panel / card headers.
- **Row title** (`.cp-h4`, 700, 13px): list items.
- **Lead** (`.cp-lead`, 400, 13px, 1.6, #777): page descriptions.
- **Body** (12px, 400, 1.6): inputs, copy.
- **Caption** (`.cp-caption`, 10px, #777): meta text.
- **Button label** (10px, 900, 0.5px tracking, uppercase).
- **Eyebrow** (`.cp-eyebrow`, 9px, 900, 1.8px tracking, uppercase, #777): above every section, card and metric title.
- **Badge** (`.cp-badge`, 8px, 900, 1px tracking, uppercase).

### Named Rules
**The Eyebrow Rule.** Every section, panel, card and stat carries a 9px/900 uppercase tracked eyebrow above its title.

## Layout

- Sticky white topbar (`.cp-topbar`, min-height 78px, padding 0 42px, 1px `#d5d5d0` bottom rule) with a 40px square brand mark, nav links and a profile block with a 35px black square avatar.
- Content container `.cp-content`: `width: min(1380px, 100% - 84px)`, centred, `padding: 64px 0 80px`; direct children are separated by 78px (`.is-tight` variant: 36px top / 40px gaps).
- Grids: `.cp-grid-stats` (4-up), `.cp-grid-3`, `.cp-grid-2`, `.cp-columns` (two equal `minmax(0,1fr)` columns). Gap 14px; `.cp-stack` stacks cards vertically at 14px. All collapse at 1100px / 800px / 560px.
- Hero-to-stats and header-to-content: the first block after `.cp-hero` or `.cp-page-header` hugs it at 14px; all other section gaps stay 78px. `.cp-page-header` closes with a 30px pad and a 1px `#d7d7d2` rule; its `.cp-lead` is capped at 650px with 20px top margin.
- Tailwind breakpoints are deliberately overridden (not extended) to match the CSS media queries: `sm` 560px, `md` 800px, `lg` 1100px, `xl` 1380px — so `md:`/`lg:` utilities and the `.cp-*` responsive rules flip at the same widths.
- Footer `.cp-footer`: 1px top rule, brand mark, copy.

## Elevation & Depth

Resting surfaces have no shadow. Depth is conveyed only by hard offset shadows:

### Shadow Vocabulary
- **Hard** (`6px 6px 0 #111`, Tailwind `shadow-hard`): hovered stat / interactive cards.
- **Hard Small** (`2px 2px 0 #111`, `shadow-hard-sm`): pressed cards.
- **Hard Large** (`8px 8px 0 #111`, `shadow-hard-lg`): static feature cards (`.cp-card-static`).
- **Hard Warm** (`7px 7px 0 #bdbdb7`, `shadow-hard-warm`): action cards that invert to black on hover.
- **Focus** (`4px 4px 0 #ddd`, `shadow-focus`): focused inputs.
- **Modal** (`0 20px 60px rgba(0,0,0,0.15)`, `shadow-modal`): the only soft shadow.

### Named Rules
**The Lift Rule.** Interactive cards move `translateY(-4px)`, turn their border ink and gain the hard shadow over `0.2s ease`. Buttons never move; they only darken. Reduced-motion users get no transforms. There are no entrance animations, pulses or scale effects; progress fills and the live dot are static (no width transition, no pulse).

**Iconography.** No icon library. Icons are Unicode glyphs rendered in Inter inside the bordered square boxes (`▣` classrooms, `▤` schedules, `□` people/rows, `✓` quizzes/confirm, `↗` stat trend, `→`/`←` navigation, `＋` create, `×` close/delete, `●`/`○` on/off). Charts (recharts) use square-ended bars in `#111`/`#555` on `#e8e8e3` rules with 9px `#888` uppercase ticks.

## Shapes

- **Radius:** 0 on everything. Tailwind `rounded-*` utilities are all mapped to 0 in `tailwind.config.mjs`.
- **Border width:** always 1px.
- **Square icon boxes:** 34px (`.cp-icon-box`), 38px (`.is-lg`), 60px (`.is-xl`), 40px brand mark, 36px row icon, 23px letter chip.
- **Status dot:** 7px circle (`.cp-dot`) — the sole rounded element.

## Components

### Buttons
- **Primary** (`.cp-btn-primary`): 46px tall, `#111` background, white 10px/900 uppercase label, 1px `#111` border, hover `#333`. Inverted (white) inside `.cp-hero`.
- **Secondary** (`.cp-btn-secondary`): white with 1px `#111` border, hover `#eee`.
- **Ghost** (`.cp-btn-ghost`): white with `#ccccca` border that turns ink on hover; sentence-case 700 label.
- **Outline** (`.cp-btn-outline`): transparent, fills black on hover.
- **Danger** (`.cp-btn-danger`): grey-bordered white, fills black on hover (no red).
- **Sizes:** `.cp-btn-xs` (30px), `.cp-btn-sm` (38px), default (46px), `.cp-btn-lg` (54px), `.cp-btn-block`.
- **Disabled:** `opacity: .55; cursor: not-allowed`.

### Cards / Containers
- **Card** (`.cp-card`): white, 1px `#d7d7d2`, 22px padding. Add `.cp-card-interactive` for lift + hard shadow; `.is-selected` keeps the ink border and shadow.
- **Stat** (`.cp-stat`): min-height 190px, icon box top-left, eyebrow label, 46px value pushed to the bottom.
- **Action card** (`.cp-action-card`): 230px tall, inverts to black on hover with warm hard shadow.
- **Panel** (`.cp-panel`): 27px padding with `.cp-panel-header` (bottom rule) for titled content.
- **Ink card** (`.cp-card-ink`): black block for callouts.
- **Metric grid** (`.cp-metric-grid`): cells separated only by hairline rules.

### Inputs / Selectors
- `.cp-input`, `.cp-select`, `.cp-textarea`: 44px tall, 1px `#cfcfca` border, 12px text; focus = ink border + `4px 4px 0 #ddd`. `.cp-label` = 9px/900 uppercase. Search inputs are plain `.cp-input`s with an `aria-label` (no leading icon). `.cp-segment` for segmented toggles, `.cp-tabs`/`.cp-tab` for index tabs, `.cp-toggle` for on/off chips.

### Lists / Tables
- `.cp-row` (72px, hairline separator, `.is-interactive`, `.is-selected`), `.cp-list-bordered` wrapper, `.cp-table` with ink header rule and faint row rules, `.cp-progress` 7px ink-on-track bar.

### Pills / Badges / Status
- `.cp-badge` (8px/900 uppercase, grey border; `.is-ink`, `.is-outline`, `.is-muted`), `.cp-status` (38px pill with `.cp-dot`), `.cp-live` text indicator, `.cp-alert` (ink-bordered box for error AND success).

### Navigation
- `.cp-topbar` + `.cp-brand-area` / `.cp-brand-mark` / `.cp-brand` / `.cp-brand-subtitle`, `.cp-nav` with `.cp-nav-link` (9px 11px padding, `#777`, hover `#f1f1ee` + border, active black with white text), `.cp-profile` / `.cp-avatar` / `.cp-icon-btn`.

### Modal / Empty state
- `.cp-overlay` (rgba(0,0,0,.45) scrim) + `.cp-modal` (`.cp-modal-header` / `-body` / `-footer`, 25px title).
- `.cp-empty` (360px white box, 60px ink-bordered icon square, 28px title, muted copy; `.is-sm` variant).

## Do's and Don'ts

### Do:
- **Do** use 1px hairline borders, square corners and hard offset shadows only.
- **Do** place a `.cp-eyebrow` above every heading, card and metric.
- **Do** express state with ink (border, fill, weight) and copy.
- **Do** keep Inter as the only family; use weight and tracking for hierarchy.

### Don't:
- **Don't** use any `rounded-*` intent, pastel fills, hue accents (sky, yellow, indigo, rose, emerald) or gradients.
- **Don't** use soft blurred shadows (except the modal) or backdrop blur.
- **Don't** introduce monospace, handwriting or pixel fonts.
- **Don't** cram low-level backend telemetry into user-facing admin views.
