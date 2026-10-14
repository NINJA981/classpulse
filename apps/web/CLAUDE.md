# apps/web

One Next.js 16 App Router app: `/admin`, `/teacher`, `/student`, `/platform`, the public `/about` landing (en, `/hi/about`, `/ta/about`), privacy and terms. The rules are in `docs/agents/conventions.md` → "Web"; follow them.

@AGENTS.md

## Map

- `app/<area>/`: routes. Area layouts already enforce the role and provide `useSessionUser()`. Role sign-in pages are `app/login/{role}`, rewritten by `proxy.ts`.
- `components/ui/`: the primitives to use (Button, Field, Card, Dialog, Table, EmptyState, …). `components/<area>/`: per-area components.
- `components/landing/`: the live landing page (copy in `landing/i18n/{en,hi,ta}.ts`, 3D scene in `landing/scene/`). Changes to `components/landing-variants/` and `app/about/{variants,lecture-hall,playground,broadsheet}` are experiments; touch them only when the task is about them.
- `lib/api.ts` (`api` + TanStack Query), `lib/socket.ts` (`connectSocket`, `emitWithAck`). Types come from `@classiq/shared`.
- `e2e/`: Playwright specs (accessible names only). `scripts/capture-landing-assets.ts`: regenerates `public/landing/{screens,posters,video}`.

## Commands

```bash
npm run typecheck -w @classiq/web
npx playwright test e2e/<spec>.spec.ts            # from apps/web, against a running `npm run dev`
npx tsx scripts/capture-landing-assets.ts screens # after UI changes that show in the landing screenshots
```

## Gotchas

- The dev server on :3000 is often shared with other sessions: check it answers before starting one, and don't restart one you didn't start.
- `next build` fetches Google Fonts; a network blip fails the build, so retry before debugging.
- `next-env.d.ts` gets rewritten by `next dev`/`next build`; don't commit that churn.
- Tailwind design tokens only: no raw hex colours or inline theme styles.
