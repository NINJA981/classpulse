---
name: ClassPulse HyperCard Stack Shoebox Design System
description: Retro Apple HyperCard Shoebox Index Card UI for smart classroom administration
colors:
  primary: "#000000"
  accent-yellow: "#fffbeb"
  accent-sky: "#f0f9ff"
  accent-mint: "#f0fdf4"
  accent-pink: "#fff1f2"
  neutral-bg: "#eae5d9"
  surface: "#ffffff"
  surface-muted: "#f7f4ed"
  border-ink: "#000000"
  text-primary: "#000000"
  text-secondary: "#333333"
  text-muted: "#666666"
  success: "#15803d"
  danger: "#b91c1c"
typography:
  display:
    fontFamily: "Space Mono, VT323, monospace"
    fontSize: "clamp(1.5rem, 3vw, 2.25rem)"
    fontWeight: 700
    lineHeight: "1.2"
  body:
    fontFamily: "JetBrains Mono, Plus Jakarta Sans, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.5"
  pixel:
    fontFamily: "VT323, Silkscreen, monospace"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: "1.2"
  label:
    fontFamily: "Space Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-muted}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
---

# Design System: ClassPulse HyperCard Stack Shoebox

## Overview

**Creative North Star: "HyperCard Stack v2.0 Shoebox Index"**

ClassPulse adopts a classic **Apple HyperCard (1987) Shoebox Index Stack UI** for smart classroom administration. Moving away from generic modern dashboards, ClassPulse presents admin controls as an intuitive, tactile retro Macintosh index card stack (`#eae5d9` desktop canvas, `3px solid #000000` black ink container outlines, `4px 4px 0px 0px #000000` stacked card shadows, retro Macintosh window title bar stripes, and card stack pagination controls).

**Key Characteristics:**
- **Macintosh Desktop Canvas**: `#eae5d9` warm dithered desktop canvas with subtle radial grid dots.
- **Stark Black Ink Outlines**: High-contrast `2px` to `3px` solid `#000000` borders on every card, button, input, and tab.
- **HyperCard Stack Shadows**: Layered solid 4px offset box shadows (`#000000`) representing physical index card depth in a shoebox stack.
- **Shoebox Index Tabs**: Overlapping card tabs (`Card 1: Control Access`, `Card 2: Classrooms`, `Card 3: Teachers`, `Card 4: Students`, `Card 5: Assign Teachers`, `Card 6: Assign Students`, `Card 7: Timetables`).
- **Retro Monospace Typography**: Google Fonts `VT323`, `Silkscreen`, `Space Mono`, and `JetBrains Mono`.

## Colors

The palette uses a warm Macintosh desktop canvas (`#eae5d9`) with solid black ink borders and subtle vintage index card tints.

### Primary
- **Black Ink** (#000000): Used for title bars, card outlines, offset shadows, and high-contrast headlines.

### Index Card Tints
- **Card Yellow** (#fffbeb): Primary header callouts, active tab highlights, and timetable schedule forms.
- **Card Sky** (#f0f9ff): Teacher lead assignment tool and active stack pills.
- **Card Mint** (#f0fdf4): Student roster assignment tool and active user account indicators.
- **Card Pink** (#fff1f2): Deletion confirmation modal and warning cards.

### Neutral
- **Desktop Canvas** (#eae5d9): Main desktop canvas.
- **Card Surface** (#ffffff): White index card face.
- **Stack Surface** (#f7f4ed): Off-white stack card container.
- **Title Bar** (#d5cfbf): Macintosh window title bar fill.

## Components

### Card Stack Navigation
- **Stack Header**: Macintosh window title bar with dithered lines and `CARD 1 OF 7` indicator.
- **Pagination**: `◀ Prev Card` and `Next Card ▶` buttons to step through index cards.
- **Index Tabs**: Overlapping card tabs pinned to the top of the shoebox stack.

### Buttons & Inputs
- **Buttons**: 2px solid `#000000` border, `3px 3px 0px 0px #000000` drop shadow, tactile click translation (`active:translate-x-[2px] active:translate-y-[2px]`).
- **Inputs & Selectors**: White fill, 2px solid `#000000` border, retro monospace font.
