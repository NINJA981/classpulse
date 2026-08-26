---
name: ClassPulse Zine Explainer Design System
description: DIY newsprint tactile Zine Explainer UI for smart classroom management
colors:
  primary: "#0f172a"
  accent-yellow: "#fde047"
  accent-yellow-light: "#fef9c3"
  accent-sky: "#bae6fd"
  accent-sky-light: "#e0f2fe"
  accent-mint: "#dcfce7"
  accent-pink: "#fce7f3"
  neutral-bg: "#faf7f2"
  surface: "#ffffff"
  surface-muted: "#f4efe6"
  border-ink: "#0f172a"
  text-primary: "#0f172a"
  text-secondary: "#334155"
  text-muted: "#64748b"
  success: "#10b981"
  danger: "#e11d48"
typography:
  display:
    fontFamily: "Kalam, Outfit, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: "1.2"
  body:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.5"
  handwriting:
    fontFamily: "Architects Daughter, Caveat, Kalam, cursive"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: "1.4"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent-yellow}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
---

# Design System: ClassPulse Zine Explainer

## Overview

**Creative North Star: "The Classroom Explainer Zine"**

ClassPulse delivers a distinct, highly readable DIY Zine visual style for classroom administration. Moving away from generic dark-mode dashboards and sterile flat UI, ClassPulse presents information as an engaging, hand-drawn explainer publication. It leverages warm newsprint paper textures (`#faf7f2`), high-contrast sketchy charcoal ink borders (`2px solid #0f172a`), tactile drop shadows (`3px 3px 0px 0px #0f172a`), and paper tape strip overlays with pastel highlighter color accents.

**Key Characteristics:**
- **Warm Newsprint Canvas**: `#faf7f2` paper background with subtle 40px grid dot patterns.
- **Sketchy Ink Borders**: Bold `2px solid #0f172a` charcoal ink outlines around every container, button, and input.
- **Tactile Zine Drop Shadows**: Hard 3px to 5px solid offset shadows (`#0f172a`) with physical click translation effects.
- **Paper Stickers & Tape**: Highlighter yellow (`#fef08a`), sky (`#bae6fd`), mint (`#dcfce7`), and pink (`#fce7f3`) sticker badges and tape strip callouts.
- **Hand-Drawn Typography**: Playful yet structured typography pairing Google Fonts `Architects Daughter`, `Caveat`, `Kalam`, `Outfit`, `Plus Jakarta Sans`, and `JetBrains Mono`.

## Colors

The palette uses a warm newsprint paper canvas with dark charcoal ink outlines and expressive pastel highlighter roles.

### Primary
- **Charcoal Ink** (#0f172a): Used for sketchy card borders, heavy title text, drop shadows, and dark contrast elements.

### Accents
- **Highlighter Yellow** (#fde047 / #fef9c3): Primary button fills, active tab highlights, and primary callout cards.
- **Paper Sky** (#bae6fd / #e0f2fe): Teacher dashboard cards, teacher assignment tools, and active user role pills.
- **Paper Mint** (#dcfce7): Student portal elements, classroom assignment tools, and active status indicators.
- **Paper Pink** (#fce7f3): Timetable management cards and calendar schedule highlights.

### Neutral
- **Newsprint Canvas** (#faf7f2): Main background canvas with subtle dot texture.
- **Surface White** (#ffffff): Card and dialog background surfaces.
- **Ink Border** (#0f172a): Explicit 2px solid container outlines.
- **Deep Slate Text** (#0f172a): Primary headlines and high-contrast titles.
- **Charcoal Text** (#334155): Body text and form field labels.
- **Muted Slate** (#64748b): Captions, timestamps, and secondary labels.

### Named Rules
**The Hard-Shadow Ink Rule.** Every card and interactive container must feature a `2px solid #0f172a` ink border and a hard offset shadow (`3px 3px 0px 0px #0f172a`). Soft blurred ambient shadows are strictly prohibited.

## Typography

**Display Font:** Kalam (with Outfit, sans-serif fallback)
**Handwriting Accent Font:** Architects Daughter (with Caveat, Kalam, cursive fallback)
**Body Font:** Plus Jakarta Sans
**Label / Mono Font:** JetBrains Mono

**Character:** Friendly, tactile, and highly readable DIY zine explainer aesthetic.

### Hierarchy
- **Display** (800 weight, 1.5rem / 24px, 1.2 line-height): Section headlines and zine title banners.
- **Headline** (700 weight, 1.125rem / 18px, 1.3 line-height): Card headers and modal titles.
- **Title** (600-700 weight, 0.875rem / 14px, 1.4 line-height): Item titles, table column headers, and form labels.
- **Body** (500 weight, 0.875rem / 14px, 1.5 line-height): Explainer copy, student rosters, and timetable slot descriptions.
- **Label / Handwriting** (700 weight, 0.75rem / 12px, font-mono or font-handwriting): Zine badges, timestamps, step callouts, and tape strip notes.

### Named Rules
**The Explainer Callout Rule.** Step-by-step instructions and badges must use monospace or handwriting fonts with dark high-contrast sticker fills.

## Layout

Spacious grid model using Tailwind spacing (`gap-4`, `gap-6`, `space-y-6`). Responsive 12-column grid layout for desktop admin tools adapting seamlessly to single-column card layouts on mobile devices.

## Elevation & Depth

Surfaces rely on hard offset box shadows (`shadow-zine`: `3px 3px 0px 0px #0f172a`, `shadow-zine-lg`: `5px 5px 0px 0px #0f172a`) rather than blur filters. Interactive elements translate 2px down and right when clicked (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`).

### Shadow Vocabulary
- **Standard Zine Shadow** (`box-shadow: 3px 3px 0px 0px #0f172a`): Default elevation for cards and navigation buttons.
- **Large Zine Shadow** (`box-shadow: 5px 5px 0px 0px #0f172a`): Hover elevation and primary action buttons.
- **Small Zine Shadow** (`box-shadow: 2px 2px 0px 0px #0f172a`): Small sticker badges and dropdown selectors.

### Named Rules
**The Tactile Click Rule.** Buttons and interactive cards must physically shift down and right on active click to flatten their hard offset shadow completely.

## Shapes

- **Card Radius:** 12px (`rounded-xl`) with `2px solid #0f172a` ink border.
- **Control Radius:** 12px (`rounded-xl`) for buttons, inputs, and selectors.
- **Pill Radius:** Full round (`rounded-full`) for status indicators and active role tags.
- **Tape Overlay:** Taped edges (`.zine-tape-top`, `.zine-tape-corner`) using dashed rotated paper overlays.

## Components

### Buttons
- **Shape:** 12px radius (`rounded-xl`), 2px solid `#0f172a` border.
- **Primary:** `bg-yellow-300 text-slate-900 font-extrabold px-4 py-2.5 shadow-zine-interactive`.
- **Secondary:** `bg-white text-slate-900 font-bold border-2 border-slate-900 hover:bg-slate-100`.
- **Click Feedback:** Physical offset shift (`active:translate-x-[2px] active:translate-y-[2px] active:shadow-none`).

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`).
- **Background:** White (`#ffffff`), Warm Yellow (`#fef9c3`), Sky (`#e0f2fe`), Mint (`#dcfce7`), or Pink (`#fce7f3`).
- **Border:** 2px solid charcoal ink (`#0f172a`).
- **Shadow:** `3px 3px 0px 0px #0f172a`.
- **Internal Padding:** 16px to 24px (`p-4` to `p-6`).

### Inputs / Selectors
- **Style:** White background (`#ffffff`), 2px solid `#0f172a` border, 12px radius (`rounded-xl`), font-bold.
- **Focus:** Sharp border stability with dark zine shadow offset.

### Navigation
- **Sidebar & Header:** Crisp white background with `2px solid #0f172a` divider borders and yellow active tab highlights.

## Do's and Don'ts

### Do:
- **Do** use `2px solid #0f172a` ink borders around cards, tables, inputs, and buttons.
- **Do** use tactile pastel highlighter fills (`bg-yellow-200`, `bg-sky-200`, `bg-mint-200`, `bg-pink-200`) for step callouts and category cards.
- **Do** maintain high text-to-background contrast and explicit step labels ("1. Control Access", "2. Classrooms", etc.).

### Don't:
- **Don't** use soft ambient blur drop shadows or glassy dark backdrop filters.
- **Don't** use neon glowing gradients or pitch-black dark mode backgrounds.
- **Don't** cram low-level backend telemetry (FastAPI, MongoDB, bilingual STT sync logs) into user-facing admin views.
