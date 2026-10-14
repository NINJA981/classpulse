# apps/api

Express 5 + Socket.IO + PostgreSQL (Drizzle) + BullMQ worker. TypeScript, ESM: imports use `.js` extensions. The rules are in `docs/agents/conventions.md` → "API"; follow them.

## Map

- `src/modules/<name>/`: `routes.ts` (parse input, call the service) → `service.ts` (rules, ownership, transactions) → `repo.ts` (shared queries). Routers are mounted in `src/modules/index.ts`.
- `src/db/schema/`: Drizzle tables. `src/db/migrations/`: generated SQL. Don't read or edit `migrations/meta/` (large snapshots).
- `src/pipeline/`: speech-to-text (`sarvam.ts`, `openaiStt.ts`) and LLM (`llm.ts`: always call `chat()`).
- `src/jobs/`: BullMQ queues and workers. `src/sockets/`: live quiz. `src/lib/`: errors, storage, mailer, crypto, logger.
- `src/config/env.ts`: the only place config is read.
- `test/`: Vitest + supertest. Helpers in `test/helpers.ts` (`createWorld()`, `as(user)`, `anon()`).
- API reference: `docs/agents/api.md`. Tables: `docs/agents/database.md`.

## Commands

```bash
npm test -w @classiq/api -- test/<file>.test.ts   # one file; files run one at a time against real Postgres
npm run typecheck -w @classiq/api
npm run db:generate && npm run db:migrate          # after a schema change (commit the SQL and meta it writes)
npm run build -w @classiq/shared                   # first, if you changed packages/shared
```

## Gotchas

- Tests need the dev Postgres (`npm run dev:infra`). They truncate `classpulse_test` before each test, so give a parallel run its own `TEST_DATABASE_URL`.
- `src/lib/keys.ts` `SALT = 'classpulse/v1'` derives encryption keys for stored data. Never change it.
- `modules/live/service.ts` and `modules/platform/authService.ts` contain Windows-1252 dash bytes. Keep the encoding when you edit them.
- Email goes only through `enqueueEmail()`, files only through `lib/storage.ts`, logs through `req.log`/`logger` (no `console.log`).
