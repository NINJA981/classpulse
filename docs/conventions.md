# Engineering conventions

## Repository layout

```
apps/api              Express 5 API, Socket.IO and BullMQ worker (TypeScript, ESM, NodeNext)
apps/web              One Next.js 16 App Router app serving /admin, /teacher and /student
apps/classroom-agent  Raspberry Pi agent (Python 3, standard library only)
packages/shared       zod schemas and TypeScript types shared by the API and the web app
infra/                Docker Compose files, Caddy config, backup and restore scripts
docs/                 Architecture, API, database, deployment, hardware and runbook docs
legacy/               Read-only source of the old apps, kept for reference during the port. Never import from it.
```

## API (`apps/api`)

- **Module layout.** Each domain lives in `src/modules/<name>/` and contains:
  - `routes.ts`: thin handlers. Each one parses input, calls the service and sends the response. Each router applies its own `authenticate()` and `requireRole()`.
  - `service.ts`: business rules, authorization and ownership checks, and transactions.
  - `repo.ts` (optional): Drizzle queries reused by several services.
- **Input validation.** Parse every input with `parseBody`, `parseParams` or `parseQuery` from `middleware/validate.ts`, using schemas from `@classpulse/shared` or schemas local to the module. Never read `req.body` or `req.query` fields directly.
- **Errors.** Throw `AppError` and its helpers (`notFound`, `forbidden`, `conflict`, `invalidState`, `badRequest`) from `lib/errors.ts`. Never send `err.message` from an unknown error. Express 5 forwards rejected promises to `errorHandler`, so you don't need `try/catch` just to forward errors.
- **Database.** Use `db` from `db/client.ts`. Wrap any write that touches more than one table in `db.transaction(async (tx) => …)`. Use `.returning()` instead of re-reading rows. Do joins and aggregates in SQL, not JavaScript loops, and avoid N+1 queries.
- **Responses.** Map database rows to the shared DTO types in a `toXxx()` function. Never send raw rows, password hashes or key hashes.
- **Files.** Go through `lib/storage.ts` and refer to files by key. Never build filesystem paths from request data.
- **Logging.** Use `req.log` inside requests and `logger` everywhere else. Don't log secrets or student personal data. Never use `console.log`.
- **Configuration.** Read config only from `env` in `config/env.ts`.
- **Tests.**
  - Write Vitest and supertest tests in `apps/api/test/**/*.test.ts`, using the helpers in `test/helpers.ts`: `createWorld()`, `as(user)` and `anon()`.
  - Tests run against a real Postgres database (`classpulse_test`), which is truncated before each test.
  - Cover the happy path, the RBAC failures (401 and 403) and the main validation failures for every route.
- **Typing.** No `any`. Use ESM imports with `.js` extensions.

## Web (`apps/web`)

- **Calling the API.** Use only `api` from `@/lib/api` together with TanStack Query: `useQuery` for reads and `useMutation` for writes, then invalidate the affected query keys.
- **Query keys** are arrays that start with the resource name, e.g. `['lessons', id]` or `['admin', 'sections']`.
- **Types** come from `@classpulse/shared`. Never redefine a DTO type locally.
- **UI building blocks.**
  - Use the primitives in `@/components/ui`: Button, ButtonLink, Field, Input, Select, Textarea, Checkbox, Card, CardHeader, CardBody, StatCard, Badge, StatusDot, Table/THead/TBody/TR/TH/TD, Dialog, Tabs, useToast, LoadingBlock, Skeleton, EmptyState, ErrorState, InlineError, Spinner and PageHeader.
  - Put components shared by one area in `components/<area>/`.
- **Styling.** Use Tailwind utilities with the design tokens only (`bg-surface`, `text-ink`, `text-muted`, `border-line`, `bg-accent text-accent-ink`, `rounded-card`, `rounded-control`, `shadow-card`, `font-display` and so on). Never write raw hex colours, inline `style={{}}` for theming, or new global CSS classes.
- **Page states.** Every data-driven page handles loading (`LoadingBlock`/`Skeleton`), errors (`ErrorState` with a retry), and empty data (`EmptyState` with a clear next action).
- **Accessibility.**
  - Every input has a `Field` label.
  - Buttons say what they do.
  - Icon-only buttons have an `aria-label`.
  - Quiz options are real `<button>`s or radio inputs and can be used from the keyboard.
- **Route segments.** Pages are client components (`'use client'`) unless they are purely static. Area layouts already enforce the role and provide `useSessionUser()`.
- **Live features.** Use `connectSocket()` and `emitWithAck()` from `@/lib/socket`, with the event names and types from `@classpulse/shared` (`ClientToServerEvents` and `ServerToClientEvents`).
- **No mock data.** If the backend doesn't support something, leave it out.
