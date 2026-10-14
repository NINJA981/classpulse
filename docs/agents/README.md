# ClassIQ

> Copy of the repository root `README.md`, kept here so every document is in `docs/`. Edit the root file and re-copy.


ClassIQ records classroom lectures on a Raspberry Pi. It transcribes them in Indian languages (Sarvam AI), generates bilingual quizzes for the teacher to review (OpenAI), and runs self-paced and live quizzes on students' phones. Teachers also get secure timed exams, assignments with file uploads and AI-suggested grading, and AI teaching tools (lesson plans, worksheets, question papers, presentations) grounded in their own courses and materials. A separate super admin console runs every school on the installation.

**Live:** schools sign in at https://classpulse.benxsolutions.in (`/admin/login`, `/teacher/login`, `/student/login`); the super admin console is at https://ops.benxsolutions.in.

**New here? Read [docs/HANDBOOK.md](HANDBOOK.md)**: the complete guide to every feature, the architecture, the AI pipeline, the hardware, the deployment and operations, with an FAQ and a glossary.

| | |
|---|---|
| `apps/api` | Express 5 + Socket.IO + PostgreSQL (Drizzle) + BullMQ worker |
| `apps/web` | One Next.js 16 app (installable PWA) with the `/admin`, `/teacher` and `/student` areas, their sign-in pages, and the `/platform` super admin console |
| `apps/classroom-agent` | Raspberry Pi 5 recorder agent (Python, standard library only) |
| `packages/shared` | API contracts (zod + TypeScript) shared by the API and the web app |
| `infra/` | Docker Compose (dev and prod), Caddy, backup and restore |
| `docs/` | [Architecture](architecture.md) · [API](api.md) · [Database](database.md) · [Deployment](deployment.md) · [Raspberry Pi hardware](hardware-raspberry-pi.md) · [Pilot runbook](pilot-runbook.md) · [Conventions](conventions.md) · Research: [local models](research/local-models-rnd.md), [STT benchmark](research/stt-benchmark-2026-10-12.md) |

## Local development

Requirements: Node 22+, Docker Desktop and Python 3.11+ (for the agent).

```bash
npm install
npm run dev:infra                         # Postgres 16 + Redis 7 + Garage (S3) in Docker
cp apps/api/.env.example apps/api/.env    # add SARVAM_API_KEY / OPENAI_API_KEY for real generation
cp apps/web/.env.example apps/web/.env.local
npm run build -w @classiq/shared
npm run db:migrate
npm run db:seed                           # demo school + accounts (printed)
npm run dev                               # api :5000, worker, web :3000
```

For the super admin console, set `PLATFORM_ENCRYPTION_KEY` in `apps/api/.env` (`openssl rand -base64 32`), then create an account with `npm run create-superadmin -- --email you@example.com --name "Your Name"` (it prints a one-time password) and sign in at http://localhost:3000/platform/login with an authenticator app. Locally the console shares the app's address; in production it has its own host.

Open http://localhost:3000. The seed prints these demo logins (each role has its own sign-in page: `/admin/login`, `/teacher/login`, `/student/login`):

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

The Playwright specs are `full-flow`, `accounts`, `exams`, `assignments`, `platform`, `teacher-tools` and `student-tour`. `accounts` needs the API started with `E2E_MAIL_CAPTURE=true`; `platform` needs a freshly created super admin (`E2E_PLATFORM_EMAIL` / `E2E_PLATFORM_PASSWORD`). See the spec headers and HANDBOOK §17.

## Production

See [docs/deployment.md](deployment.md). The pilot runs on Coolify on an Oracle Cloud ARM server (`infra/docker-compose.coolify.yml`): an internal Caddy router, web, api, worker, Postgres and Redis, with Coolify's proxy terminating TLS for both hosts. A plain single-VPS Compose stack (`infra/docker-compose.prod.yml`, Caddy with automatic TLS) is also supported. Deploys are manual (Coolify Redeploy or its API); pushing to `main` does not deploy.
