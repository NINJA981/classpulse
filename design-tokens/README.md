# ClassPulse Shared Design Tokens

> **Canonical Brand Source of Truth**: [`DESIGN.md`](../DESIGN.md)  
> **Brand Identity**: Swiss Editorial Brutalist / Monochrome  
> **Scope**: Pure design tokens and atomic utility classes. Contains **zero** out-of-scope components (no ManagementView, ProjectorKiosk, FleetManager, AnalyticsView, or live pulse simulator).

---

## Brand Principles (from DESIGN.md)

1. **One-Ink Rule**: Strictly monochrome (`#111111` ink on `#f6f6f3` canvas). State (success, error, live, active) is expressed via ink borders, fills, weight, and copy — never hue accents (no red, green, blue, yellow fills).
2. **Zero Radius Everywhere**: All cards, buttons, inputs, pills, badges, avatars, and modals have `border-radius: 0;`. The only circular element in the entire product is the 7px status dot (`.cp-dot`).
3. **Hairline Rules**: All borders are `1px` (default `#d7d7d2`, strong `#111111`, soft `#e2e2dd`, faint row dividers `#e8e8e3`).
4. **Hard Offset Shadows**: Shadows are un-blurred hard black offsets (`6px 6px 0 #111111` on card hover, `2px 2px 0 #111111` pressed, `8px 8px 0 #111111` static). The only soft shadow is the modal (`0 20px 60px rgba(0,0,0,0.15)`).
5. **The Eyebrow Rule**: Every section, card, and metric carries a 9px / weight 900 uppercase tracked (`1.8px`) eyebrow (`.cp-eyebrow`) above its title.
6. **Inter-Only Typography**: Weights 400, 700, 800, 900. Monospace, serif, handwriting, or cursive fonts (`Architects Daughter`, `Caveat`, `Kalam`) are strictly prohibited.

---

## Package Contents

| File | Format | Description |
|---|---|---|
| [`classpulse-tokens.css`](./classpulse-tokens.css) | Pure CSS | `:root` custom properties, universal zero-radius reset, and atomic primitives (`.cp-btn-*`, `.cp-card-*`, `.cp-input`, `.cp-eyebrow`, etc.). |
| [`tailwind-theme.css`](./tailwind-theme.css) | CSS (`@theme`) | Tailwind CSS v4 `@theme` block defining colors, fonts, radius, and shadows. |
| [`tailwind.preset.mjs`](./tailwind.preset.mjs) | ESM JS | Tailwind CSS v3 preset module exporting screens, colors, typography, and shadows. |
| [`tailwind.preset.js`](./tailwind.preset.js) | CJS JS | Tailwind CSS v3 CommonJS preset. |
| [`tokens.json`](./tokens.json) | DTCG JSON | Machine-readable design token definitions. |
| [`tokens.js`](./tokens.js) | ESM JS | JavaScript constant exports for runtime code. |
| [`tokens.d.ts`](./tokens.d.ts) | TypeScript | Type declarations for `tokens.js`. |

---

## How to Reference in Sibling Repositories

### 1. Teacher Portal (`SIH-teacher-codex`) — Next.js / Vanilla CSS

In `SIH-teacher-codex/frontend/app/globals.css`, import the shared tokens at the top of the file:

```css
@import "../../../SIH-admin-codex/design-tokens/classpulse-tokens.css";
```

Or copy `classpulse-tokens.css` into `SIH-teacher-codex/frontend/app/` and import directly:

```css
@import "./classpulse-tokens.css";
```

You can now use all CSS variables (e.g. `var(--cp-canvas)`, `var(--cp-ink)`, `var(--cp-border)`) and core atomic utility classes (`cp-eyebrow`, `cp-btn-primary`, `cp-card-interactive`, etc.).

---

### 2. Student Portal (`SIH-student-codex`) — Next.js / Tailwind CSS v4

The student portal uses Tailwind CSS v4 (`@tailwindcss/postcss`). In `SIH-student-codex/student-dashboard/app/globals.css`:

```css
@import "tailwindcss";
@import "../../../SIH-admin-codex/design-tokens/tailwind-theme.css";
@import "../../../SIH-admin-codex/design-tokens/classpulse-tokens.css";
```

Or copy the files locally into the student portal styles directory:

```css
@import "tailwindcss";
@import "./tailwind-theme.css";
@import "./classpulse-tokens.css";
```

This immediately gives Tailwind v4 utilities:
- `bg-canvas`, `text-ink`, `border-line`, `shadow-hard`, etc.
- Overrides all `rounded-*` to `0px`.
- Configures breakpoints (`sm: 560px`, `md: 800px`, `lg: 1100px`, `xl: 1380px`).

---

### 3. Tailwind CSS v3 Projects

In your `tailwind.config.js` or `tailwind.config.mjs`:

```javascript
import classpulsePreset from '../SIH-admin-codex/design-tokens/tailwind.preset.mjs';

export default {
  presets: [classpulsePreset],
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  // ...
};
```
