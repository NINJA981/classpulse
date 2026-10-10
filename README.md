# ClassPulse

ClassPulse records classroom lectures on a Raspberry Pi. It transcribes them in Indian languages (Sarvam AI), generates bilingual quizzes for the teacher to review (OpenAI), and runs self-paced and live quizzes on students' phones.

| | |
|---|---|
| `apps/api` | Express 5 + Socket.IO + PostgreSQL (Drizzle) + BullMQ worker |
| `apps/web` | One Next.js 16 app with the `/admin`, `/teacher` and `/student` areas |
| `apps/classroom-agent` | Raspberry Pi 5 recorder agent (Python, standard library only) |
| `packages/shared` | API contracts (zod + TypeScript) shared by the API and the web app |
| `infra/` | Docker Compose (dev and prod), Caddy, backup and restore |
| `docs/` | [Architecture](docs/architecture.md) · [API](docs/api.md) · [Database](docs/database.md) · [Deployment](docs/deployment.md) · [Raspberry Pi hardware](docs/hardware-raspberry-pi.md) · [Pilot runbook](docs/pilot-runbook.md) · [Conventions](docs/conventions.md) |

## Local development

Requirements: Node 22+, Docker Desktop and Python 3.11+ (for the agent).

```bash
npm install
npm run dev:infra                         # Postgres 16 + Redis 7 in Docker
cp apps/api/.env.example apps/api/.env    # add SARVAM_API_KEY / OPENAI_API_KEY for real generation
cp apps/web/.env.example apps/web/.env.local
npm run build -w @classpulse/shared
npm run db:migrate
npm run db:seed                           # demo school + accounts (printed)
npm run dev                               # api :5000, worker, web :3000
```

Open http://localhost:3000. The seed prints these demo logins:

| Role | Login | Password |
|---|---|---|
| Admin | `admin@demo.school` | `Admin@12345` |
| Teacher | `anita@demo.school` | `Teacher@12345` |
| Student | roll `10A-01` | `Student@12345` |

## Quality gates

```bash
npm run lint && npm run typecheck
npm test                    # API integration tests (needs the dev Postgres)
npm run test:agent          # Raspberry Pi agent tests
npm run test:e2e            # Playwright end-to-end tests (needs `npm run dev` running)
```

## Production

See [docs/deployment.md](docs/deployment.md). Production runs as a single-VPS Docker Compose stack: Caddy (automatic TLS), web, api, worker, Postgres and Redis.
