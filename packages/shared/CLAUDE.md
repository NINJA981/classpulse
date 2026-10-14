# packages/shared

zod schemas and TypeScript DTO types shared by `apps/api` and `apps/web` (`@classiq/shared`). One file per domain in `src/` (`lessons.ts`, `exams.ts`, `live.ts`, `platform*.ts`, …), all re-exported from `src/index.ts`.

- After any change, rebuild it: `npm run build -w @classiq/shared`. The api and web resolve the built `dist/`, so they won't see your edit until then. `npm run dev` watches it.
- Change a contract here first, then the API mapper (`toXxx()`), then the web caller. Never redefine a DTO locally in api or web.
- Socket event names and payloads live in `src/live.ts` (`ClientToServerEvents`, `ServerToClientEvents`).
