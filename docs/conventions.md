# Engineering conventions

## Repository layout

```
apps/api              Express 5 API, Socket.IO and BullMQ worker (TypeScript, ESM, NodeNext)
apps/web              One Next.js 16 App Router app serving /admin, /teacher, /student and /platform
apps/classroom-agent  Raspberry Pi agent (Python 3, standard library only)
packages/shared       zod schemas and TypeScript types shared by the API and the web app
infra/                Docker Compose files, Caddy config, backup and restore scripts
docs/                 Handbook, architecture, API, database, deployment, hardware and runbook docs
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
- **Feature switches.** A router (or route) for a feature the platform can switch off per school applies `requireFeature('<feature>')` from `middleware/requireFeature.ts` (exams, assignments, liveQuiz, devices, emailInvites, aiGrading, teacherTools). Mount-level gating is done with `gated()` in `modules/index.ts`. Never gate the device-key router (`/api/devices`).
- **Platform routes.** Everything under `/api/platform/*` is behind `authenticatePlatform()`; school sessions must never pass. Record every platform action, and school-admin user management, with `audit(req, { action, … })` from `lib/audit.ts` (it never throws; never put secrets in `metadata`).
- **AI calls.**
  - Call OpenAI-compatible chat models only through `chat()` in `pipeline/llm.ts`. Pass the optional usage context (`{ institutionId, lessonId?, kind }`) so the call is recorded in `ai_usage`, and cap output with `maxOutputTokens(model)`.
  - Structured output follows the generator pattern in `modules/resources/generators/common.ts` (`generateStructured`): strict JSON schema, zod validation, one repair round, then deterministic fixes. Never substitute demo content in production.
  - Keep AI features provider-agnostic: no vendor-only features, so a self-hosted OpenAI-compatible endpoint can replace the API later.
- **Queues.** Background work goes through BullMQ (`lesson-generation`, `email`, `resources`), with an in-process fallback when Redis is not configured. Send email only through `enqueueEmail()`; never call the mailer directly.
- **Tests.**
  - Write Vitest and supertest tests in `apps/api/test/**/*.test.ts`, using the helpers in `test/helpers.ts`: `createWorld()`, `as(user)` and `anon()`.
  - Tests run against a real Postgres database (`classpulse_test`, or `TEST_DATABASE_URL` so parallel runs don't collide), which is truncated before each test.
  - Tests never inherit developer-only switches from `apps/api/.env` (`vitest.config.ts` pins them, e.g. `E2E_MAIL_CAPTURE=false`).
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
  - Dialogs use `Dialog`, which names itself from its title (`aria-labelledby`); tests find dialogs by that name.
  - Buttons say what they do.
  - Icon-only buttons have an `aria-label`.
  - Quiz options are real `<button>`s or radio inputs and can be used from the keyboard.
- **Route segments.** Pages are client components (`'use client'`) unless they are purely static. Area layouts already enforce the role and provide `useSessionUser()`.
- **Live features.** Use `connectSocket()` and `emitWithAck()` from `@/lib/socket`, with the event names and types from `@classpulse/shared` (`ClientToServerEvents` and `ServerToClientEvents`).
- **Sign-in pages.** Each role has its own page (`/admin/login`, `/teacher/login`, `/student/login`, served from `app/login/{role}` through `proxy.ts`), and the console has `/platform/login`. All of them share the same card design (`components/auth/role-login.tsx`).
- **Teaching-resource types.** Each type plugs into two registries: the API generator and exporter (`modules/resources/generators`, `modules/resources/exporters`) and the web viewer and options form (`components/teacher/resources/types`, exporting `Viewer` and `OptionsFields`).
- **Guided tours.** Use the reusable module in `components/tour` and anchor steps with `data-tour="..."` attributes. Nav links already carry `data-tour="nav-<path>"`.
- **End-to-end tests.** Playwright specs live in `apps/web/e2e` and use accessible names (`getByRole`, `getByLabel`), never CSS selectors. They must run against both a single-origin dev stack and production's separate hosts (`E2E_BASE_URL`, `E2E_SCHOOL_URL`).
- **No mock data.** If the backend doesn't support something, leave it out.
