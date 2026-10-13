# ClassPulse — The Complete Handbook

> **Who this is for:** the owner of ClassPulse, who needs to understand and explain every part of the product: what it does, how it is built, how it is deployed, and why it was built that way. It assumes no prior technical knowledge. Each technical term is explained the first time it appears, and there is a [Glossary](#21-glossary) at the end.
>
> **How to use it:**
> - **Specific question:** jump to the [FAQ](#20-faq--questions-you-may-be-asked) first, then to the section it points to.
> - **Full picture:** read sections 1–3 in order.
> - **Running the service as its owner** (adding schools, switching features off, watching costs, logs and health): go to [section 15.5, the platform console guide](#155-the-platform-console-owners-guide).
>
> **Secrets are deliberately not in this file.** That covers passwords, API keys and private keys, because this repository is stored on GitHub. Section 14.8 says where each secret lives.
>
> **Last updated:** 12 October 2026 (live state after commit `34ead36`: real `benxsolutions.in` addresses, email switched on, the console's Coolify connection, the console's light design, the backup-status fix, the student first-login tour, and the local speech-to-text benchmark).

---

## Table of contents

1. [What ClassPulse is](#1-what-classpulse-is)
2. [The big picture: how the pieces fit together](#2-the-big-picture-how-the-pieces-fit-together)
3. [Technology stack (and why each piece was chosen)](#3-technology-stack-and-why-each-piece-was-chosen)
4. [A tour of the code repository](#4-a-tour-of-the-code-repository)
5. [Schools, users, roles and signing in](#5-schools-users-roles-and-signing-in)
6. [Every feature, page by page](#6-every-feature-page-by-page)
7. [The life of a lesson (statuses)](#7-the-life-of-a-lesson-statuses)
8. [The AI pipeline in depth](#8-the-ai-pipeline-in-depth)
9. [The live quiz engine](#9-the-live-quiz-engine)
10. [The Raspberry Pi classroom recorder](#10-the-raspberry-pi-classroom-recorder)
11. [The database](#11-the-database)
12. [The API (how the website talks to the server)](#12-the-api-how-the-website-talks-to-the-server)
13. [Security and privacy](#13-security-and-privacy)
14. [Deployment and infrastructure (production)](#14-deployment-and-infrastructure-production)
15. [Day-to-day operations](#15-day-to-day-operations)
16. [Running it on your own computer (development)](#16-running-it-on-your-own-computer-development)
17. [Testing and quality: what was verified](#17-testing-and-quality-what-was-verified)
18. [Project history and key decisions](#18-project-history-and-key-decisions)
19. [Known limitations and future work](#19-known-limitations-and-future-work)
20. [FAQ: questions you may be asked](#20-faq--questions-you-may-be-asked)
21. [Glossary](#21-glossary)
22. [Quick reference card](#22-quick-reference-card)

---

## 1. What ClassPulse is

### 1.1 One-sentence pitch
ClassPulse records a classroom lecture, uses AI to turn it into a quiz in the teacher's language, lets the teacher review and publish it, and lets students take it on their phones, either self-paced or as a live, game-show-style quiz in class.

### 1.2 The problem it solves
After a lecture, teachers rarely have time to write good questions that check whether students understood. Many Indian classrooms also mix languages: a teacher may explain in Tamil while using English technical terms. ClassPulse:
- **captures the lecture automatically** with a small Raspberry Pi recorder in the classroom (or the teacher uploads a phone recording),
- **transcribes the speech** into text, including mixed Tamil–English, Hindi–English and other "code-mixed" speech,
- **writes multiple-choice questions** from what was actually said, each linked to the moment in the recording it came from,
- lets the **teacher stay in control**: they choose how many questions and how difficult, then review, edit, approve and publish,
- gives **students** a quiz with explanations, plus a **live quiz** mode for in-class engagement,
- gives teachers **analytics** (which questions the class got wrong) and an **AI remedial plan** (what to re-teach).

### 1.3 Who uses it (the three school roles, plus the owner)
| Role | Who | Where they work | What they do |
|---|---|---|---|
| **Admin** | School office / principal / IT person | `/admin` ("Admin console"); signs in at `/admin/login` | Sets up the school: rooms, classes ("sections"), teachers, students, timetable, classroom devices, AI settings |
| **Teacher** | Subject teachers | `/teacher` ("Teacher studio"); signs in at `/teacher/login` | Records or uploads lectures, generates and reviews quizzes, runs live quizzes, sets secure exams and assignments, uses the AI teaching tools (lesson plans, worksheets, question papers, presentations), views analytics |
| **Student** | Students (mostly on phones) | `/student` ("Student portal"); signs in at `/student/login` | Joins classes with a code, takes quizzes and exams, plays live quizzes, hands in assignments (text, photos, files), manages guardian contacts |
| **Super admin** (platform operator) | The owner of ClassPulse (you), not a school | `/platform` ("Platform console"), on its own address | Adds schools and their admins, suspends schools, switches features off per school, sets limits, watches health, logs, costs and deployments (section 15.5) |

One installation can serve **many schools** ("multi-tenant"). Each school's data is completely separate. Super admins sit above all schools and are not part of any school.

### 1.4 Current status (October 2026)
- **Stage:** ready for a **pilot**, meaning a first real-world trial with about 100 users at one school.
- **Live at:** `https://classpulse.benxsolutions.in` (the school site for admins, teachers and students).
- **Platform console:** `https://ops.benxsolutions.in` (it opens `/platform`).
- **Coolify dashboard:** `https://coolify.benxsolutions.in`.
- The old temporary `…sslip.io` addresses are retired and no longer work (section 14.3).
- **Servers:** a single cloud server (Oracle Cloud), managed with **Coolify**.
- **Email:** switched on. Invitations, password resets and reminders are sent from `admin@benxsolutions.in` (section 14.5).
- **Accounts:**
  - `admin@benxsolutions.in` for "BenX Pilot School" (code `BENX`)
  - `admin2@benxsolutions.in` for "BenX School 2" (code `BENX2`)
  - a test school, "E2E Test School" (code `E2ETEST`), used by automated tests
  - the owner's super admin account for the console, `saicharan312008@gmail.com`, created on the server with `create-superadmin` (section 15.5.1)

---

## 2. The big picture: how the pieces fit together

### 2.1 The parts
```
                    ┌──────────────────────── The cloud server (Oracle, Ubuntu) ───────────────────────┐
 Browsers ─HTTPS──▶ │ Traefik (Coolify's gatekeeper, TLS) ─▶ Router (Caddy) ─┬─▶ Web app (Next.js)   │
 (admin, teacher,   │                                                         └─▶ API (Express)        │
  students, phones) │                                                               │   ▲              │
                    │                                   PostgreSQL (database) ◀─────┤   │ Redis        │
 Raspberry Pi ─HTTPS▶│                                   Audio storage (disk)  ◀─────┤   │ (queue)      │
 (classroom)        │                                                               ▼   │              │
                    │                                              Worker (background jobs) ──▶ Sarvam AI (speech→text)
                    │                                                                         ──▶ OpenAI (quiz writing)
                    └────────────────────────────────────────────────────────────────────────────────────┘
```

| Part | Plain-English role | Code location |
|---|---|---|
| **Web app** | What people see in their browser: the pages, buttons and forms | `apps/web` |
| **API** | The "brain" on the server. Every action (log in, save a question, start a quiz) is a request to the API, which checks permissions and reads/writes the database | `apps/api` |
| **Worker** | A background helper that does slow jobs so the website stays fast. It works through three queues: `lesson-generation` (transcription and quiz writing), `email` (invitations, password resets, reminders) and `resources` (lesson plans, worksheets, question papers, presentations). It also runs timed housekeeping such as closing finished exams and deleting old logs | `apps/api/src/worker.ts` (same code as the API, different program) |
| **PostgreSQL** | The database: where all users, classes, lessons, questions and results are stored permanently | Docker container `postgres` |
| **Redis** | A fast in-memory store used as the **job queue** (the list of jobs waiting for the worker), for login rate limiting, and for passing messages from the worker to the API | Docker container `redis` |
| **Storage** | A folder on the server's disk holding the lecture audio files | Docker volume `storage-data` |
| **Router (Caddy)** | Sends `/api/...` and `/socket.io/...` requests to the API and everything else to the web app. It also keeps the platform console on its own address: on a school address `/platform` answers "Not found", and the console address serves nothing but the console | `infra/Caddyfile.coolify` |
| **Email** (optional) | Sends invitation and password-reset links and assignment reminders, through a normal mailbox (Gmail or GoDaddy) | `apps/api/src/lib/mailer.ts` |
| **Traefik** | Coolify's front door: handles HTTPS certificates and forwards traffic to the router | Managed by Coolify |
| **Classroom agent** | A small Python program on the Raspberry Pi that records audio and uploads it | `apps/classroom-agent` |
| **Shared contracts** | One shared definition of every data shape (what a "lesson" looks like, etc.) used by both the web app and the API so they never disagree | `packages/shared` |

### 2.2 What happens when someone clicks something
Example: a teacher clicks **Approve** on a question.
1. The browser sends `POST /api/questions/<id>/approve` with the teacher's login cookie.
2. Traefik receives it over HTTPS and passes it to the Caddy router. The router sees `/api/` and forwards it to the API.
3. The API reads the cookie, confirms who the teacher is, checks that they own this lesson, and updates the question in PostgreSQL.
4. The API replies with the updated question. The web app updates the screen.

### 2.3 What happens to a lecture (end to end)
1. **Capture:** the Pi records (or the teacher uploads a file).
2. **Transcribe** (automatic): the worker sends the audio to Sarvam AI, which returns the text with timestamps. The lesson shows **"Ready for quiz"**.
3. **Generate** (the teacher decides): the teacher picks the number of questions (1–30) and the difficulty, then clicks **Generate quiz**. The worker asks OpenAI to write the questions, a summary and an assignment.
4. **Review:** the teacher approves, edits or rejects questions, and can add more or replace some.
5. **Publish:** students in that class can now take the quiz.
6. **Live (optional):** the teacher runs it as a live game on the projector; students answer on their phones.
7. **Analytics:** the teacher sees results and can ask the AI for a re-teaching plan.

---

## 3. Technology stack (and why each piece was chosen)

### 3.1 Summary table
| Layer | Technology | Version | Why it was chosen |
|---|---|---|---|
| Language (web + server) | **TypeScript** | 6.0 | JavaScript with type checking, which catches many bugs before the code runs. One language for frontend and backend. |
| Runtime | **Node.js** | 22 LTS | Runs TypeScript/JavaScript on the server. LTS means long-term support (stable, security-patched). |
| Web framework (frontend) | **Next.js** (App Router) | 16.4 | Industry-standard React framework: page routing, server-side session checks, a fast production build. |
| UI library | **React** | 19.3 | The component model behind Next.js. |
| Styling | **Tailwind CSS** | 4.3 | Utility-class styling with a shared set of design "tokens" (colours, spacing), so every page looks consistent. |
| Data fetching (frontend) | **TanStack Query** | 5 | Caches server data, refreshes it, and handles loading/error states. |
| Charts | **Recharts** | 3 | Bar charts on the admin and analytics pages. |
| Icons | **lucide-react** | 1.x | Clean open-source icon set. |
| API framework (backend) | **Express** | 5.3 | The most widely used Node.js web server framework. Version 5 handles errors in async code automatically. |
| Validation | **zod** | 4 | Defines the exact shape of every input. Anything malformed is rejected before it reaches the database. Shared by frontend and backend. |
| Database | **PostgreSQL** | 16 | Reliable, mature relational database; good for structured school data. |
| Database toolkit (ORM) | **Drizzle ORM** | 0.45 | Type-safe database queries and **migrations** (versioned database changes). Chosen over Prisma for being lightweight and close to SQL. |
| Job queue | **BullMQ** on **Redis** | 6 / Redis 7 | Reliable background jobs with automatic retries, so a slow AI call never blocks the website. |
| Real-time | **Socket.IO** | 4.8 | Two-way live connection between the server and phones for the live quiz. |
| Logging | **pino** | 10 | Fast structured (JSON) logs, with automatic hiding of secrets. |
| Security headers | **helmet** | 8 | Sets protective HTTP headers. |
| File uploads | **multer** | 2.4 | Receives large audio uploads, streamed to disk. |
| Passwords | **bcryptjs** | 3 | Industry-standard password hashing. |
| Sessions | **jsonwebtoken** (JWT) | 9 | A signed login token stored in a secure cookie. |
| Audio processing | **ffmpeg** | system package | Converts any uploaded audio to a standard format (16 kHz mono WAV) and measures its length. |
| Email | **nodemailer** | 7 | Sends email through an ordinary mailbox over SMTP (Gmail or GoDaddy). |
| Word / PowerPoint export | **docx**, **pptxgenjs** | 9 / 4 | Build the `.docx` and `.pptx` files teachers download from the AI teaching tools. |
| Reading uploads | **unpdf**, **mammoth** | 1 / 1 | Pull the text out of teachers' PDF and Word materials so the AI can use them. |
| Two-factor sign-in | Built-in TOTP (the standard behind authenticator apps) | — | Super admins confirm each sign-in with a 6-digit code from an authenticator app. No extra service is needed. |
| Installable app | Web app manifest + a small service worker | — | Lets phones and computers install ClassPulse like an app, with an offline page. |
| Speech-to-text | **Sarvam AI** (`saaras:v3`, `saarika:v2.5`) or **OpenAI Whisper** | API | Sarvam is built for Indian languages and handles code-mixed speech; Whisper is the alternative. |
| Quiz writing (LLM) | **OpenAI** (`gpt-4.1-mini` default; `gpt-4o-mini`, `gpt-4.1`, `gpt-4o`, `gpt-5-mini`) | API | Strong at following a strict output format ("structured outputs"). |
| Device software | **Python 3** (standard library only) | 3.11+ | Runs on the Raspberry Pi with nothing extra to install. |
| Containers | **Docker** + **Docker Compose** | 29 / v5 | Packages each part with everything it needs; the same setup runs anywhere. |
| Hosting control panel | **Coolify** | 4.4.3 | Self-hosted "Heroku-like" panel: deploys from GitHub, manages domains, HTTPS and environment variables. |
| Reverse proxy | **Traefik** (by Coolify) + **Caddy** (our router) | 3.6 / 2 | Traefik handles HTTPS; Caddy routes requests to the API or web app. |
| Cloud server | **Oracle Cloud** VM (ARM64) | Ubuntu 24.04 | 2 CPUs, about 12 GB RAM, 193 GB disk. |
| Backups | **pg_dump** + **age** encryption + **systemd timer** | — | Nightly encrypted backups of the database and audio. |
| Tests | **Vitest** + **supertest** (API), **pytest** (Pi agent), **Playwright** (browser) | — | Automated checks (section 17). |
| Code quality | **ESLint**, **Prettier** | 10 / 3 | Consistent, error-checked code style. |
| CI | **GitHub Actions** | — | Runs checks automatically on every push. |

### 3.2 Why a "monorepo"
All code (web, API, Pi agent, shared definitions) lives in **one repository** organised with **npm workspaces**. This means:
- one place to change things; the web app and API always match because they import the same `packages/shared` definitions,
- one command runs everything (`npm run dev`), one command tests everything.

Before October 2026 there were **four separate repositories** (`SIH-backend`, `SIH-admin`, `SIH-teacher`, `SIH-student`) plus a separate agent folder. They were merged, and their history was kept in git (section 18).

### 3.3 Why PostgreSQL instead of MongoDB
The original backend used MongoDB. It was replaced with PostgreSQL because:
- school data is **relational**: students belong to sections, which have teachers, lessons, questions and attempts. PostgreSQL enforces those links (for example, you can't delete a teacher who still owns lessons).
- **transactions**: multi-step changes, like "generate a quiz, replace the questions, update the summary", either fully succeed or fully roll back.
- **constraints**: uniqueness rules such as "one roll number per school" and "one active PIN per live quiz" are enforced by the database itself.

### 3.4 Why a separate worker
Transcribing a 25-minute lecture takes about 30–60 seconds, and writing a quiz about 10–40 seconds. If the API did this itself, it would be tied up while waiting. Instead the API puts a **job** in the Redis queue and replies immediately ("queued"). The worker picks the job up, does the slow work, and reports progress back. If the worker crashes or restarts, the job is **retried automatically**, up to 3 attempts.

The same applies to email (5 attempts per message) and to the teacher AI tools (2 attempts per generation). Failed jobs from any of the three queues can be retried from the platform console's Health page.

---

## 4. A tour of the code repository

```
BenX/                                   ← repository root (GitHub: NINJA981/classpulse, private)
├── apps/
│   ├── api/                            ← server: API + worker
│   │   ├── src/
│   │   │   ├── server.ts               ← starts the API (HTTP + Socket.IO)
│   │   │   ├── worker.ts               ← starts the background worker
│   │   │   ├── app.ts                  ← Express setup: security headers, logging, routes
│   │   │   ├── config/env.ts           ← reads + validates environment variables (settings)
│   │   │   ├── db/
│   │   │   │   ├── schema/*.ts         ← database table definitions
│   │   │   │   ├── migrations/*.sql    ← database change history (0000_init … 0004_teacher_tools)
│   │   │   │   ├── migrate.ts          ← applies migrations
│   │   │   │   └── seed.dev.ts         ← demo data for local development only
│   │   │   ├── modules/<feature>/      ← one folder per feature: routes.ts (URLs) + service.ts (rules)
│   │   │   │                             (incl. platform/, exams/, assignments/, curriculum/, resources/)
│   │   │   ├── middleware/             ← login check, role check, validation, rate limits, errors
│   │   │   ├── pipeline/               ← AI: sarvam.ts, openaiStt.ts, llm.ts, providers.ts
│   │   │   ├── jobs/                   ← queue, worker logic, audio retention, periodic tasks
│   │   │   ├── sockets/                ← live quiz real-time engine
│   │   │   ├── realtime/notify.ts      ← pushes progress from worker → teacher's browser
│   │   │   ├── lib/                    ← helpers: crypto, storage, ffmpeg, logger, errors, mailer, totp, aiUsage
│   │   │   └── scripts/                ← createAdmin.ts (school admin), createSuperAdmin.ts (console account)
│   │   ├── scripts/loadtest-live.mjs   ← 100-student live quiz load test
│   │   ├── test/*.test.ts              ← 32 automated test files (410 tests)
│   │   └── Dockerfile                  ← how the API/worker container image is built
│   ├── web/                            ← the website (Next.js)
│   │   ├── app/                        ← pages: /login, /admin/*, /teacher/*, /student/*, /platform/*
│   │   ├── components/                 ← building blocks: ui/ (buttons, tables…), admin/, teacher/, student/,
│   │   │                                 platform/ (the super admin console), auth/ (sign-in pages),
│   │   │                                 tour/ (reusable guided tour; the student tour is in student/tour/)
│   │   ├── lib/                        ← api.ts (talks to API), socket.ts (live), server-session.ts
│   │   ├── public/sw.js, app/manifest.ts ← installable app (PWA) and offline page
│   │   ├── proxy.ts                    ← sends signed-out visitors to the right sign-in page
│   │   ├── e2e/*.spec.ts               ← end-to-end browser tests (full-flow, accounts, exams,
│   │   │                                 assignments, platform, teacher-tools, student-tour)
│   │   └── Dockerfile
│   └── classroom-agent/                ← Raspberry Pi software (Python)
│       ├── agent.py                    ← the recorder/uploader program
│       ├── install.sh                  ← installs it on a Pi
│       ├── classpulse-agent.service    ← makes it run automatically (systemd)
│       ├── agent.example.json          ← example settings file
│       └── tests/test_agent.py         ← 11 automated tests
├── packages/shared/src/                ← shared data definitions (lessons, live quiz, devices, settings, exams,
│                                          assignments, teacher tools, platform…)
├── infra/                              ← deployment files
│   ├── docker-compose.coolify.yml      ← production setup used on Coolify
│   ├── docker-compose.prod.yml         ← alternative: plain single-server setup with its own HTTPS
│   ├── docker-compose.dev.yml          ← local database + Redis for development
│   ├── Caddyfile / Caddyfile.coolify   ← routing rules
│   ├── router.Dockerfile               ← builds the router image
│   ├── backup.sh / restore.sh / lib-docker.sh ← encrypted backups and restore
│   └── .env.example                    ← list of settings for the plain setup
├── docs/                               ← documentation (this handbook + api, architecture, database,
│                                          deployment, hardware, pilot runbook, conventions)
│   └── research/                       ← local (self-hosted) AI research: R&D plan, speech-to-text benchmark
├── .github/workflows/ci.yml            ← automatic checks on GitHub
└── package.json                        ← workspace definition + top-level commands
```

**Not in git** (deliberately ignored): `.env` files (secrets), the SSH key file, sample audio recordings in the root folder, `node_modules` (downloaded libraries), build output.

---

## 5. Schools, users, roles and signing in

### 5.1 Schools (institutions)
- Each school has a **name**, a short unique **code** (for example `BENX`), a **time zone** (default Asia/Kolkata) and an **academic year**.
- Every user, room, section and lesson belongs to exactly one school. All data access is limited to the user's own school.
- A school is created in the **platform console** (Schools → New school), which also creates its first admin (section 15.5.2). The older `createAdmin` command on the server still works (section 15.3).
- Each school also has a **status** (`active` or `suspended`), seven **feature switches** and optional **limits**, all set from the console (section 15.5.3).

### 5.2 Users
All school users live in one table, with a **role**: `admin`, `teacher` or `student`.
- **Staff** (admin, teacher) sign in with **email + password**. Emails are unique across the whole system.
- **Students** sign in with **roll number + password**. Roll numbers are unique within a school; two schools can both have "10A-01".
- Each user has a **status**: `active` or `disabled`. Disabled users cannot sign in, and their existing sessions stop working immediately.
- Each teacher and student also shows an **invitation status**: none, queued, sent, failed or accepted (when email is set up).

**Super admins** (the people who run the console) are kept in a separate table, `platform_admins`, and are not users of any school. A school login never opens the console, and a console login never opens a school.

### 5.3 How accounts are created
| Who | Created by | How |
|---|---|---|
| Super admin (console) | Server operator | `create-superadmin` command on the server, which prints a one-time password (section 15.5.1) |
| First admin of a school | Super admin | Console → Schools → New school. Shows a one-time password once and, if email is set up, emails a set-password link |
| More admins for a school | Super admin | Console → the school → Admins → Add admin |
| Teachers | Admin | Admin → Teachers → Add, or **Import CSV** (up to 500 at once; columns `name, email, department`) |
| Students | Admin | Admin → Students → Add (one at a time), or **Import CSV** (up to 2,000 at once; columns `name, rollNumber, email`), with a credentials CSV download |

Both import dialogs offer **Download template**, a ready-made CSV with the right column headings and example rows.

**One-time passwords** look like `XXXX-XXXX-XX`. They use an alphabet without the confusable characters 0/O and 1/I. Every admin-created account **must change its password at first sign-in**. Until it does, every other action is blocked (`PASSWORD_CHANGE_REQUIRED`).

**Emailed invitations** (when email is set up, section 14.5): a new account with an email address is also sent a **set-password link**. The person clicks it, chooses their own password on the `/set-password` page, and is signed in. Links work **once** and expire after **72 hours**. The admin can **Resend invite** from the Teachers or Students page. The one-time password is still shown as a fallback, for example for students without email.

### 5.4 Signing in
- **Each role has its own sign-in page:**
  - school admins: `/admin/login`
  - teachers: `/teacher/login`
  - students: `/student/login` (roll number)
  - `/login` is a **chooser** with three cards (School admin, Teacher, Student) that lead to those pages.
- Each page accepts only its own role. A teacher who types their details into the admin page gets "invalid email or password". Each page has links to the other two.
- Opening a page in an area while signed out sends you to that area's sign-in page, then back to where you were going.
- **School code:** if a roll number exists in more than one school, the student login asks for the school code (for example `BENX`). Otherwise students never need it.
- After signing in, users land on their area: `/admin`, `/teacher` or `/student`.
- **Forgotten password:**
  - The **Forgot password?** link (`/forgot-password`) emails a reset link to staff (by email) or to students (by roll number + school code), if the account has an email address and email is set up. The page always gives the same answer, so it never reveals whether an account exists.
  - Otherwise the admin clicks **Reset password** and chooses **Email a reset link** (when the person has an email address) or **Show a one-time password**.
- **Super admins** sign in somewhere else entirely: `https://ops.benxsolutions.in/platform/login`, the console's own address, with a password **and** an authenticator code (section 15.5.1). The page looks like the school sign-in pages and is headed **"Super admin sign in"**.
- **Notices:** when the console turns on a banner or maintenance mode, the message appears on every sign-in page and inside the app. With "block school sign-ins" ticked, sign-ins are refused until maintenance ends.

### 5.5 Sessions (staying signed in)
- After a successful login, the server sets a **cookie** named `cp_session` containing a **JWT**: a digitally signed token saying "user X, role Y, version Z".
  - It is **httpOnly**: page scripts can't read it, which protects against theft through malicious scripts.
  - It is **Secure** in production (sent only over HTTPS) and **SameSite=Lax** (protects against cross-site request forgery).
  - It lasts **12 hours** (`SESSION_TTL_HOURS`).
- On every request the server reloads the user and checks the token's **version** against `token_version` in the database. The version increases when the user changes their password, an admin resets it, or the user is disabled. That **instantly signs out** every other device.
- The server also checks the **school**: if the console has suspended it, every request is refused ("Your school's access is paused. Contact support.") until it is reactivated.
- **Console sessions** are separate: a cookie named `cp_platform`, valid for **2 hours**, sent only to the console (SameSite=Strict). Signing out of the console ends every console session of that super admin.

### 5.6 Brute-force protection (rate limits)
| What | Limit |
|---|---|
| Login attempts | 10 per 15 minutes per IP address + account (`LOGIN_RATE_LIMIT`) |
| Console sign-in steps (password, authenticator code, recovery code) | 5 per 15 minutes per IP address + account |
| Set-password links and "Forgot password?" | 20 per 15 minutes per IP |
| Live quiz PIN lookups, class join codes, exam access codes | 30 per minute per IP |
| AI actions (generate quiz, transcribe, remedial plan, AI teaching tools, voice prompts, AI grading suggestions) | 20 per hour per IP |
| Device registration | 10 per hour per IP |
| "Book a demo" requests (`/about`) | 5 per hour per IP (`DEMO_REQUEST_RATE_LIMIT`), and at most 50 emailed requests a day across all visitors |

Login also always takes the same time whether or not the account exists, so attackers can't discover valid emails by timing the response.

The limits count per **IP address** (the internet connection), so everyone on the same connection shares them: the whole school Wi-Fi shares the PIN, join-code and AI limits, for example. For sign-ins the email or roll number is counted as well, except the console's authenticator-code and recovery-code steps, which count per connection only. If you are locked out of the console, wait 15 minutes and try again.

---

## 6. Every feature, page by page

### 6.1 Shared pages
| Page | What it does |
|---|---|
| `/` | Sends you to your area if signed in, otherwise to `/login`. |
| `/about` | The public product page: what ClassPulse does, a sample question to try, and **Book a demo**: a short form (name, school, city, phone; email, role, classrooms and a message optional) that emails the request to the BenX inbox (`DEMO_REQUEST_TO`), with an email link to admin@benxsolutions.in as the fallback. No sign-in needed. |
| `/hi/about`, `/ta/about` | The same product page in Hindi and Tamil (`app/[locale]/about`, prerendered; any other language is a 404). Copy is one typed dictionary per language in `apps/web/components/landing/i18n` (`en.ts` is the source). Both translations are **drafts awaiting native review**: until `TRANSLATION_STATUS` in `i18n/locales.ts` says `reviewed`, the page is `noindex`, stays out of the sitemap and of `/about`'s hreflang links, and its footer says the translation is being reviewed. Review checklist: `i18n/index.ts`. A language switch (English · हिन्दी · தமிழ்) sits in the header and the phone menu. |
| `/robots.txt`, `/sitemap.xml` | For search engines: only `/about` (and each reviewed translation) and `/login` are listed; the signed-in areas, the console and the API are marked "do not index". |
| `/login` | A chooser with three cards: School admin, Teacher, Student. Each leads to its own sign-in page. |
| `/admin/login`, `/teacher/login`, `/student/login` | The sign-in page for each role. The student page asks for roll number and password; the school code field appears only when needed. |
| `/forgot-password` | Asks for an email (staff) or roll number + school code (students) and emails a reset link if possible. |
| `/set-password` | Where an emailed invitation or reset link lands: choose a password, then you are signed in. |
| `/change-password` | Current password, new password (at least 8 characters), confirm. Required at first login. |
| `/offline` | Shown by the installed app when there is no internet connection, with a **Try again** button. |
| Error pages | "Page not found" and "Something went wrong" with a "Try again" button. |

All signed-in pages share a **sidebar** (a hamburger menu on phones) with the user's name and **Sign out**. Menu items for a feature the console has switched off for the school are hidden.

**Notifications (the bell).** A bell sits next to the user's name in the sidebar (and in the phone header), in every area including the platform console. It tells people when a background job they started has finished: a lesson transcribed, quiz questions ready to review, a teaching resource (lesson plan, worksheet, question paper, presentation) ready, a job that failed and why, and, for super admins, a redeploy or restart that finished. The number on the bell is how many are unread. Opening it lists them newest first; clicking one marks it read and opens the lesson, resource or deployment. **Mark all as read** clears the count. While the app is open, a new one also pops up in the corner with an **Open** button, and the page it's about refreshes itself. At the bottom of the list, **Notify me on this device** turns on phone/desktop push for that device only, so it arrives even when the app is closed (on iPhone/iPad, add ClassPulse to the Home Screen first). The browser asks for permission only when the switch is pressed.

### 6.2 Admin console (`/admin`)
| Page | Features |
|---|---|
| **Overview** `/admin` | School name and code. Stat cards: teachers, students, sections, lessons, devices online, average quiz score. A **Lessons by status** bar chart. Quick links. A recent lessons table. |
| **Onboarding** `/admin/onboarding` | A 7-step setup checklist with progress ("N of 7 steps done"): (1) School profile form (name, code, academic year, time zone), (2) Rooms, (3) Sections, (4) Teachers, (5) Students, (6) Timetable, (7) Devices. Each step links to its page. |
| **Rooms** | Physical classrooms: name, building, capacity, device count. Add, edit and delete. A room with devices can't be deleted. |
| **Sections** | Classes (for example "Grade 10 – A"): grade, subject, room, teachers, student count, **6-character join code** (with a copy button). Actions: edit, **rotate join code** (makes the old one stop working), delete (refused if the section has lessons). |
| **Section detail** `/admin/sections/[id]` | Info, the join code with its Active/Expired status (codes expire after **30 days**), the student roster, and **Edit roster** (search and tick students). |
| **Teachers** | Name, email, department, sections, status, invitation status. Add (shows a one-time password and, with email set up, sends an invitation), edit, **disable** (they can't sign in; their lessons are kept), **reset password** (email a reset link or show a one-time password), **resend invite**, delete (refused if the teacher owns lessons). **CSV import:** download the template, fill in `name, email, department`, preview, import up to 500. |
| **Students** | Search, a section filter and paging. Add, edit, disable, reset password, resend invite, delete. **CSV import:** download the template, fill in `name, rollNumber, email`; preview in the browser; optional "enrol into section"; afterwards **download a credentials CSV**, since the initial passwords are shown only once. |
| **Timetable** | A weekly grid (Mon–Sat × periods) per section. Click a cell to set subject, start/end time, teacher and room. Save or discard. It powers the teacher's "Today's classes". |
| **Classroom devices** | Raspberry Pi recorders. Columns: device, room, status (Online/Recording/Offline/Error), last heartbeat, CPU temperature, free disk, microphone, **upload backlog**, agent version. Refreshes every 15 s. **Add classroom device** issues a one-time **enrollment token** (with a QR code, install commands and the settings file). **Revoke** a device. |
| **AI settings** | Dropdowns. Speech-to-text: provider (Sarvam AI / OpenAI) and model (Saaras v3 recommended, Saarika v2.5, Whisper). Quiz model: GPT-4.1 mini (recommended), GPT-4o mini, GPT-4.1, GPT-4o, GPT-5 mini. Also **Default number of questions** (1–30) and **Bilingual questions** (on/off). Shows whether each provider's API key is configured; the key itself is never shown. |

### 6.3 Teacher studio (`/teacher`)
| Page | Features |
|---|---|
| **Dashboard** `/teacher` | Greeting and a **Record a class** button. Banners for "N lessons ready for a quiz" and "N lessons need your review". Stats. Today's classes from the timetable. Lessons by status. Recent lessons. My sections. |
| **Record a class** `/teacher/record` | **Two tabs:**<br>**Record in classroom:** choose the section, which shows the Pi devices in that section's room with live status and mic health. Enter the title, subject and language, then **Start recording**. A big elapsed-time clock and chunk counter appear. **Stop recording** asks to confirm "Stop and upload". **Cancel** discards the recording. When the upload finishes, the page goes to the lesson.<br>**Upload audio file:** title, subject, language and a file (MP3, WAV, M4A, OGG, WebM, and phone MP4/MPEG recordings, up to about 300 MB). Shows a progress bar and supports cancel and retry. |
| **Lessons** `/teacher/lessons` | A list filtered by status and section, with paging. |
| **Lesson workspace** `/teacher/lessons/[id]` | The main page; see 6.3.1. |
| **Analytics** `/teacher/lessons/[id]/analytics` | Enrolled, attempted and average score. Per-question accuracy chart coloured **Critical (<50%) / Moderate (50–74%) / Mastered (75%+)**. Answer distribution per question. **Generate remedial plan** (AI suggestions on what to re-teach). Per-student scores table. |
| **Live quiz host** `/teacher/lessons/[id]/live` | Choose the time per question (10/20/30/45/60 s), then **Create live session**, which gives a 6-digit PIN. Lobby with the participant list, **Start**, open question with countdown and "n / m answered", **Close question**, results and leaderboard, **Next question** / **Finish quiz**. The end screen has a question breakdown. **Open projector view.** |
| **Projector** `/teacher/lessons/[id]/present?session=` | Full-screen display for the classroom projector: big PIN and **QR code** to join, the question with countdown, results, leaderboard and a final podium. |
| **Assignments** `/teacher/assignments` | Homework, either standalone or attached to a lesson (a lesson can have several). See 6.3.2. |
| **Exams** `/teacher/exams` | Secure, timed exams with a live monitor. See 6.3.3. |
| **AI teaching tools** `/teacher/resources` | Lesson plans, worksheets, question papers and presentations written by AI from the teacher's own material. See 6.3.4. |
| **Courses & materials** `/teacher/courses` | The syllabus (courses and their units) and the teacher's uploaded documents. See 6.3.4. |
| **Simulations** `/teacher/simulations` | Interactive science and maths simulations to show in class. See 6.3.4. |
| **Class insights** `/teacher/insights` | Which skills and topics a class has mastered. See 6.3.4. |
| **My classes** | Each section with its student count, room, co-teachers, join code (copyable, with expiry), and links. |
| **Timetable** | A read-only weekly view, with today highlighted. |

#### 6.3.1 The lesson workspace in detail
- **Header:** status badge, language, duration, dates. **Publish** appears when there is at least one approved question. A published lesson has **Start live quiz**, **Analytics** and **Unpublish**. **Delete** appears only for draft, failed and "Ready for quiz" lessons.
- **Quiz settings panel** (the generator):
  - **Number of questions:** 1–30, pre-filled with the school default.
  - **Difficulty:** Easy / Medium / Hard / Mixed (the default).
  - With no questions yet, there is a single **Generate quiz** button.
  - Once there are questions, a **Change questions** panel offers:
    - **Add more questions:** keeps everything and adds new questions on points the quiz doesn't test yet.
    - **Replace unapproved questions:** keeps the questions you approved or edited, and replaces the rest.
    - **Replace all questions:** starts over, including the summary and assignment.
  - The replace actions (and any change to a published lesson) ask for confirmation first.
- **Questions list:** counts (approved / pending / rejected), **Add question** (written by hand), **Approve all**. Each question card shows its status, difficulty and topic tag, its **Bloom level** (remember, understand, apply, analyse, evaluate, create: the kind of thinking it tests) and a short **competency** (the skill it checks), plus an "Edited by you" badge. The AI suggests both tags; the teacher can change them. It shows the question and 4 options with the correct one highlighted, the explanation, the **local-language translation** (for non-English lessons), and a **citation timestamp button** that plays the exact part of the lecture the question came from. Actions: Approve, Reject, Edit, Delete.
- **Edit dialog:** question, 4 options with a "correct" radio, explanation, difficulty, topic, and optional translation fields.
- **Class recording + transcript:** an audio player, with a note on the date the audio will be deleted. A timestamped transcript highlights the current sentence; click a sentence to jump there.
- **Summary & key takeaways:** editable, up to 10 takeaways.
- **Assignment (homework):** title, instructions, rubric (criteria with marks), estimated minutes, optional due date. Published together with the lesson. More assignments can be added to the same lesson from the Assignments page.
- **Processing view:** while transcribing or generating, shows a progress bar and steps. If something fails, the reason is shown in plain language with **Try again**.

#### 6.3.2 Assignments
- **Create:** title, instructions, rubric (up to 20 criteria, each with marks and a short description), estimated minutes, due date, and:
  - **Late policy:** "allow late" (accepted after the due date and marked **late**) or "closed" (refused after the due date);
  - **File uploads:** on or off, and how many files (up to 10). Students can attach photos of handwritten work (JPEG, PNG, HEIC), PDFs or Word documents, up to 10 MB each;
  - **Reminders:** emails students who haven't handed in, once, in the 24 hours before the due date (needs email set up).
- **Publish** and **Close** control when students can submit.
- **Submissions tracker:** every student in the class, marked missing, submitted, late or returned.
- **Grading:** open a submission, see the text and files, enter marks per rubric criterion and feedback. **Suggest with AI** proposes marks and feedback from the typed answer and any JPEG/PNG photos; the teacher reviews and changes them before saving. The AI note says what it could not read (for example a PDF).
- **Return** one submission, or **Return all graded**: the student then sees marks and feedback.

#### 6.3.3 Secure exams
A timed exam built from **approved questions** in the teacher's own lessons.
1. **Details & window:** title, class, instructions, when it **opens** and **closes**, and the **duration**. Each student's timer starts when they begin and never runs past the closing time.
2. **Questions:** pick questions from the class's lessons (filter by lesson, difficulty, topic), and choose **how many each student gets**. Each student gets their own random selection from the pool.
3. **Security & publish:**
   - shuffle question order, and shuffle answer options, per student;
   - **require fullscreen** (phones that can't go fullscreen still get warnings);
   - **access code:** a 6-character code the teacher reads out in the room; it can be changed any time;
   - **one device at a time:** opening the exam on a second device is blocked until the teacher unlocks it;
   - **auto-submit after N warnings:** leaving fullscreen, switching tabs, copying, pasting or printing each count as a warning;
   - when students see results: after the exam closes (default), immediately, or never.

When published, the question pool is **frozen**: later edits to the lessons don't change a running exam.

**Live monitor** (`/teacher/exams/<id>/monitor`): each student's status (not started, in progress, submitted), time left and warnings. The teacher can **unlock** a student's device, give **extra time**, or **force-submit**. Answers save automatically; attempts left open past the deadline are submitted automatically.

**Results:** scores per student, each attempt's **integrity timeline** (every warning, with its time), and a CSV download.

#### 6.3.4 AI teaching tools, courses, simulations and insights
These are controlled by the school's "Teacher tools" switch in the console.

- **Courses & materials** (`/teacher/courses`):
  - **Import from the catalog:** ready-made chapter lists for NCERT/CBSE Classes 6–12 (current NCERT textbooks) and starter outlines for undergraduate subjects. Importing creates a course with its units (chapters), which the teacher can then edit, reorder or extend.
  - Or **create a course** for any level or board by hand. The AI can draft a unit's summary and objectives.
  - **Materials:** upload PDF, Word (DOCX) or text files (up to 20 MB each) and attach them to a course or unit. Their text is used to ground the AI tools, so the output follows the teacher's own notes.
- **AI teaching tools** (`/teacher/resources`). The teacher picks a type, the course and units, optionally their own recorded lessons and materials, a language, and describes what they want, by typing or by **voice** (speak for up to 60 seconds in any supported language; the recording is transcribed and not kept). Types:
  - **Lesson plan:** duration, periods, objectives, activities with timings, teacher notes, assessment, homework, support and extension ideas.
  - **Worksheet:** number of items, difficulty, item types (multiple choice, short, long, fill in the blank, true/false, match), with an optional answer key.
  - **Question paper:** exam name, maximum marks, duration, and a **blueprint** (sections, question types, counts, marks each, **internal choice** "OR" questions), a target mix of **Bloom levels** and of difficulty. Every question gets its marks, Bloom level, competency, an answer and a marking scheme, so the paper comes with an **answer key**. **Publish MCQs as exam** turns its multiple-choice questions into a draft secure exam for the teacher to check and publish.
  - **Presentation:** number of slides, speaker notes, and a theme.
  - Everything generated can be **edited** on screen, **regenerated**, downloaded as **Word** (plans, worksheets, papers) or **PowerPoint** (presentations), or **printed**.
  - **Share with school:** adds the item to the school library, where other teachers can view it and make their own copy.
- **Simulations** (`/teacher/simulations`): about 90 free **PhET** simulations (physics, chemistry, biology, maths, earth science) built in, searchable by topic. Teachers can also add links from a short list of trusted sites (PhET, GeoGebra, Desmos, oPhysics, OLabs). **Classroom mode** shows a simulation full screen for the projector.
- **Class insights** (`/teacher/insights`): for a class, how well students do at each Bloom level and on each topic or competency, as a chart and a heat map, with a drill-down per student. It uses each student's latest quiz attempt per lesson (with the question tags) and their submitted exams (exams count towards topics and the overall figure, not Bloom levels).

### 6.4 Student portal (`/student`, playful yellow theme)
| Page | Features |
|---|---|
| **Home** | "Hi, name!", a live quiz PIN shortcut, stats (average score, quizzes to do, classes), quizzes to take, recent scores, upcoming assignments, my classes. |
| **Join a class** `/student/join` | Enter the 6-character class code. It previews "Class found" first, then **Join class**. |
| **Quizzes** | Cards with a score badge or "New". |
| **Take a quiz** | Intro (summary, takeaways), then one question at a time with Next/Back, an **English ↔ local language toggle** (when translated), and a review screen ("unanswered questions count as wrong"), then **Submit**. **Results:** score %, each answer with the correct answer, explanation and "From the lecture at 0:17". **Retake** is unlimited. |
| **Live quiz** `/student/live` | Enter the PIN (or scan the projector's QR code). Lobby, then tap an answer (it can be changed until time runs out), see whether you were right, your points and your rank, then the final leaderboard. |
| **Exams** `/student/exams` | Upcoming, open and finished exams. **Start** (with the access code if the teacher set one), then one question at a time with a countdown kept by the server. Answers save automatically. Warnings appear when the student leaves fullscreen or switches tabs. After submitting, the result shows when the teacher allows it. |
| **Assignments** | Due badge, task and rubric, a text answer (up to 20,000 characters) and, if the teacher allows, **files** (photos of handwritten work, PDFs, Word documents). Submit and resubmit until the due date; after it, only if the teacher allows late work (marked late). Returned work shows marks per criterion and feedback. |
| **Profile** | Name and roll number, optional email, change password, my classes, **guardians** (parent contacts: name, relation, phone, email, "send progress updates"), and **Take the tour again**. |

#### 6.4.1 The first-login guided tour
The first time a student reaches the **Home** page, a short **guided tour** starts by itself. It highlights one part of the screen at a time with a short explanation, and has **Back**, **Next** and **Skip tour** buttons (Esc also closes it).
- **When it appears:** only on Home, and never on top of the forced password change at first sign-in; it starts after the student has chosen their own password.
- **What it covers:** Home, **Join a class**, **Quizzes** (retakes are unlimited), **Live quiz** (enter the 6-digit PIN), **Assignments**, **Exams** (open only during their window, one attempt, answers saved automatically, fullscreen, leaving the tab is recorded, automatic submission when time runs out), **Profile**, **installing the app** (the steps for Android Chrome and iPhone Safari, plus an **Install app** button when the browser offers one), and a final "You're all set!" step.
- **Switched-off features are skipped:** if the console has switched off exams, assignments or the live quiz for the school, those steps don't appear.
- **Phones:** where the menu is folded into the ☰ button, the tour spotlights that button.
- **"Seen" is remembered per student, per device**, in the browser's own storage. On a new phone or browser, or after clearing browser data, the tour shows once more. Students can replay it any time from **Profile → Take the tour again**.
- The tour is built as a reusable piece (`apps/web/components/tour`), so a similar tour for teachers can be added later.

### 6.5 Platform console (`/platform`, super admins only)
The owner's control room for the whole installation. It lives on its **own address**, `https://ops.benxsolutions.in`, separate from the schools' address, and asks for an authenticator code at every sign-in. It uses the same light design as the admin and teacher panels (the earlier dark theme was removed). Step-by-step instructions are in section 15.5.

| Page | Features |
|---|---|
| **Overview** | Number of schools, teachers and students; active **alerts**; most recently active schools. |
| **Schools** | Every school with its people, content and status. **New school** creates a school and its first admin. Opening a school shows tabs: Overview, **Admins** (add, reset password, resend invite, disable/enable), People, Content, Devices (read-only lists), **Features & limits**, and Activity (the school's audit trail). **Suspend** / **Reactivate** sit at the top. |
| **Users** | Search for any person in any school by name, email or roll number (at least 2 characters), with a role filter. |
| **Health** | Live status of the database, Redis, worker, API, disk, email, AI providers (with a **Test** button), classroom devices and backups. Alerts, the three job queues with **retry** for failed jobs, and a history chart. Refreshes every 15 seconds. |
| **Logs** | A live tail of the application's log lines (warnings, errors, slow or failed requests, and other notable events), filterable by level, service, school and text. CSV download. Kept **14 days**. |
| **Audit log** | Who did what and when: sign-ins, school changes, feature switches, password resets, deployments. Filters and CSV download. Kept **365 days**. |
| **Usage & costs** | Activity per day, week or month (active users, quiz attempts, exams and homework, emails) and **AI usage**: calls, failures, tokens, audio minutes and **estimated AI cost** in US dollars, per school and per model. CSV download. |
| **Deployments** | The running version and recent deployments from Coolify, deployment logs, and **Redeploy** / **Restart** buttons (each needs typed confirmation). Connected to Coolify in production (section 14.5). Build logs show only if the Coolify token has the "read:sensitive" permission; otherwise the page says so and the log can be read in Coolify itself. |
| **Settings** | **Maintenance mode** and a **banner** for every school; **default AI models** for new schools; **AI price rates** used for the cost estimates; **My account** (change password, generate new recovery codes). |

### 6.6 Installing ClassPulse as an app (PWA)
ClassPulse is a **Progressive Web App**: a website that can be installed like an app, with its own icon and window.
- **Android (Chrome):** open the site, then menu (⋮) → **Add to Home screen** or **Install app**.
- **Computer (Chrome or Edge):** the **Install app** icon at the right of the address bar, or the install option in the browser menu.
- **iPhone/iPad (Safari):** Share → **Add to Home Screen**.

The installed app is the same website, so updates arrive automatically. Without internet it shows an **offline page** with a **Try again** button. Only the app's own files (layout, icons, fonts) are kept on the device. School data, sign-ins and quiz answers always come from the server and are never stored offline.

---

## 7. The life of a lesson (statuses)

A lesson moves through these **statuses**:

```
 draft ──(upload audio)──────────────┐
   │                                 ▼
   └─(Start recording)─▶ recording ─(Stop → Pi uploads → finalize)─▶ queued
                                                                      │
                                     queued ─▶ transcribing ─▶ transcribed ("Ready for quiz")
                                                                      │  teacher: Generate quiz
                                                                      ▼
                                              queued ─▶ generating ─▶ ready_for_review ("Needs review")
                                                                      │  teacher: Publish
                                                                      ▼
                                                                   published ──(Unpublish / change questions)─▶ ready_for_review
   any processing step can end in ─▶ failed (with a plain-language reason; Try again)
```

| Status | Badge shown | Meaning | What the teacher can do |
|---|---|---|---|
| `draft` | Draft | Created, no audio yet | Upload audio, write questions by hand, delete |
| `recording` | Recording | A classroom Pi is recording it | Stop or cancel on the Record page |
| `queued` | Queued | Waiting for the worker | Wait |
| `transcribing` | Transcribing | Speech → text in progress | Wait (progress bar) |
| `generating` | Generating | AI is writing questions | Wait |
| `transcribed` | **Ready for quiz** | Transcript ready, waiting for the teacher's quiz settings | Choose the number and difficulty, then **Generate quiz**; delete |
| `ready_for_review` | Needs review | Questions written, not published | Approve, edit, add, replace, then **Publish** |
| `published` | Published | Students can see it | Live quiz, analytics, unpublish, change questions (this unpublishes first) |
| `failed` | Failed | Something went wrong (reason shown) | **Try again** (transcribe again or generate again), upload new audio, delete |

**Protections:**
- A lesson can't be edited while it is processing, and a published lesson's questions are read-only until it is unpublished.
- If a teacher starts a new generation while an old job is still running, the old job's results are **discarded**. Every job carries a "generation attempt" number, and only the latest one may save.

**Notifications:** the teacher gets one notification (bell, and push if turned on) when a run ends `transcribed` ("“Title” has been transcribed."), `ready_for_review` ("Questions are ready to review for “Title”.") or `failed` (after the last retry or the 48-hour stuck timeout, with the plain-language reason). Classroom-device recordings go through the same pipeline. Retries and re-queues never notify, and each lesson's generation attempt is notified at most once per kind.

---

## 8. The AI pipeline in depth

### 8.1 Overview
```
audio file ─▶ ffmpeg (convert to 16 kHz mono WAV, measure length)
           ─▶ Speech-to-text (Sarvam or Whisper) ─▶ transcript + timestamps  [lesson: transcribed]
teacher clicks Generate (N questions, difficulty, mode)
           ─▶ OpenAI quiz model ─▶ questions + summary + takeaways + assignment ─▶ checked ─▶ saved  [ready_for_review]
```

### 8.2 Step 1: Audio preparation
- Every upload is converted with **ffmpeg** to **WAV, 16,000 samples per second, mono** (the format speech AIs expect), and its exact duration is measured.
- Accepted file types: `.mp3 .wav .m4a .mp4 .aac .ogg .oga .opus .webm .flac .mpeg .mpga`.
  - Phone recordings saved as `.mp4`/`.mpeg` (which browsers label as "video") are accepted.
  - A file that ffmpeg can't decode is rejected with "unsupported media type".
- **Size limit:** 300 MB per upload (`MAX_AUDIO_UPLOAD_MB`). The router allows up to 400 MB on the upload URL.
- Audio is **kept for 30 days** (`AUDIO_RETENTION_DAYS`), then deleted automatically. The transcript, questions and results are kept.

### 8.3 Step 2: Speech-to-text (STT)
Chosen per school in **Admin → AI settings**.

**Sarvam AI (default, recommended for Indian classrooms):**
- Uses Sarvam's **batch API**: create a job, upload the audio, start it, check every 5 seconds, then download the result. The time limit is 20 minutes, plus 5 minutes for each extra hour of audio.
- **Model `saaras:v3` in `codemix` mode** keeps English words in English letters inside Indian-language speech. Example: "JDBC தான் இப்போ for example…" instead of transliterating "JDBC" into Tamil script. The quiz writer understands this far better. This was verified on real Tamil–English recordings.
- `saarika:v2.5` is an alternative for single-language speech.
- Audio over **50 minutes** is split into parts inside one job; the timestamps are stitched back together.
- Returns **timestamps** per phrase. Very short word-level timestamps are merged into readable phrases. If Sarvam returns none, the sentences are spread over the audio length and marked "approximate".

**OpenAI Whisper (alternative):** model `whisper-1`, with segment timestamps. Audio is split into parts of 10 minutes or less (the API has a 25 MB limit). **It is only a fallback for English.** A benchmark on 12 October 2026 (section 8.10) found that it refuses Bengali, Gujarati, Malayalam, Punjabi and Telugu outright (left to guess the language, it gets 85–104% of the words wrong), and in the other Indian languages it gets about 40% (Hindi) to 82% (Marathi) of the words wrong, against 11–19% for Sarvam. If Sarvam is down, non-English lectures effectively cannot be transcribed (section 19).

**Supported lesson languages:** English (en-IN), Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi, Odia. The teacher picks the language when creating the lesson.

**Measured on the live server:**
| Recording | Length | Transcription time |
|---|---|---|
| English lecture | 11 min | about 15–30 s |
| Tamil + English | 22 min | about 30–50 s |
| Tamil | 25 min | about 40–70 s |

### 8.4 Step 3: Quiz generation (the LLM)
Triggered **only by the teacher** (since 10 October 2026). The teacher's request (count, difficulty, mode) is stored on the lesson (`quiz_request`), so it survives a server restart.

**What the AI is given:**
- **The transcript**, as numbered blocks with times: `[3] (01:20-01:45) text…`. It is capped at 150,000 characters (about 2.5 hours of speech).
- **Strict instructions:**
  - use only facts from the lecture;
  - write the requested number of multiple-choice questions, each with exactly 4 options and exactly one correct;
  - use plausible wrong answers and never "all/none of the above";
  - include an explanation, a topic tag, and the numbers of the transcript blocks that prove the answer.
- **A difficulty instruction:**
  - **Easy:** recall of facts or definitions.
  - **Medium:** understanding or applying an idea.
  - **Hard:** analysis, multi-step reasoning, comparing ideas.
  - **Mixed:** explicit counts. For 20 questions that's 7 easy, 7 medium, 6 hard. Explicit counts were added after "mix them" produced no hard questions.
- **Bilingual mode** (lesson not in English, and "Bilingual questions" on): the AI also writes the question, options and explanation in the lesson language, **keeping subject terms in English** as the teacher says them. Example: "Mean கண்டுபிடிக்கணும்", not a literal translation that turned "mean" into "மீன்" (fish).
- **Also produced:** a 2–4 sentence summary, 3–6 key takeaways, and a homework assignment with a rubric.
- **Structured outputs:** the AI must reply in an exact JSON format (enforced by OpenAI's "strict json_schema" feature).

**How the answer is checked (nothing unchecked reaches teachers):**
1. Each question is validated **on its own**: 4 distinct options, exactly 1 correct, cited blocks that exist, and translation fields present when bilingual. **Invalid questions are dropped**, not the whole quiz.
2. **Duplicates** (same question text) are dropped.
3. If there are **too many** questions, the extras are trimmed.
4. If there are **too few**, the AI is asked again for the missing ones on points not already covered (**top-up**, up to 2 extra requests).
5. If the overall answer is malformed (for example no summary), the AI gets **one repair request** describing the problems.
6. If a lecture can't support the number requested, the teacher still gets what was written, as long as there are **at least 3** questions. Otherwise the lesson fails with "The AI could only write a few valid questions… Try again, or add questions yourself."
7. **Answer order is shuffled** with a secure random number generator, so the correct answer isn't always "A".
8. For a fixed difficulty (Easy/Medium/Hard), every saved question is labelled with that difficulty.

**Citations:** each question links to the **first continuous stretch** of transcript blocks it cites (usually 15–30 seconds). Earlier, citations could span 20 minutes. The teacher and students can click it to hear that part.

**The three change modes:**
| Mode | Keeps | Replaces | Also regenerates summary/assignment? |
|---|---|---|---|
| Add more questions (`append`) | All existing questions | Nothing (adds new ones at the end) | No (summary and assignment are kept) |
| Replace unapproved (`replace_unapproved`) | Approved + teacher-edited questions | All others | No |
| Replace all (`replace_all`) | Nothing | Everything | Yes |

For "add" and "replace unapproved", the AI is shown the existing questions and told to test **different points**. Kept questions are renumbered first, and new ones follow.

**Measured on the live server (English 11-minute lecture):**
| Request | Result |
|---|---|
| 20 questions, Mixed | 7 easy / 8 medium / 5 hard, in 21 s |
| Add 5 Hard | 25 questions, no duplicates, in 10 s |
| Replace unapproved with 3 Easy | Kept the 4 approved questions, added 3 new ones, in 5 s |

### 8.5 Step 4: Remedial plan (after students attempt)
On the analytics page the teacher clicks **Generate remedial plan**. The AI receives per-question accuracy, answer distributions and topics, and returns a short summary plus up to 8 topic-specific re-teaching actions. The plan is **cached** until the teacher regenerates it.

### 8.6 Reliability rules
- **Network/server errors:** each AI call is retried up to 3–4 times with increasing waits, respecting the provider's "retry after" hints. Each job is retried **3 times**, with backoff starting at 15 s.
- **Errors that won't fix themselves** (bad API key, empty audio) fail immediately, with a clear message ("Speech-to-text credentials were rejected…").
- **No fake content, ever:** if the AI fails, the lesson shows **Failed** with a reason. There is a demo mode (`PIPELINE_DEMO_FALLBACK`) for development only. It produces clearly labelled "[Demo]" text and is **forbidden in production** by the settings validation.
- **Stuck jobs:** when the worker starts, any lesson stuck in queued/transcribing/generating without a running job is re-queued.
- **Concurrency:** the worker processes **1 lesson at a time** in production (`GENERATION_CONCURRENCY=1`, chosen for the 2-CPU server). Others wait in the queue.
- **Notifications:** finished and failed jobs notify the person who started them (lessons and teaching resources: the teacher; redeploys and restarts: the super admin, via a `deploy-watch` task that polls Coolify every 20 s and keeps its watches in Redis, so it survives the restart the deploy causes). A notification problem never changes a job's result or its retries.

### 8.7 What the AI providers receive (privacy)
- **Sarvam:** the lecture audio, and teachers' voice prompts (up to 60 seconds; not stored by ClassPulse).
- **OpenAI:**
  - the transcript text, lesson title and subject, and (for remedial plans) aggregated accuracy statistics;
  - for the AI teaching tools: the teacher's request, the course and unit details, and text from the lessons and materials the teacher chose;
  - for **AI grading suggestions**, only when the teacher clicks the button: the assignment, its rubric, and the student's typed answer and attached JPEG/PNG photos (the photos' file names go with them). The student's name is not sent.
- **No student names are sent to either provider.** Note that a student's own work, sent for a grading suggestion, may contain whatever the student wrote on it.

### 8.8 AI usage records and the monthly audio limit
- **Every AI call is recorded** in the `ai_usage` table, successful or not: which school, what for (transcription, quiz, more questions, remedial plan, grading, teaching tool, voice prompt), which model, and the tokens or seconds of audio used.
- The console's **Usage & costs** page turns these into **estimated costs** using the price rates in console **Settings → AI price rates** (US dollars per million tokens for each quiz model, per hour of audio for each speech model). The rates are editable because providers change prices. The figures are estimates: the providers' invoices are the real bill.
- **Monthly AI audio minutes per school:** an optional limit set in the console (Features & limits). It counts minutes successfully transcribed since the 1st of the month in the school's time zone. When an upload would go over it, the teacher sees "This school's monthly AI transcription minutes are used up. Contact your administrator." Nothing else stops working.

### 8.9 The AI teaching tools pipeline
1. The teacher asks for a lesson plan, worksheet, question paper or presentation (section 6.3.4).
2. ClassPulse gathers the **grounding**: the units' summaries and objectives, the transcripts of the chosen lessons, and the text of the chosen materials. They are fitted into about 60,000 characters, with each source given a fair share.
3. A job goes on the `resources` queue. The worker asks the school's quiz model for the result in a strict format (the same "structured outputs" as for quizzes), checks it, and saves it. The item shows **Ready**, or **Failed** with a reason and a retry.
4. Downloads are built on the server: Word files for plans, worksheets and papers, PowerPoint for presentations.

### 8.10 Research: running the AI on our own machines
The long-term goal is to stop depending on outside AI services and run our own ("self-hosted" or "local") models for every feature. **For now, production stays on the Sarvam and OpenAI APIs; local models are research only.** Two reports in `docs/agents/research/` cover the work:
- **`docs/agents/research/local-models-rnd.md`:** the research plan and the roadmap to a fully local ClassPulse: candidate models for speech-to-text, quiz writing, grading and teaching tools, the hardware they need, rough costs, and how they will be tested.
- **`docs/agents/research/stt-benchmark-2026-10-12.md`:** a real test of local speech-to-text models against Sarvam on Indian-language audio and our own classroom recordings. In short:
  - **Sarvam Saaras v3 is still the best.** Across 9 Indian languages it gets 13.9% of words wrong (the "word error rate", WER; lower is better).
  - **The best model we could run ourselves is AI4Bharat IndicConformer 600M** (free, MIT licence) at 16.5%, and it runs on an ordinary processor without a graphics card. But on real, noisy classroom audio that mixes Tamil and English, it writes English terms in Tamil script and drops much of the speech.
  - **Whisper large-v3** handles mixed Tamil–English best of the local models, but is weak on purely Indian-language speech. Having an AI language model correct the transcript afterwards helps only slightly.
  - **Next step:** record and hand-check 3–5 hours of real ClassPulse classroom audio, to measure accuracy properly, then use more labelled audio to train ("fine-tune") a local model on it.

IndicConformer is also the planned option for a better **fallback** when Sarvam is unavailable, instead of OpenAI Whisper (section 19).

---

## 9. The live quiz engine

### 9.1 How a live quiz runs
1. The teacher opens a **published** lesson and clicks **Start live quiz**. They choose the seconds per question (default 20; 5–300 allowed by the API), then **Create live session**. A **6-digit PIN** is generated, unique among active sessions.
2. The teacher opens the **projector view** on the classroom screen, which shows the PIN and a **QR code**.
3. Students go to **Live quiz** on their phones and enter the PIN or scan the code. Only students **enrolled in that lesson's class** can join.
4. The teacher clicks **Start**. Each question opens with a **countdown kept by the server**.
5. Students tap an answer. They can **change it until time is up**; the last answer counts.
6. When time is up (or the teacher clicks **Close question**), everyone sees the correct answer, the explanation and the answer distribution. Each student sees their own result, points and rank. The leaderboard shows the top 10.
7. **Next question** … **Finish quiz**. The final leaderboard and a per-question breakdown are saved.

### 9.2 Scoring
- A correct answer earns **500 points + a speed bonus of up to 500**: the faster you answer (relative to the time limit), the more bonus. Wrong answers earn 0.
- The time counted is that of the student's **final** answer, measured by the **server's clock**, so phones can't cheat by faking time.
- Ranking is "competition style" (1, 2, 2, 4). Ties are broken by number of correct answers, then name.

### 9.3 Fairness and anti-cheating
- **The correct answer never reaches a student's phone before the question closes.** It is sent only to the teacher's screen.
- Students are identified by their **login cookie**, not by anything they type, so they can't impersonate each other.
- Answers that arrive after the deadline, or for the wrong question, are rejected.
- Connections from other websites are refused (origin check).

### 9.4 Reliability
- Every state change and answer is **saved in PostgreSQL**. If the API restarts mid-quiz, the room is rebuilt from the database, and overdue questions are closed immediately.
- If a student's phone disconnects and reconnects, they rejoin as the same participant with their score and current answer, and the screen catches up.
- **Load test (live server, over the internet):** **100 students** in one live quiz, **0 join failures, 500/500 answers acknowledged, 0 dropped**, response time **p95 = 46 ms** (95% of answers were confirmed within 46 milliseconds) in the latest run on 11–12 October 2026; an earlier run measured 42 ms. The target was under 300 ms.

### 9.5 Technology
The live quiz uses **Socket.IO** (a two-way live connection, WebSocket with fallback). Events:

| Sent by | Events |
|---|---|
| Teacher | `host:join`, `host:start`, `host:next`, `host:close_question`, `host:end` |
| Students | `player:join` (with PIN), `player:answer` (question + option) |
| Server | `live:state`, `live:participants`, `question:open` (no answer key), `question:host_open` (with the answer, teacher only), `question:progress`, `question:closed`, `player:result`, `live:leaderboard`, `live:ended` |

The server-side states are: `lobby → question_open → question_closed → … → ended`.

---

## 10. The Raspberry Pi classroom recorder

### 10.1 Hardware (per classroom)
| Item | Notes |
|---|---|
| Raspberry Pi 5 (2–4 GB) | The small computer |
| Official 27 W USB-C power supply | Low power causes microphone dropouts |
| 32 GB+ microSD (A2) or NVMe | Stores audio until it is uploaded (about 115 MB per hour) |
| Cooler / fan case | Keeps the CPU below 70 °C; the temperature is reported |
| USB conference / boundary microphone | Any standard USB mic that can record 16 kHz mono |
| Network | Campus Wi-Fi or Ethernet (Ethernet preferred). Captive-portal Wi-Fi is **not** supported |

### 10.2 What the software does (`apps/classroom-agent/agent.py`)
- **Python 3 standard library only**, so nothing extra to install. It runs as a **systemd service** (it starts on boot and restarts if it crashes) under its own restricted user, `classpulse`.
- **Outbound connections only:** the Pi contacts the server; nothing on the internet can contact the Pi. No port forwarding or firewall changes are needed on campus.
- **Four parallel tasks (threads):**
  1. **Heartbeat** every 30 s, reporting status, mic OK, mic name, CPU temperature/load, memory, free disk, upload backlog, agent version and last error.
  2. **Command listener:** asks the server "anything for me?" and waits up to 25 s for an answer. This is called long-polling. Commands are `start_recording` and `stop_recording`.
  3. **Recorder:** runs `arecord` (the Linux audio recorder) to capture **16 kHz mono raw audio** and saves it in **60-second chunks** with a **SHA-256 fingerprint**.
  4. **Uploader:** sends chunks to the server, and **deletes each local chunk only after the server confirms it**.
- **Resilience:**
  - **Wi-Fi drops:** recording continues; chunks queue on the SD card and upload later.
  - **Pi reboots or the agent crashes:** on restart it asks the server which chunks it already has, resumes the recording if it's still active, and finishes uploading.
  - **Microphone unplugged/replugged:** the recorder restarts after 2 seconds and reports "mic not OK" meanwhile.
  - **Disk nearly full** (below 500 MB): refuses to start new recordings and reports the reason. It **never deletes unsent audio**.
  - **Retries:** these back off (2 s up to 5 minutes, with randomness) so many Pis don't all retry at once.
  - **Limit:** a session can be up to 6 hours (360 chunks).
- **Security:**
  - HTTPS with certificate checking is mandatory. A campus certificate can be added with `ca_file`.
  - The device's secret key is stored in a file only it can read (mode 0600).

### 10.3 Setting up a new Pi (provisioning)
1. Install **Raspberry Pi OS Lite (64-bit, Bookworm)** with Raspberry Pi Imager: set the hostname, Wi-Fi and SSH.
2. Plug in the USB mic and find its name with `arecord -l`, for example `plughw:2,0`.
3. In ClassPulse, go to **Admin → Classroom devices → Add classroom device**: choose the room and a name. You get an **enrollment token**, which is single-use and **expires in 24 hours**.
4. On the Pi: install the agent (`sudo ./install.sh`), then edit `/etc/classpulse/agent.json`:
   ```json
   { "server_url": "https://classpulse.benxsolutions.in", "device_id": "rpi5-room-101",
     "enrollment_token": "<token>", "alsa_device": "plughw:2,0" }
   ```
5. `sudo systemctl enable --now classpulse-agent`. The device registers and shows **Online** in the admin console.
To **replace** a Pi, revoke the old one and issue a new token.

### 10.4 How a classroom recording works (the device contract)
1. **Registration:** the Pi exchanges the enrollment token for a permanent **device key**. The server stores only a **SHA-256 hash** of the key, never the key itself.
2. **Start:** the teacher clicks **Start recording**. The server creates the lesson (status `recording`), a recording session, and a `start_recording` command. The command expires if the Pi doesn't pick it up within 2 minutes.
3. **Recording:** the Pi uploads chunks: `PUT /api/devices/me/sessions/<id>/chunks/<n>` with an `X-Chunk-SHA256` header. The server checks the fingerprint. Sending the same chunk twice is harmless.
4. **Stop:** the teacher clicks **Stop**, which sends `stop_recording`. The Pi finishes uploading, then calls **finalize**.
5. **Finalize:** the server checks every chunk is present (otherwise it lists the missing ones), joins them into one WAV file, attaches it to the lesson, deletes the chunks, and **queues transcription**.
6. **Housekeeping (every 30 s):**
   - devices with no heartbeat for **90 s** are marked offline;
   - expired commands are cleared;
   - recordings that never started within 2 minutes are failed;
   - recordings that never finished uploading within **6 hours** of Stop are failed.

**Bandwidth:** each 60-second chunk is about 1.9 MB, which averages about 32 KB/s while recording.

---

## 11. The database

### 11.1 Basics
- **PostgreSQL 16.** Every record has a random **UUID** as its ID, and every time is stored with its time zone.
- The structure is defined in code (`apps/api/src/db/schema/`). Changes are made through **migrations**: numbered SQL files applied in order and only forward.
  - `0000_init.sql` creates 23 tables and 14 "enum" types (fixed lists of allowed values).
  - `0001_teacher_quiz_generation.sql` added the `transcribed` status and the `quiz_request` column.
  - `0002_invites_exams_assignments.sql` added 8 tables: emailed set-password links, assignment files and reminders, and secure exams.
  - `0003_platform.sql` added 7 tables for the platform console (super admins, settings, logs, audit, health, AI usage, email log), plus each school's status, feature switches and limits.
  - `0004_teacher_tools.sql` added 5 tables for courses, units, teacher materials, teaching resources and simulation links, plus the Bloom and competency tags on questions.
  - `0005_notifications.sql` added 2 tables for notifications and phone/desktop push subscriptions, plus each person's notification settings (`notification_prefs` on `users` and `platform_admins`).
- In development, run `npm run db:migrate` after pulling a new migration (`npm run dev` does not migrate).
- In production, migrations run **automatically** each time the API starts.

### 11.2 Tables (45)
| Group | Table | What it stores |
|---|---|---|
| School | `institutions` | Schools (name, unique code, time zone, academic year) |
| | `users` | Admins, teachers and students (role, name, email or roll number, password hash, must-change-password flag, token version, status, last login) |
| | `rooms` | Classrooms |
| | `sections` | Classes, each with a 6-character join code and its expiry |
| | `section_teachers` | Which teachers teach which section (many-to-many) |
| | `enrollments` | Which students are in which section (many-to-many) |
| | `timetable_slots` | Weekly schedule (section, day, period, times, subject, teacher, room) |
| | `model_settings` | Each school's AI choices (STT provider/model, quiz model, default question count, bilingual) |
| Lessons | `lessons` | Each lecture: title, subject, language, status, audio file key and expiry, duration, **transcript and timestamped segments**, summary, takeaways, progress, failure reason, AI metadata, **quiz_request**, cached remedial plan, published date |
| | `questions` | Multiple-choice questions: position, question text, 4 options, correct option (0–3, enforced), explanation, translations, difficulty, topic, citation start/end seconds, status (draft/approved/rejected), edited-by-teacher |
| | `assignments` | Homework: standalone or attached to a lesson (one "main" assignment per lesson plus any number of extra ones). Title, instructions, rubric, minutes, due date, late policy, file settings, reminders, status |
| | `assignment_submissions` | Students' homework answers (one per student per assignment): text, late flag, rubric marks, total, feedback, graded/returned dates, stored AI suggestion |
| | `submission_files` | Files attached to a submission (name, type, size, storage key) |
| | `assignment_reminders` | Which reminder emails were sent, so none goes twice |
| | `quiz_attempts` | Each self-paced attempt (score, correct/total, when), with a duplicate-submission guard |
| | `quiz_attempt_answers` | Each answer, with a **snapshot** of the question as it was, so old results stay correct even if the quiz is regenerated |
| | `guardians` | Students' parent/guardian contacts |
| Live quiz | `live_sessions` | Each live game (PIN, status, time limit, current question, open/close times) |
| | `live_participants` | Students in a game (score, correct count) |
| | `live_answers` | Each live answer (selected option, revision count, points) |
| Devices | `devices` | Raspberry Pis (device ID, room, **hash** of the key, status, last heartbeat, IP, stats, revoked date) |
| | `device_enrollment_tokens` | One-time setup tokens (hashed, 24 h expiry) |
| | `device_commands` | Commands waiting for a Pi (start/stop), with expiry |
| | `recording_sessions` | Each classroom recording (device, lesson, status, expected chunks, times); **only one active recording per device** |
| | `recording_chunks` | Each uploaded 60-second chunk (number, fingerprint, size) |
| Accounts | `password_tokens` | Emailed set-password links (invite or reset); only a fingerprint (hash) of each link is stored, with its expiry and use |
| Exams | `exams` | Each secure exam: class, window, duration, questions per student, security settings, access code, status |
| | `exam_questions` | The frozen question pool of a published exam |
| | `exam_attempts` | One attempt per student per exam: their question set and order, deadline, extra minutes, a fingerprint of the device token, warning count, score |
| | `exam_answers` | Each saved answer |
| | `exam_events` | The integrity timeline: fullscreen exits, tab switches, copy/paste, second device… |
| Teacher tools | `courses`, `units` | Syllabus courses (imported from the catalog or made by hand) and their chapters |
| | `teacher_materials` | Teachers' uploaded PDFs, Word and text files, with their extracted text |
| | `teaching_resources` | Generated lesson plans, worksheets, question papers and presentations (content, status, shared flag) |
| | `simulation_links` | Simulation links a school's teachers added |
| Platform | `platform_admins` | Super admins: email, name, password hash, encrypted authenticator secret, recovery-code hashes, status |
| | `platform_settings` | Maintenance mode, banner, default AI models, AI price rates |
| | `audit_logs` | Who did what and when (kept 365 days) |
| | `app_logs` | A filtered copy of the application logs for the console (kept 14 days) |
| | `health_snapshots` | A health check every 5 minutes, for the history chart (kept 30 days) |
| | `ai_usage` | One row per AI call: school, purpose, model, tokens or audio seconds, success |
| | `email_log` | Outgoing emails: kind, school, delivery status and error. The recipient is stored only as a fingerprint (hash) |
| Notifications | `notifications` | "Your job is done" messages for one person (a school user or a super admin): kind, title, short text, link, read time. Kept 90 days once read, 180 days at most |
| | `push_subscriptions` | Phones and computers that accept push notifications for a person (the push service address, its keys, the browser name). At most 10 per person |

The `institutions` table also gained each school's **status** (active or suspended, with the reason), **feature switches**, **limits**, contact details and private notes. The `questions` table gained the **Bloom level** and **competency** tags.

### 11.3 Important rules enforced by the database
- **Uniqueness:**
  - one email per system;
  - one roll number per school;
  - one join code globally;
  - one active live PIN at a time;
  - one main assignment per lesson (extra assignments are allowed);
  - one exam attempt per student per exam;
  - one active recording per device.
- **Safety:** you **cannot delete**:
  - a teacher who owns lessons (disable them instead),
  - a section that has lessons,
  - a room that has devices.
- Deleting a school, a lesson and so on deletes its dependent records ("cascade").

### 11.4 Demo data (local development only)
`npm run db:seed` creates "Demo Public School" (code `DEMO`):
- admin `admin@demo.school`
- teachers `anita@demo.school` and `rahul@demo.school`
- students `10A-01`…`10A-05` and `10B-01`…`10B-03`
- 2 rooms, 2 sections, and a timetable

The demo passwords are listed in the README. The seed **refuses to run in production**.

---

## 12. The API (how the website talks to the server)

### 12.1 Conventions
- Every endpoint starts with `/api`. Requests and responses are **JSON**.
- **Authentication:** the `cp_session` cookie (browsers) or an `Authorization: Bearer <token>` header (scripts and tests).
- **Errors** always look like `{ "error": { "code": "…", "message": "…", "details": … } }`.

| Code | HTTP status | Meaning |
|---|---|---|
| `BAD_REQUEST`, `VALIDATION_FAILED` | 400 | Bad input; `details` lists the fields |
| `UNAUTHENTICATED` | 401 | Not signed in / session expired |
| `FORBIDDEN`, `PASSWORD_CHANGE_REQUIRED` | 403 | Not allowed / must change password first |
| `FEATURE_DISABLED`, `SCHOOL_SUSPENDED` | 403 | The console switched this feature off for the school / suspended the school |
| `MAINTENANCE` | 503 | Maintenance mode with school sign-ins blocked |
| `EMAIL_UNAVAILABLE` | 503 | Email isn't configured on this server, so a "Book a demo" request can't be sent (the form shows the email fallback) |
| `NOT_FOUND` | 404 | Doesn't exist, or you aren't allowed to see it |
| `CONFLICT`, `INVALID_STATE` | 409 | Duplicate, or the action isn't possible right now (e.g. "confirm to continue") |
| `PAYLOAD_TOO_LARGE` | 413 | Upload too big |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Not an audio file |
| `RATE_LIMITED` | 429 | Too many attempts |
| `UPSTREAM_FAILED` | 502 | The AI provider failed |
| `INTERNAL` | 500 | Unexpected server error (details are never exposed) |

### 12.2 Endpoint map (summary; full list in `docs/agents/api.md`)
| Area | Prefix | Who | Main actions |
|---|---|---|---|
| Health | `/api/health/live`, `/api/health/ready` | Anyone | Is the server up? Are the database, Redis and storage OK? |
| Status | `/api/status` | Anyone | The platform banner and maintenance message, for the sign-in pages |
| Public | `/api/public/demo-requests` | Anyone (school address only; same-origin JSON) | "Book a demo" from `/about`: emails the request to the fixed BenX inbox (`DEMO_REQUEST_TO`), never to the visitor. Nothing is stored |
| Auth | `/api/auth` | Anyone / signed in | `admin/login`, `teacher/login`, `student/login` (and the older `login`), `logout`, `me`, `change-password`, `forgot-password`, `set-password` |
| School | `/api/admin/institution` | Admin | View or update the school profile |
| Rooms, teachers, students, sections, timetable | `/api/admin/...` | Admin | Create, edit, delete; reset passwords; CSV import; rotate join codes; set rosters |
| AI settings | `/api/admin/settings/models` | Admin | Read or change models (validated against the dropdown lists) |
| Overview | `/api/admin/overview` | Admin | Dashboard numbers |
| Devices (admin) | `/api/admin/devices` | Admin | List devices, issue enrollment tokens, revoke |
| Teacher | `/api/teacher` | Teacher | Dashboard, my sections, my timetable |
| Lessons | `/api/lessons` | Teacher (admin read-only) | Create, edit, delete, **upload audio** (starts transcription), **transcribe** (retry), **generate** (count, difficulty, mode), publish/unpublish, approve all, add question, assignment, audio streaming, transcript, attempts, analytics, remedial plan |
| Questions | `/api/questions` | Teacher | Edit, approve, reject, delete |
| Recordings | `/api/recordings` | Teacher | List devices for a section, start, status, stop, cancel |
| Live sessions | `/api/live-sessions` | Teacher / student | Create, view, results; students look up a PIN |
| Assignments | `/api/assignments`, `/api/assignment-files` | Teacher (files: also the student who uploaded them) | Create, publish, close, submissions tracker, grade, AI suggestion, return |
| Exams | `/api/exams` | Teacher | Create, choose questions, publish, close, access code, live monitor, unlock, extra time, force-submit, results and CSV |
| Teacher tools | `/api/curriculum`, `/api/resources`, `/api/simulations`, `/api/insights` | Teacher | Catalog, courses, units, materials; generate, edit, share, export resources; voice prompts; simulations; class insights |
| Student | `/api/student` | Student | Dashboard, profile, sections, join by code, quizzes, submit attempt, latest result, assignments (with files), guardians |
| Student exams | `/api/student/exams` | Student | List, start (access code), save answers, report warnings, submit, result |
| Devices (Pi) | `/api/devices` | Pi (device key) | Register, heartbeat, commands, chunk upload, finalize |
| Notifications | `/api/notifications` | Anyone signed in to a school | The bell: list (newest first, paged), mark read / all read, push on or off, register or remove this phone/computer for push |
| Platform console | `/api/platform/...` | Super admin (console session) | Sign-in with authenticator, schools and admins, features and limits, users, settings, usage and cost, health, queues, logs, audit, deployments, own notifications (`/api/platform/notifications`) |

---

## 13. Security and privacy

### 13.1 Measures in place
| Area | Protection |
|---|---|
| Transport | HTTPS everywhere with a free, auto-renewed Let's Encrypt certificate (managed by Traefik/Coolify); HSTS header tells browsers to always use HTTPS |
| Passwords | bcrypt hashing (cost 12; 10 for bulk-imported initial passwords); never stored or logged in plain text; forced change of admin-issued passwords |
| Sessions | httpOnly, Secure, SameSite cookie; 12-hour lifetime; instant revocation on password change, reset or disable |
| Brute force | Rate limits on login, PINs, join codes, AI actions and device registration; same login response time for unknown accounts |
| Authorization | Every route checks the role. Teachers can only touch their own lessons and sections; students only their own classes, attempts and guardians; everything is scoped to the user's school. Another school's data appears as "not found". |
| Input | Every input is validated (zod); unknown fields are stripped; query strings can't contain nested objects |
| Files | Audio is addressed by internal keys, never by paths from the request, so a crafted request can't reach other files. Audio is streamed only to authorised users; nothing is publicly downloadable. |
| Devices | Single-use 24 h enrollment tokens; only key hashes are stored; constant-time comparison; revocation; outbound-only connections |
| Live quiz | Answer key hidden until close; identity from the cookie; server-side clock; cross-site connections refused |
| Exams | Answer key never sent to students; server-side clock; one attempt per student; optional access code and one-device lock; warnings logged with times |
| Platform console | Separate address (hidden on school addresses); password **plus authenticator code** for every sign-in; 10 single-use recovery codes; each code works once; 2-hour sessions; 5 sign-in attempts per 15 minutes; authenticator secrets encrypted with `PLATFORM_ENCRYPTION_KEY`; sign-ins and every change made in the console written to the audit log |
| Emailed links | Single-use, 72-hour expiry; only a hash is stored; a new link cancels older ones; "Forgot password?" answers the same whether or not the account exists |
| Uploads | Assignment files and teacher materials are checked by type and size and stored privately. A submission file can be opened only by the student who uploaded it or a teacher of that class |
| Headers | helmet security headers; nosniff; strict referrer policy; camera/geolocation disabled; microphone only for the site itself |
| Logs | Passwords, cookies, authorization headers, API keys and the database URL are automatically redacted; no student names in live-quiz logs |
| Secrets | Production settings validation requires a JWT secret of at least 32 characters, Redis, HTTPS, a valid `PLATFORM_ENCRYPTION_KEY`, no demo mode and no test email capture |
| Containers | Run as a non-root user; only the router is reachable from outside; database and Redis are private |
| Backups | Encrypted with `age`; the decryption key is kept **off** the server |
| Notifications | Each person sees and marks only their own (another person's is "not found"); the console's notifications need a console session. Push is sent only to known push services (Google, Mozilla, Microsoft, Apple), so a crafted address can't make the server call into a private network. Push addresses and keys are never logged (only a short fingerprint). Notification texts are short and contain no transcripts or marks |

### 13.2 Data retention and privacy
- **Lecture audio:** deleted automatically after **30 days**. Transcripts, questions and results are kept.
- **What AI providers see:** audio (Sarvam/Whisper); transcript text and lesson metadata (OpenAI). No student personal data.
- **Deleting a student** also deletes their attempts, answers, enrollments, live participation and guardians (cascade).
- **Logs** shown in the console are kept **14 days**; the **audit log** **365 days**; health snapshots 30 days. Passwords, codes, cookies and keys are never written to either.
- **Voice prompts** are transcribed and thrown away; the audio is never stored.
- **Notifications** are deleted **90 days** after being read and after **180 days** at most. Push subscriptions go when the push service says the device is gone, after 5 failed deliveries in a row, or after 120 days without a delivery. A student's data export includes their notifications and push devices (browser name and dates only); a school export includes notifications but never push addresses or keys.

### 13.3 Known security limitations (be honest about these)
- **Sign out** (school users) clears the cookie in the browser but does not revoke the token server-side. A stolen copy of a cookie would work until it expires (at most 12 hours) or until the password is changed. Console sign-out does revoke every console session.
- There is **no two-factor authentication** for school admins, teachers or students yet. Only super admins use an authenticator.
- **Password reset by email** needs email to be set up and the account to have an email address. Otherwise the admin resets passwords.
- The Coolify dashboard now has its own HTTPS address (`https://coolify.benxsolutions.in`), but the old unencrypted address `http://129.159.227.74:8000` still answers until public port 8000 is closed (see 14.9).

---

## 14. Deployment and infrastructure (production)

### 14.1 The server
| Item | Value |
|---|---|
| Provider | **Oracle Cloud Infrastructure (OCI)**, tenancy "benxsolutions" |
| Instance | `benx`, shape **VM.Standard.A1.Flex** (ARM64 / Ampere), **2 OCPU, 12 GB RAM**, 193 GB disk |
| OS | Ubuntu 24.04 LTS |
| Public IP | `129.159.227.74` |
| Extras | 4 GB swap file added (for building); `age` installed; Tailscale/WireGuard present (pre-existing) |
| Private IP | `10.0.0.112` (inside Oracle's private network, the "VCN"; used by the console to reach Coolify) |
| Login | SSH as `ubuntu` with the private key file `ssh-key-2026-07-19.key` (kept off GitHub). SSH accepts **keys only** (password sign-in is off) |
| Firewall | OCI **Security List** (the cloud firewall) allows SSH 22, HTTP 80, HTTPS 443 and Coolify 8000 (8000 should now be closed; see 14.9) |

### 14.2 Coolify
- **What it is:** a self-hosted control panel (like a private Heroku/Vercel) running on the same server, version 4.4.3, at **`https://coolify.benxsolutions.in`** (sign in with the Coolify account `admin@benxsolutions.in`). New sign-ups ("registration") are switched off, so nobody else can create an account. It:
  - pulls the code from GitHub,
  - builds the Docker images on the server,
  - runs them,
  - manages HTTPS certificates (via its **Traefik** proxy) and environment variables,
  - keeps a deployment history.
- **Project:** "ClassPulse" → environment "production" → application **classpulse** (internal ID `bmbcqf7x63jjpirzhi8tzsby`).
- **Source:** the private GitHub repo `NINJA981/classpulse`, branch `main`, compose file `/infra/docker-compose.coolify.yml`. Coolify pulls with a **read-only deploy key** (an SSH key that can only read this one repository).
- **Build pack:** Docker Compose.
- **The Coolify API:** Coolify can also be controlled by programs through its API, using an **API token** (a long secret that works like a password with limited permissions). Two things use it:
  - the console's **Deployments** page, which talks to Coolify over the server's **private** address, `http://10.0.0.112:8000/api/v1`, so that traffic never leaves the server's private network;
  - deploys started from the owner's computer, through `https://coolify.benxsolutions.in/api/v1`.
- **Allowed IPs for API access** (Coolify → Settings): Coolify only accepts API calls from the addresses on this list. It holds:
  - `10.0.0.0/16`, the private network range. This is **required**: the API container calls Coolify from an internal Docker address (for example `10.0.5.5`), and without this range the Deployments page is refused;
  - `127.0.0.1` (the server itself);
  - the owner's **home IP address**, for deploys from the owner's computer. Home IP addresses can change; when it does, deploys from home are refused until the new address is added to the list.

### 14.3 Domains and HTTPS
All three addresses are **live**:

| Address | What it is |
|---|---|
| `https://classpulse.benxsolutions.in` | The school site (admins, teachers, students). `/platform` answers "Not found" here |
| `https://ops.benxsolutions.in` | The platform console (super admins only). `/` goes straight to `/platform`; school pages answer "Not found" here |
| `https://coolify.benxsolutions.in` | The Coolify dashboard |

- **DNS:** at **GoDaddy** (the DNS provider for `benxsolutions.in`) there are three **A records**, `classpulse`, `ops` and `coolify`, each pointing to the server, `129.159.227.74`.
- **Coolify settings that go with them:** the **router** service has both app domains (`https://classpulse.benxsolutions.in,https://ops.benxsolutions.in`); `PUBLIC_ORIGIN` is `https://classpulse.benxsolutions.in`, `PLATFORM_ORIGIN` is `https://ops.benxsolutions.in` and `PLATFORM_HOST` is `ops.benxsolutions.in`. If a domain ever changes, change all of these together and redeploy.
- **The old addresses are retired:** the temporary `classpulse.129.159.227.74.sslip.io` and `ops.129.159.227.74.sslip.io` addresses (**sslip.io** is a free service that turns an IP address into a hostname) now answer with an error (503). Update any old bookmarks or printed links.
- **Why the console has its own address:** on the school address, `/platform` simply answers "Not found", so nobody browsing a school can even find the console. On the console address, nothing except the console is served.
- **Certificates:** free Let's Encrypt certificates, issued and renewed automatically by Traefik for all three addresses. It needs port 80 open; that's why opening port 80 in the OCI Security List was required.

### 14.4 The production containers
Seven services, all built from this repository (`infra/docker-compose.coolify.yml`):

| Service | Image | Role | Notes |
|---|---|---|---|
| `router` | Caddy 2 (with our Caddyfile baked in) | Sends `/api` and `/socket.io` to `api`, everything else to `web`; serves the console only on `PLATFORM_HOST` | The only service with public domains (the school address and the console address). Upload limit 400 MB on the audio upload URL, 25 MB elsewhere. 120 s read timeout (Pi long-polls) |
| `web` | Node 22 (Next.js standalone build) | Serves the pages | Keep-alive 75 s |
| `api` | Node 22 + ffmpeg | The API + Socket.IO | **Runs database migrations on every start**, then the server. Health check `/api/health/live`. Reads the server's backup folder (`/var/backups/classpulse`, mounted read-only at `/backups`) so the console can check backup age |
| `worker` | Same image as api | Background jobs: the `lesson-generation`, `email` and `resources` queues, plus timed tasks (audio retention, device sweep, exam sweep, assignment reminders, log and audit clean-up, health snapshots, notification clean-up) | Starts after the API is healthy |
| `postgres` | postgres:16-alpine | Database | Data in volume `pg-data` |
| `redis` | redis:7-alpine | Queue, rate limits, messages | Password-protected; append-only persistence; volume `redis-data` |
| (volume) `storage-data` | — | Lecture audio files | Shared by api and worker |

**Traffic path:** Internet → Traefik (HTTPS, port 443) → `router:80` → `api:5000` or `web:3000`. Traefik's timeouts were raised to **600 seconds** so long lecture uploads aren't cut off (the default was 60 s).

### 14.5 Environment variables (production settings in Coolify)
> **Watch out:** Coolify's Environment Variables page has two sections, **Production** and **Preview Deployments**. ClassPulse reads only the **Production** ones. A value put under "Preview Deployments" is silently ignored. This happened once with the email settings, and email stayed off until they were moved. After changing any variable, **redeploy** so the containers pick it up.

| Variable | Purpose |
|---|---|
| `PUBLIC_ORIGIN` | The site's public address (used for security checks): `https://classpulse.benxsolutions.in` |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` | Randomly generated secrets |
| `SARVAM_API_KEY`, `OPENAI_API_KEY` | AI provider keys |
| `AUDIO_RETENTION_DAYS` | 30 |
| `GENERATION_CONCURRENCY` | 1 (one AI job at a time on this 2-CPU server) |
| `LOG_LEVEL` | info |
| `PLATFORM_ENCRYPTION_KEY` | **Required.** A random key (32 bytes, base64; made with `openssl rand -base64 32`) that locks the super admins' authenticator secrets. The deploy fails without it. **Keep a copy in the password manager:** if it is lost or changed, every super admin must set up their authenticator again (section 15.5.1) |
| `PLATFORM_HOST` | The console's host name, `ops.benxsolutions.in` (no `https://`). Used by the router. The same domain must also be added to the `router` service's domains in Coolify. If it is missing, the console is hidden everywhere |
| `PLATFORM_ORIGIN` | The console's full address, `https://ops.benxsolutions.in`. Used by the API's security checks |
| `COOLIFY_API_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID` | For the console's **Deployments** page (all set in production):<br>• `COOLIFY_API_URL` is the server's **private** address, `http://10.0.0.112:8000/api/v1`, so the traffic stays inside the server's private network. This keeps working after public port 8000 is closed.<br>• `COOLIFY_API_TOKEN` is a token named **classpulse-console** with only the **read** and **deploy** permissions (the least it needs).<br>• `COOLIFY_APP_UUID` is the app's ID (section 14.2).<br>Coolify must also allow API calls from `10.0.0.0/16` (section 14.2). Coolify only shares **build logs** with tokens that also have **read:sensitive**; without it, the Deployments page says the log is hidden and you read it in Coolify. Adding read:sensitive is optional and gives the token slightly more access. **Restart** should work with the deploy permission; if it answers with a permission error, add **write** to the token. Without these variables the page shows setup instructions |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Email for invitations, password resets and reminders. **Set up in production** with the GoDaddy mailbox `admin@benxsolutions.in`: `smtpout.secureserver.net`, port `465` (SSL), that mailbox and its password, and `MAIL_FROM` = `ClassPulse <admin@benxsolutions.in>`. A test email was accepted. **When the mailbox password changes, update `SMTP_PASS` (in Production) and redeploy**, or email stops.<br>**Daily cap:** GoDaddy mailboxes send at most roughly 250–300 emails a day (check your plan). Importing a large class with emailed invitations can hit this; the rest then fail and can be retried the next day from the console (Health → `email` queue). If that becomes a problem, switch to a sending service such as Amazon SES or Brevo.<br>The other working choice is **Gmail**: `smtp.gmail.com`, port `465`, the Gmail address, and a Gmail **App password** (needs 2-Step Verification); send from that Gmail address.<br>**Do not** send as `@benxsolutions.in` through Gmail: the domain's SPF record (the list of servers allowed to send its mail) only allows GoDaddy, so those emails would fail the check and go to spam or be rejected |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | **Optional:** phone/desktop push notifications ("your lesson is ready"). Make the pair once with `npx web-push generate-vapid-keys` and set both keys in Coolify (Production); `VAPID_SUBJECT` defaults to `mailto:admin@benxsolutions.in`. While `VAPID_PRIVATE_KEY` is empty, push is off and only the in-app bell and pop-ups work. **Keep the same pair:** a new pair stops push on every device that had it turned on until each person turns it on again. A half-set or malformed pair stops the API from starting |
| `BACKUP_DIR` | Where the API looks for backups inside its container (default `/backups`; leave as is) |
| Set in the compose file | `NODE_ENV=production`, `TRUST_PROXY_HOPS=2` (Traefik + Caddy), `STORAGE_DIR=/data/storage`, database/Redis URLs built from the passwords, and the read-only backup mount `/var/backups/classpulse:/backups:ro` on the api service |

The full list of variables the API understands (with defaults) is in `apps/api/src/config/env.ts`. Important ones: `PORT` 5000, `SESSION_TTL_HOURS` 12, `MAX_AUDIO_UPLOAD_MB` 300, `LOGIN_RATE_LIMIT` 10, `DEVICE_OFFLINE_AFTER_SEC` 90, `PIPELINE_DEMO_FALLBACK` (forbidden in production).

### 14.6 How a new version is deployed
1. A developer commits code and pushes to `main` on GitHub. From this computer that uses the **write deploy key**, because the GitHub CLI login lacks the "workflow" permission.
2. A deploy is started **by hand**, in one of three ways: **Coolify → classpulse → Deploy/Redeploy**, the console's **Deployments → Redeploy**, or the Coolify API (`POST /api/v1/deploy`, through `https://coolify.benxsolutions.in/api/v1` from the owner's computer). **Pushing to GitHub does not deploy anything** (no webhook is set up).
3. Coolify clones the repo, builds the images (about 1.5–3 minutes once cached; the first build took about 3 minutes), and starts the new containers. The API applies any new migrations on start.
4. Check: `https://classpulse.benxsolutions.in/api/health/ready` should return `{"status":"ok"}`.

**Expect a short outage on every deploy.** Coolify replaces **all** the containers each time, so the site answers with an error (503) for about **30–60 seconds** while they restart. Deploy **outside class hours**, never during a live quiz or an exam.

**Rollback:** in Coolify → Deployments, redeploy an earlier commit. Migrations only go forward, so roll back only to commits with the same database structure.

### 14.7 Alternative deployment (without Coolify)
`infra/docker-compose.prod.yml` runs the same stack on any Ubuntu server, with **Caddy doing HTTPS itself**:
- Fill in `infra/.env`, then run `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build`.
- A one-shot `migrate` container applies migrations first.
- `docs/agents/deployment.md` has step-by-step instructions.

### 14.8 Where the secrets are (no values here)
| Secret | Where it lives |
|---|---|
| Production database/Redis passwords, JWT secret, AI keys | Coolify → classpulse → Environment variables (only) |
| Local development keys | `apps/api/.env` on the developer's PC (gitignored) |
| Server SSH key | `ssh-key-2026-07-19.key` in the project folder on the owner's PC (gitignored); keep a safe copy |
| GitHub deploy keys | Private halves in the session scratch folder on the owner's PC; public halves in GitHub → repo → Settings → Deploy keys ("local push", "Coolify (read-only)") |
| Coolify API tokens | Created in Coolify → Keys & Tokens. The console's token, **classpulse-console** (read + deploy only), lives only in Coolify's environment variables (`COOLIFY_API_TOKEN`, Production). The older all-powerful ("root") token **should be deleted** now that the new one works |
| `PLATFORM_ENCRYPTION_KEY` | Coolify → classpulse → Environment variables, **plus a copy in the owner's password manager** |
| Web Push private key (`VAPID_PRIVATE_KEY`) | Coolify → classpulse → Environment variables (Production), plus a copy in the owner's password manager. Never in the repository; the development pair lives only in `apps/api/.env` |
| Email password (`SMTP_PASS`: the password of the GoDaddy mailbox `admin@benxsolutions.in`) | Coolify → classpulse → Environment variables (Production). Update it there and redeploy whenever the mailbox password changes |
| Super admin passwords, authenticator apps and recovery codes | Each super admin: password manager for the password, the authenticator app on their phone, and the 10 recovery codes saved somewhere safe (password manager or a printed copy) |
| Backup decryption key (`classpulse-backup.key`) | **Owner only**, off the server (password manager). Without it, backups cannot be restored. |
| Coolify admin login, Oracle Cloud login | The owner. **Change them**: they were shared in a chat. |

### 14.9 Hardening: the owner's to-do list
**Already done:** the site, console and Coolify dashboard are on `benxsolutions.in` addresses with HTTPS; Coolify registration is switched off; SSH accepts keys only (password sign-in is off); the console uses a least-privilege Coolify token.

**Still to do:**
- **Coolify 2FA:** turn on two-factor sign-in for the Coolify account (`admin@benxsolutions.in`).
- **Shared passwords:** change the passwords that were shared in a chat: Coolify, Oracle Cloud, and rotate the Sarvam key.
- **Old Coolify token:** delete the old root API token (Coolify → Keys & Tokens) now that `classpulse-console` works. If your computer's deploy commands still use the root token, create a separate deploy-only token for them first.
- **Close public port 8000** in the OCI Security List (and 6001–6002 and 8080 if they are open). This is now safe: the dashboard is on `https://coolify.benxsolutions.in`, deploys from your computer go through `https://coolify.benxsolutions.in/api/v1`, and the console reaches Coolify on the private address `10.0.0.112:8000`, which closing the public port does not affect.
- **Console key:** confirm `PLATFORM_ENCRYPTION_KEY` is saved in the password manager.
- **Optional:** stop `root` signing in over SSH even with a key (the `ubuntu` user plus `sudo` is enough), and install **fail2ban** (a tool that blocks addresses that keep guessing at SSH). Neither is in place yet.
- **Billing:** if the Oracle account is "Always Free", Oracle may reclaim instances that sit idle for 7 days. Upgrading to Pay-As-You-Go avoids this.

---

## 15. Day-to-day operations

### 15.1 Health and monitoring
- `GET /api/health/live` reports whether the server is running.
- `GET /api/health/ready` checks the database, Redis and storage. It returns **503** if any of them fails.
- **Recommendation:** point a free uptime monitor (for example UptimeRobot) at `/api/health/ready`.
- **The console is the easiest place to look** (section 15.5.5): Health (every component, alerts, history), Logs (live, last 14 days), Audit log, and Usage & costs.
- **Raw logs:** in Coolify → classpulse → Logs, or `sudo docker logs <container>` over SSH. They are JSON, with secrets hidden.

### 15.2 Backups
- **What:** a full database dump (`pg_dump`) plus all lecture audio, packed and **encrypted with `age`** using a public key. Only the owner's private key can decrypt it.
- **When:** every night at about **02:30 server time**. A **systemd timer** (`classpulse-backup.timer`; the server has no cron) starts the service `classpulse-backup.service`, which runs `/opt/classpulse/infra/backup.sh`. If the server was off at that time, it runs at the next boot.
- **Where:** `/var/backups/classpulse/daily/` (the last 7 nights) and `/weekly/` (the last 4 Sundays) on the server. Each archive is currently about **270 MB**. Off-site copy to S3/Oracle Object Storage is supported (`BACKUP_S3_URI`) but not configured yet.
- **How the console sees them:** the API container (which runs as the unprivileged user `node`) looks into the backup folder through a read-only connection (`/backups`) to report the age of the latest backup. `backup.sh` therefore keeps the folders open for listing (mode 755); the archives themselves stay readable by root only and are encrypted anyway. Before this was fixed (11 October), the console wrongly said "No daily backup found".
- **Config:** `/etc/classpulse/backup.env` (root only). It holds `COMPOSE_PROJECT=<Coolify app id>`, which lets the script find the containers.
- **Scripts:** `/opt/classpulse/infra/backup.sh` and `restore.sh`.
- **Tested:** a **restore drill** decrypted the backup with the offline key and restored it into a separate scratch database. Every table's row count matched the live database, and the 17 audio files were present.
- **Restore (real emergency):** `sudo ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/restore.sh <archive.tar.age> <your-age-key-file>`. It asks you to type `RESTORE`, stops the app, replaces the database and audio, and restarts.

### 15.3 Common admin tasks
| Task | How |
|---|---|
| Create a new school + its admin | **Console → Schools → New school** (section 15.5.2). The command-line way still works: SSH to the server, then run:<br>`API=$(sudo docker ps -q --filter label=com.docker.compose.project=bmbcqf7x63jjpirzhi8tzsby --filter label=com.docker.compose.service=api)`<br>`sudo docker exec $API node dist/scripts/createAdmin.js --email x@y --name "Name" --institution-name "School" --institution-code CODE`<br>It prints a one-time password. |
| Add another admin to an existing school | Console → the school → Admins → **Add admin** (or the same command with the existing `--institution-code`) |
| Create a super admin (console account) | On the server: `sudo docker exec -it $API node dist/scripts/createSuperAdmin.js --email you@benxsolutions.in --name "Your Name"` (section 15.5.1) |
| Switch a feature off for a school | Console → the school → **Features & limits** (section 15.5.3) |
| Pause a school (for example unpaid) | Console → the school → **Suspend** (section 15.5.4) |
| Announce maintenance | Console → Settings → Maintenance and banner (section 15.5.4) |
| Reset a teacher/student password | Admin console → Teachers/Students → Reset password |
| Disable a user | Admin console → edit → Account status: Disabled (signs them out everywhere) |
| Change AI models | Admin → AI settings |
| Deploy a new version | Coolify → classpulse → Redeploy, or console → Deployments → Redeploy. Outside class hours: the site is down for 30–60 s (section 14.6) |
| Check a failed lesson | Lesson page shows the reason; Coolify logs for the `worker` service show the details |

### 15.4 Incident playbook
| Symptom | What to do |
|---|---|
| Site down / `ready` returns 503 | Coolify → check which container is unhealthy; `df -h` on the server (disk full?); restart the service |
| Lessons stuck in "Queued" | Check the `worker` logs; restart the worker (stuck jobs are re-queued on start) |
| "Speech-to-text credentials were rejected" | The Sarvam key is invalid or expired. Update `SARVAM_API_KEY` in Coolify and redeploy, or switch to Whisper in AI settings |
| "Question generation failed" | Check the OpenAI key and quota; try again |
| Pi shows Offline | Pi troubleshooting table in `docs/agents/hardware-raspberry-pi.md`; the teacher can upload a phone recording instead |
| Student forgot password | Admin → Students → Reset password |
| Suspected account compromise | Disable the user (immediate sign-out everywhere), then reset the password |
| HTTPS certificate missing after a firewall change | Restart Coolify's proxy (Servers → Proxy → Restart) so Let's Encrypt retries |
| A super admin lost their phone (authenticator) | Sign in with one of the recovery codes (each works once). To move to a new phone, the account has to be created again (section 15.5.1, "Lost phone or lost key") |
| Console sign-in says two-factor is "not configured" | `PLATFORM_ENCRYPTION_KEY` is missing on the API. Set it in Coolify and redeploy |
| `/platform` shows "Not found" | You are on the school address. Use the console address (`PLATFORM_HOST`). If that also fails, check `PLATFORM_HOST` is set and the domain is on the `router` service |
| Invitation or reset emails don't arrive | Console → Health → **Email** and the `email` queue's failed jobs. Check that the `SMTP_*` settings are in Coolify's **Production** section (not "Preview Deployments"), that `SMTP_PASS` still matches the mailbox password, and the SPF advice in section 14.5. After a large import, the GoDaddy daily sending cap (about 250–300) may have been reached. Retry failed emails from the queue |
| The site shows an error (503) for a minute | A deploy is probably running: every deploy restarts all containers for 30–60 s. Wait, then reload. If it lasts longer, check Coolify |
| Console sign-in says "Too many attempts" | 5 tries in 15 minutes were used from your connection (for the code steps, everyone on the same connection shares the limit). Wait 15 minutes |
| Console → Deployments shows an error | Check Coolify → Settings → **Allowed IPs for API access** still includes `10.0.0.0/16`, and that the `classpulse-console` token still exists. A permission error on **Restart** means the token needs the **write** permission too (section 14.5) |
| Deploys from your computer are refused | Your home IP address has probably changed. Add the new one to Coolify's **Allowed IPs for API access** (section 14.2) |
| Console → Health says "No daily backup found" | Check the timer ran (`systemctl status classpulse-backup.service`) and that `/var/backups/classpulse` and its `daily` folder are mode 755 (`backup.sh` sets this on every run) |
| A teacher sees "…switched off for your school" | The console has that feature off for the school: Console → the school → Features & limits |
| "This school's monthly AI transcription minutes are used up" | The school reached its limit. Raise or clear it in Console → the school → Features & limits |
| A school's users see "Your school's access is paused" | The school is suspended. Console → the school → **Reactivate** |
| A teaching resource or email job failed | Console → Health → the queue's failed jobs → **Retry** |

### 15.5 The platform console: owner's guide
The platform console is where you, as the owner, run the whole service: add schools, switch features off, pause a school, and watch health, logs and costs. Section 6.5 lists every page; this section walks through the common jobs.

- **Address:** `https://ops.benxsolutions.in`. It opens the sign-in page, headed **"Super admin sign in"**, at `/platform/login`.
- **It is not on the school address.** `https://classpulse.benxsolutions.in/platform` answers "Not found" on purpose, and the console address doesn't serve school pages.
- **Who can use it:** only super admin accounts. School admins, teachers and students cannot sign in here. The owner's account is `saicharan312008@gmail.com`.
- **Look:** the console uses the same light design as the admin and teacher panels.

#### 15.5.1 Signing in for the first time (authenticator and recovery codes)
**Before you start:** install an **authenticator app** on your phone, for example Google Authenticator, Microsoft Authenticator or 1Password. It shows a new 6-digit code every 30 seconds for each account you add to it.

**Step 1: create your account (once, on the server).** Super admin accounts can only be created from the server's command line, never from a web page. (The owner's account, `saicharan312008@gmail.com`, was created this way; on its first sign-in it had to change the one-time password and set up the authenticator, as in Step 2. Use these steps for any further super admin.)
1. SSH to the server (section 22).
2. Run:
   ```bash
   API=$(sudo docker ps -q --filter label=com.docker.compose.project=bmbcqf7x63jjpirzhi8tzsby --filter label=com.docker.compose.service=api)
   sudo docker exec -it $API node dist/scripts/createSuperAdmin.js --email you@benxsolutions.in --name "Your Name"
   ```
3. It prints a **one-time password**, shown only once. Keep it for step 2. If it warns that `PLATFORM_ENCRYPTION_KEY` is not set, set that variable in Coolify and redeploy first (section 14.5).

On your own computer (development) the command is `npm run create-superadmin -- --email … --name …`.

**Step 2: first sign-in.**
1. Open the console address. Enter your email and the one-time password.
2. **Set up two-factor sign-in:** scan the QR code with the authenticator app. If you can't scan, type the **setup key** shown under it. Enter the 6-digit code the app now shows.
3. **Save your recovery codes:** you see **10 recovery codes** (they look like `abcd-2345`). Each one signs you in **once** if you lose your phone. They are shown **only now**. Click **Copy codes**, store them in your password manager or print them, then click **I've saved these codes**.
4. **Choose a new password** (at least 8 characters) to replace the one-time password.
5. You are in the console.

**Every sign-in after that:** email and password, then the 6-digit code from the app. To use a recovery code instead, click **Use a recovery code instead**.
- A console session lasts **2 hours**. **Sign out** ends every console session of your account.
- After 5 attempts in 15 minutes, sign-in is refused ("Too many attempts") until the 15 minutes are up. The password step counts per internet connection and email address. The authenticator-code and recovery-code steps count per connection only, so everyone signing in from the same connection shares that limit. If you are locked out, wait 15 minutes.

**New recovery codes:** Settings → My account → enter a current authenticator code → new codes. The old codes stop working.

**Lost phone or lost key:**
- **Phone lost, recovery codes safe:** sign in with a recovery code. To move to a new phone, re-create your account (below), because an account's authenticator can't be replaced from the console.
- **Phone and recovery codes both lost**, or **`PLATFORM_ENCRYPTION_KEY` lost or changed** (the key that locks every authenticator secret): re-create the account.
  1. Open the database shell on the server:<br>`sudo docker exec -it $(sudo docker ps -q --filter label=com.docker.compose.project=bmbcqf7x63jjpirzhi8tzsby --filter label=com.docker.compose.service=postgres) psql -U classpulse classpulse`
  2. Run `DELETE FROM platform_admins WHERE email = 'you@benxsolutions.in';`
  3. Repeat Step 1 and Step 2.

  Schools, users and the audit history are not affected. A lost key affects every super admin, which is why section 14.8 asks you to keep a copy of it.

**Tip:** an authenticator app with an encrypted cloud backup (several of the apps above offer one) avoids most lost-phone problems.

#### 15.5.2 Adding a school and its admin
1. Console → **Schools** → **New school**.
2. Fill in:
   - **School name**;
   - **School code**: 2–20 letters, digits or dashes, for example `BENX`. Students may need it to sign in;
   - time zone (default Asia/Kolkata) and academic year (for example `2026-27`);
   - the **admin's name and email**;
   - optionally a contact name, email and phone, and private notes.
3. Click **Create school**. The school is created with the default AI models from Settings and its first admin account.
4. A box shows the admin's **one-time password, once**. Copy it and send it to the admin securely. If email is set up, the admin also receives a **set-password link** by email (valid 72 hours), so they can choose their own password without the one-time one.
5. Tell the admin to sign in at `https://classpulse.benxsolutions.in/admin/login`. From there they add teachers, students and classes themselves (section 6.2).

**More admins later:** open the school → **Admins** → **Add admin**. The same tab lets you **reset** an admin's password, **resend** their invitation, or **disable** and re-enable them.

#### 15.5.3 Switching features off for a school (and setting limits)
Open the school → **Features & limits**.

**Feature switches** (all on by default). Untick, then **Save features**:

| Switch | What turns off |
|---|---|
| Exams | Secure exams for teachers and students |
| Assignments | Assignments and their file uploads |
| Live quiz | Live, game-style quizzes |
| Classroom devices (recording) | Raspberry Pi recorders and recording from the classroom (uploading a recording still works) |
| Email invitations | Emailed set-password invitations and reset links for that school; its admins hand out one-time passwords instead |
| AI grading | The "Suggest with AI" button on assignment grading |
| Teacher tools (materials, papers, presentations) | Courses & materials, AI teaching tools, simulations and class insights |

A switched-off feature **disappears from the school's menus** straight away, and its pages answer "… is switched off for your school." Nothing is deleted. Switch it back on and everything is still there.

**Limits** (leave a box empty for "no limit"). Click **Save limits**:

| Limit | What it does |
|---|---|
| Maximum students / Maximum teachers | New accounts and CSV imports are refused beyond this number (disabled accounts count too) |
| AI audio minutes per month | Transcription is refused once the school has used this many minutes this month (section 8.8) |
| Storage (GB) | A warning only; nothing is blocked |

#### 15.5.4 Suspending a school, maintenance and banners
- **Suspend:** open the school → **Suspend**, give a reason (it goes in the audit log), and type the school code to confirm. Every user of that school is signed out and sees "Your school's access is paused. Contact support." **No data is deleted.** **Reactivate** lets them back in straight away.
- **Maintenance mode** (Settings → Maintenance and banner): shows your message on every sign-in page and inside the app, for every school. Tick **Block school sign-ins and requests while in maintenance** to stop everyone using the app until you switch it off, for example during a risky upgrade.
- **Banner:** a one-line notice (info, warning or critical) shown to every school user, for example "New feature: secure exams".

#### 15.5.5 Where to see costs, logs and health
| You want to know… | Go to | What you see |
|---|---|---|
| Is everything working right now? | **Overview** (alerts) and **Health** | Each part (database, Redis, worker, API, disk, email, OpenAI, Sarvam, classroom devices, backups) as OK, degraded or down; the three job queues; a 24-hour to 30-day history chart. **Test OpenAI** / **Test Sarvam** check an AI provider key. Refreshes every 15 seconds |
| What needs attention? | **Overview → Alerts**, also on Health | Something down, failed jobs in a queue, a backup older than 26 hours, disk over 85% full, AI provider failures in the last hour, offline classroom devices |
| A job failed (email, teaching resource, lesson) | **Health → queues** | The failed jobs with their errors; **Retry** one or all, or remove one |
| What happened, technically? | **Logs** | A live tail of warnings, errors and notable requests, filterable by level, school and text; pause and resume; CSV download. Kept 14 days |
| Who did what? | **Audit log** | Sign-ins, school changes, feature switches, password resets, deployments, by whom and when; filters and CSV. Kept 365 days. Each school's own trail is also on its **Activity** tab |
| How much is it used, and what does AI cost? | **Usage & costs** | Choose dates, a school and day/week/month. Active users, quiz attempts, exams and homework, emails, AI calls and failures, tokens, audio minutes and **estimated AI cost (USD)**, with top schools and a per-model table. **Download CSV** (activity, schools or AI) |
| Are the cost figures right? | **Settings → AI price rates** | The prices used for the estimate, per model. Update them when OpenAI or Sarvam change prices. The providers' invoices are always the real bill |
| Which version is running? | **Deployments** | The deployed commit, recent deployments, **Redeploy** and **Restart** (type the word to confirm). Build logs appear only if the Coolify token has "read:sensitive"; otherwise read them in Coolify. A redeploy takes the site down for 30–60 s, so use it outside class hours (sections 14.5, 14.6) |

#### 15.5.6 Finding a person
Console → **Users**: type at least 2 characters of a name, email or roll number, optionally pick a role. Results show the school, role, status and last sign-in. Password resets for teachers and students are still done by the school's admin; you can reset a school **admin's** password from the school's Admins tab.

---

## 16. Running it on your own computer (development)

**Requirements:** Node.js 22+, Docker Desktop, Python 3.11+ (for the Pi agent tests).

```bash
npm install                          # download libraries
npm run dev:infra                    # start local PostgreSQL + Redis in Docker
cp apps/api/.env.example apps/api/.env          # then add SARVAM/OPENAI keys
cp apps/web/.env.example apps/web/.env.local
npm run build -w @classpulse/shared  # build shared definitions
npm run db:migrate                   # create tables
npm run db:seed                      # demo school + logins
npm run dev                          # API :5000, worker, web :3000
```
Open http://localhost:3000.

| Command | What it does |
|---|---|
| `npm run dev` | Runs everything with automatic reload on code changes |
| `npm run lint` | Code style / error checks |
| `npm run typecheck` | TypeScript checks |
| `npm test` | API tests (needs the local database) |
| `npm run test:agent` | Pi agent tests |
| `npm run test:e2e` | Full browser test (needs `npm run dev` running) |
| `npm run db:generate` | Create a new migration after changing the schema |
| `npm run create-admin -- --email … --name … --institution-code …` | Create an admin locally |
| `npm run create-superadmin -- --email … --name …` | Create a console (super admin) account locally. The console is at http://localhost:3000/platform; set `PLATFORM_ENCRYPTION_KEY` in `apps/api/.env` first (`openssl rand -base64 32`), or sign-in is refused |

---

## 17. Testing and quality: what was verified

### 17.1 Automated tests
| Suite | Count | What it covers |
|---|---|---|
| **API tests** (Vitest + supertest, real PostgreSQL) | **32 files, 410 tests**, all passing | Login and sessions (including the separate role sign-ins); the permission matrix for every role (rbac); admin CRUD; sections and join codes; lessons, uploads, size and type limits; generation modes and difficulty; publishing; questions; analytics and remedial; student quizzes (server-side grading, duplicate-submit protection); live-quiz sockets (30 simulated players, no answer leak, auto-close, reconnect, rebuild after restart); devices and recordings (including running the real Pi agent); health. **New:** emailed invitations and resets; assignments (files, rubrics, grading, AI suggestions, reminders, late policy); secure exams; curriculum and materials; teaching resources, question papers and presentations; simulations; class insights; the platform console (authenticator sign-in, schools, features and limits, suspension, maintenance, stats, health, logs, audit, deployments) |
| **Pi agent tests** (pytest) | **11 tests** | HTTPS required, registration, chunking, resume, retries, finalize, cancel, disk guard, end-to-end against a stub server |
| **Browser end-to-end** (Playwright) | **7 specs** | See the table below. |

**The Playwright specs** (`apps/web/e2e/`). Each runs against a running stack (`npm run dev` with the demo data, or the production stack via `E2E_BASE_URL`). The comment at the top of each file lists what it needs. Because the console and the school site have different addresses in production, the `platform` spec takes the console address in `E2E_BASE_URL` and the school address in `E2E_SCHOOL_URL`.

**Latest results on the live site (11–12 October 2026):** `full-flow` 7/7, `teacher-tools` 4/4, `platform` 6/6 (run on `ops.benxsolutions.in`), `student-tour` 2/2, and the 100-student live-quiz load test passed (0 join failures, 500/500 answers, p95 46 ms).

| Spec | What it checks | Needs |
|---|---|---|
| `full-flow` | (1) admin onboarding; (2) teacher uploads, then real transcription, then generates 5 Mixed questions; (3) edit, approve, publish; (4) students sign in, join by code, take the quiz; (5) live quiz with 2 students; (6) the **real Pi agent** records, is killed mid-class, restarts, uploads, then transcription and generation; (7) analytics. 7/7 passed on the live server and locally, with real AI | Real AI keys; a lecture recording at `.e2e-fixtures/lecture-150s.mp3` |
| `accounts` | Admin downloads the teacher CSV template, imports two teachers, each gets an invitation email, one sets a password from the link; then "Forgot password?" | The API started with `E2E_MAIL_CAPTURE=true`, which captures email instead of sending it (refused in production) |
| `exams` | A 5-question pool with 3 per student, access code and fullscreen; two students start; one leaves fullscreen and submits, the other is force-submitted from the monitor; the integrity timeline | Demo data only (no AI needed) |
| `assignments` | A standalone assignment with files and "allow late"; a student hands in text and a photo (flagged late); the teacher asks the AI for a suggestion, adjusts a mark and returns it; the student sees marks and feedback | Real AI; `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` |
| `platform` | Console first sign-in (one-time password, authenticator set-up, recovery codes, password change); create a school and its admin; the admin signs in; suspend (admin refused) and reactivate; a banner; the ops pages | A **freshly created** super admin: `E2E_PLATFORM_EMAIL` and `E2E_PLATFORM_PASSWORD` (the printed one-time password), and `PLATFORM_ENCRYPTION_KEY` on the API |
| `teacher-tools` | Import an NCERT course, generate a lesson plan and a presentation from one chapter, download them, share the plan, open a simulation in classroom mode | An OpenAI key, or `PIPELINE_DEMO_FALLBACK=true` in development (labelled demo content) |
| `student-tour` | The first-login tour opens on Home, steps forward and back, closes with Esc, Skip tour or Finish, stays closed after a reload, and restarts from Profile → "Take the tour again"; on a 390 px phone screen the card fits and points at the ☰ menu | A seeded student (demo data); it clears the browser's "seen" flag first |
| **Load test** | 100 students | Live server, over the internet: 100/100 joined (0 join failures), 500/500 answers, 0 dropped, p95 46 ms (latest run; an earlier run measured 42 ms) |
| **UI audit** | 58 page views | Every page × 3 roles × desktop and phone: no overflow, no console errors, no failed requests, and accessibility checks (axe-core) clean (the last two minor items were fixed and deployed) |
| **Backup/restore drill** | — | Encrypted backup restored; all table counts matched |
| **Real recordings** | 3 lectures | Tamil–English (22 min), English (11 min), Tamil (25 min): all transcribed and turned into good quizzes |

### 17.2 Continuous integration (GitHub Actions)
On every push to `main`:
1. **checks:** install, lint, typecheck, API tests against a fresh PostgreSQL, build the web app;
2. **agent:** Pi agent tests;
3. **images:** build both Docker images.

The browser test is run manually, since it needs real AI keys.

### 17.3 Bugs found by testing on the real server (all fixed)
| Bug | Cause | Fix |
|---|---|---|
| Teacher page stuck on "Generating" | Keep-alive timing race between the router and the server (Node closed idle connections after 5 s; Caddy reused them) | Server keeps connections 75 s; router drops them after 30 s |
| Uploads over ~24 MB rejected | The router applied two size rules in sequence | Made the rules mutually exclusive (400 MB for audio) |
| Nightly backup reported failure | The empty weekly folder made the clean-up step fail | Clean-up rewritten |
| 20-question quiz failed on a short lecture | The validator demanded exactly N questions | Per-question validation, trimming, top-up |
| "Mixed" produced no hard questions | Vague instruction | Explicit counts per difficulty |
| Phone pages wider than the screen | Hidden table label and grid sizing | CSS fixes across 30 layouts |
| English terms written in Tamil script | Sarvam "transcribe" mode | `codemix` mode |
| Citations spanning 20 minutes | Used the first-to-last cited block | First continuous run only |
| `.mp4` phone recordings rejected | Browsers label them "video" | Accept video/mp4 and video/mpeg (ffmpeg still checks the audio) |
| Students couldn't log in once a second school existed | Login needed the school | Roll number finds the school; the school code is asked only if ambiguous |
| Console said "No daily backup found" although backups existed | The API container (user `node`) couldn't list the root-owned backup folders | `backup.sh` keeps the folders mode 755; archives stay encrypted |
| Email stayed off after the SMTP settings were added | They were entered under Coolify's "Preview Deployments" section | Moved to the **Production** section and redeployed |
| Console's Deployments page refused by Coolify | Coolify's API allow-list didn't include the container's internal address | Added `10.0.0.0/16` to "Allowed IPs for API access" |
| Deployments page showed an empty build log | Coolify hides build logs from tokens without "read:sensitive" | The page now explains this and points to Coolify |

---

## 18. Project history and key decisions

| When | What happened |
|---|---|
| Before Oct 2026 | Four separate apps (`SIH-backend` with MongoDB, `SIH-admin`, `SIH-teacher`, `SIH-student`), originally from a hackathon-style project. An audit found demo-grade security (a master password `student123`, any OTP accepted, a default admin seeded in production, unprotected routes), fake AI fallbacks, a Pi agent that never recorded audio, and three inconsistent dashboards. |
| 10 Oct 2026 | **Rebuild:** merged into one monorepo with git history preserved. MongoDB replaced by PostgreSQL + Drizzle. One unified Next.js app with three areas. New API with real security. Real AI pipeline with no fake content. Real-time live quiz engine. Rewritten Pi agent. Docker production stack. Tests and CI. |
| 10 Oct 2026 | Sarvam key renewed; tested with three real classroom recordings; added `codemix` mode, better translations, tighter citations and phone-format uploads. |
| 10 Oct 2026 | **Deployment:** private GitHub repo; Coolify on Oracle Cloud; firewall opened; HTTPS; nightly encrypted backups; old leftovers (`admin_login` app, stray Redis) removed. |
| 10 Oct 2026 | Live UI audit and fixes (mobile overflow, accessibility). |
| 10 Oct 2026 | **Teacher-controlled quiz generation:** recordings transcribe automatically; the teacher chooses the number of questions and the difficulty; add/replace modes; model dropdowns in AI settings. |
| 11 Oct 2026 | Second school and admin (`admin2@benxsolutions.in`, BenX School 2) created. This handbook written. |
| 11 Oct 2026 | **Platform and teaching release** (commit `ceb780c`): the super admin **platform console** on its own address (authenticator sign-in, schools and admins, suspension, feature switches and limits, maintenance and banner, health, logs, audit, usage and AI cost, deployments); **separate sign-in pages** for admins, teachers and students; **teacher AI tools** (courses and materials, lesson plans, worksheets, question papers, presentations, voice prompts, Word/PowerPoint export, sharing, simulations, class insights, Bloom and competency tags); **secure exams**; **better assignments** (files, rubrics, AI-suggested grading, reminders, late policy); **emailed invitations and password resets**; CSV templates and teacher import; AI usage recording and a monthly AI audio limit per school; the **installable app**. |
| 12 Oct 2026 | Follow-ups since the 11 Oct release, all live and verified on 12 Oct. **Live on the real domains:** `classpulse.benxsolutions.in` (schools), `ops.benxsolutions.in` (console) and `coolify.benxsolutions.in` (Coolify), with Let's Encrypt certificates; the sslip.io addresses retired. The owner's super admin account created. **Email switched on** (GoDaddy mailbox `admin@benxsolutions.in`). The console's **Deployments** page connected to Coolify with a least-privilege token over the private network. Console sign-in and the whole console moved to the same light design as the school panels ("Super admin sign in"). The "Email invitations" switch is now enforced. Backup status fixed in the console. **Student first-login guided tour.** Coolify registration off and SSH key-only. A local speech-to-text benchmark (section 8.10). |

**Key decisions and why:**
- **Drizzle (not Prisma):** lighter and closer to SQL.
- **Self-hosted PostgreSQL in Docker:** cheaper and simple for the pilot; backed up nightly.
- **Fresh start (no data migration from MongoDB):** the old data was demo data.
- **Teacher starts/stops the Pi from the web app:** simple for teachers; the Pi only makes outbound connections.
- **Raw audio is private and auto-deleted after 30 days:** privacy.
- **Shared design system** (monochrome staff UI, playful yellow student theme): consistency, with a friendlier feel for students.
- **Coolify:** an easy web dashboard for deploys, domains and HTTPS on the owner's server.
- **The teacher picks the question count and difficulty:** teachers asked for control; it also avoids wasting AI calls on lectures nobody will quiz.

---

## 19. Known limitations and future work
- **Scale:**
  - Designed for a pilot: one server, one copy of each service.
  - Running several API copies would need the Socket.IO Redis adapter and shared live-quiz timers.
  - A 2-CPU server processes one AI job at a time.
- **No automatic deploy on push:** deploys are started by hand (section 14.6). A GitHub webhook could be added in Coolify.
- **Downtime on every deploy:** all containers are replaced, so the site is unavailable for about 30–60 seconds. Deploy outside class hours.
- **Speech-to-text has no real backup for Indian languages.** If Sarvam is down, the only fallback is OpenAI `whisper-1`, which refuses Bengali, Gujarati, Malayalam, Punjabi and Telugu and gets roughly 40–100% of the words wrong in the other Indian languages. So **non-English lectures effectively cannot be transcribed while Sarvam is down** (English still works). The planned fix is to run AI4Bharat IndicConformer ourselves as the fallback (section 8.10).
- **Email volume:** the GoDaddy mailbox sends at most roughly 250–300 emails a day (check the plan). A large student import with emailed invitations can exceed it. A sending service (Amazon SES, Brevo) is the option if that becomes a problem.
- **Security gaps:** no two-factor sign-in for school users (only super admins have it), password reset by email only when email is set up, and school logout doesn't revoke tokens server-side (section 13.3). Outstanding server hardening is listed in section 14.9.
- **Outside AI services:** quiz writing, grading and speech-to-text all use outside APIs (OpenAI, Sarvam). Running our own models is being researched but is not used in production (section 8.10).
- **Console alerts** appear on the console's Overview and Health pages only; nothing emails or messages you yet. An external uptime monitor is still recommended (section 15.1).
- **Cost figures** are estimates from editable price rates, not the providers' bills.
- **Push notifications:**
  - Need the VAPID keys set on the server; without them only the in-app bell and pop-ups work.
  - **iPhone and iPad** (iOS/iPadOS 16.4 or later) deliver push only when the site has been added to the Home Screen and opened from there; in Safari tabs it isn't offered.
  - A phone that is off or offline gets the push when it comes back online within a day; after that it is dropped (the bell still has it).
  - The console has no live connection, so its bell refreshes by polling; push works there as on the school site.
- **Unused feature flag:** SMS OTP login (`FEATURE_SMS_OTP`) is declared but not implemented.
- **Storage:** audio lives on the server's disk. The code has a placeholder for S3/Cloudflare R2 object storage.
- **Off-site backups:** not configured yet (`BACKUP_S3_URI`).
- **Language detection:** the teacher picks the lecture language. Sarvam can auto-detect, which could be added.
- **Translation quality:** Tamil translations by the smaller models are sometimes awkward. Try GPT-4.1 or GPT-4o in AI settings for better local-language quality.
- **Untested hardware:** the Pi agent hasn't yet been tested on a real Pi 5 with a real USB microphone. All tests used a WAV file as a stand-in for the microphone.

---

## 20. FAQ: questions you may be asked

### About the product
**Q: What does ClassPulse do, in one line?**
It turns a recorded lecture into a reviewed, bilingual multiple-choice quiz and an in-class live quiz game, with analytics for the teacher.

**Q: Does the AI publish quizzes by itself?**
No. AI writes drafts only. A teacher must approve questions and press Publish. Only approved questions reach students.

**Q: Can the teacher control the number of questions and the difficulty?**
Yes. 1–30 questions per request, and Easy/Medium/Hard/Mixed. They can add more questions later, replace only the ones they haven't approved, or start over (section 6.3.1, 8.4).

**Q: Which languages are supported?**
English plus ten Indian languages: Hindi, Tamil, Telugu, Kannada, Malayalam, Marathi, Bengali, Gujarati, Punjabi and Odia. Mixed speech (for example Tamil with English technical terms) is handled by Sarvam's `codemix` mode. Questions are always in English, with an optional translation in the lesson language.

**Q: Where do the questions come from? Can the AI make things up?**
They are generated only from the lecture transcript. The AI is instructed to use only facts stated in the lecture, and each question cites the transcript blocks that prove its answer. Teachers can click the timestamp to hear that part. Teachers review everything before publishing.

**Q: What if the lecture is too short for the number of questions requested?**
The system asks the AI again for the missing ones (up to 2 times). If the lecture really doesn't support more, the teacher gets what was possible (at least 3), and can add questions by hand.

**Q: How long does it take?**
Transcription is about 15–70 seconds for a 10–25 minute lecture. Quiz writing is about 10–40 seconds. Measured on the live server.

**Q: Can students cheat in the live quiz?**
The correct answer is never sent to students before the question closes. Identity comes from their login, timing is measured by the server, and late answers are rejected.

**Q: How many students can join a live quiz?**
It was tested with 100 simultaneous students over the internet on the live site: no failed joins, zero dropped answers, and 95% of answers confirmed within 46 ms (latest run, 11–12 October 2026).

**Q: How do students learn their way around?**
The first time a student opens Home, a short guided tour shows each part of the student area, including how to install the app on their phone. It skips features the school has switched off and can be replayed from Profile (section 6.4.1).

**Q: Can a student retake a quiz?**
Yes, self-paced quizzes can be retaken any number of times. Analytics use each student's latest attempt.

**Q: What do teachers see after a quiz?**
Per-question accuracy (Critical / Moderate / Mastered), answer distributions, each student's score, and an optional AI remedial plan.

**Q: Is there homework?**
Yes. Each lesson gets an AI-drafted assignment with a rubric, which the teacher can edit, and teachers can create more assignments, attached to a lesson or standalone. Students hand in text and, if allowed, photos or files. Late work is accepted and marked late, or refused, as the teacher chooses. The teacher can ask the AI to suggest marks and feedback, but always reviews them before returning the work (section 6.3.2).

**Q: Can teachers run proper exams?**
Yes, secure timed exams: each student gets their own shuffled set of questions, an optional access code read out in the room, fullscreen and one-device rules, warnings for tab switching, a live monitor, and results with an integrity timeline (section 6.3.3).

**Q: What else can the AI do for teachers?**
Lesson plans, worksheets, question papers (with a blueprint, Bloom levels, internal choice and an answer key) and slide presentations, based on the syllabus and the teacher's own notes and recorded lessons. They download as Word or PowerPoint, and can be shared with other teachers in the school (section 6.3.4).

**Q: Why are there separate sign-in addresses for admins, teachers and students?**
Each role has its own page: `/admin/login`, `/teacher/login` and `/student/login`. `/login` is just a chooser that links to the three. Separate pages:
- keep each page simple: students see only "roll number and password", staff only "email and password";
- let a school print or bookmark the right link for each group (for example the student link on a classroom poster);
- accept only their own role, so a teacher can't land in the admin area by using the wrong page. A wrong page simply says "invalid email or password" and links to the other two.

Super admins use a fourth, completely separate address (the platform console), which schools never see (section 15.5).

**Q: Can people reset their own password?**
Yes, if email is set up and the account has an email address: **Forgot password?** on the sign-in page sends a link that works once, within 72 hours. Otherwise the school admin resets it (section 5.4).

**Q: Can parents be contacted?**
Students can store guardian contacts with a "send progress updates" flag. Sending messages (SMS/email) is not built yet.

### About the hardware
**Q: Why a Raspberry Pi and not just the teacher's phone?**
The Pi stays in the classroom, starts and stops from the web app, uses a better microphone, and keeps recording through Wi-Fi drops. A phone recording can always be uploaded instead.

**Q: What happens if the Wi-Fi drops during class?**
The Pi keeps recording to its SD card and uploads when the network returns. It never deletes audio that hasn't been uploaded.

**Q: Does the school need to open firewall ports for the Pi?**
No. The Pi only makes outbound HTTPS connections (port 443).

**Q: How is a Pi added securely?**
With a single-use enrollment token from the admin console that expires in 24 hours. The Pi gets its own secret key; the server stores only a hash of it. A lost Pi can be revoked.

### About technology
**Q: What is the tech stack?**
TypeScript everywhere:
- Next.js 16 / React 19 / Tailwind for the website;
- Express 5 + Socket.IO for the server;
- PostgreSQL 16 (Drizzle ORM) for data, and Redis + BullMQ for background jobs;
- Sarvam AI / OpenAI Whisper for speech-to-text, and OpenAI GPT models for quiz writing;
- Python for the Raspberry Pi;
- Docker, deployed with Coolify on Oracle Cloud.

See section 3.

**Q: Why is there a "worker"?**
AI tasks are slow. The worker does them in the background so the website stays fast, and retries them automatically if something fails.

**Q: What is Redis used for?**
The background job queue, login rate limiting, and passing progress messages from the worker to the teacher's browser.

**Q: What is a "monorepo"?**
All code in one repository, so the website and server share the same data definitions and can't disagree.

**Q: Is it mobile-friendly?**
Yes. Every page was audited at phone width (390 px) with no horizontal scrolling. The student area is designed mobile-first.

**Q: Is it accessible?**
Pages were audited with axe-core (an automated accessibility checker): labels, landmarks, contrast, keyboard access and tap-target sizes.

**Q: Could ClassPulse run its AI on its own servers instead of OpenAI and Sarvam?**
That is the long-term goal, and it is being researched; production stays on the outside services for now. The plan is in `docs/agents/research/local-models-rnd.md`. A first real test of self-hosted speech-to-text (`docs/agents/research/stt-benchmark-2026-10-12.md`) found that Sarvam is still the most accurate. The best free model, AI4Bharat IndicConformer, comes close on clean Indian-language speech and needs no graphics card, but struggles with noisy classroom audio that mixes in English. The next step is to collect 3–5 hours of hand-checked classroom recordings to measure and train on (section 8.10).

**Q: What happens if Sarvam (the speech-to-text service) is down?**
English lectures can still be transcribed with OpenAI Whisper (switch in Admin → AI settings). Lectures in Indian languages effectively can't be until Sarvam is back, because Whisper refuses five of them and is very inaccurate on the rest. A self-hosted fallback is planned (section 19).

### About security and privacy
**Q: How are passwords stored?**
They are hashed with bcrypt and never stored or logged in plain text. Admin-issued passwords must be changed at first login.

**Q: Can a teacher see another teacher's lessons?**
No. Teachers only see their own lessons and sections. Schools can't see each other's data at all.

**Q: Is the audio kept forever?**
No. It is deleted automatically after 30 days. Transcripts and quiz results are kept.

**Q: Is student data sent to OpenAI?**
No student personal data. OpenAI receives the lecture transcript and lesson details; Sarvam receives the audio.

**Q: Is there two-factor sign-in?**
For super admins, yes: every console sign-in needs a 6-digit code from an authenticator app, with 10 single-use recovery codes as a backup. School admins, teachers and students sign in with a password only (section 13.3).

**Q: Is the site encrypted?**
Yes. HTTPS with a Let's Encrypt certificate, plus HSTS, on all three addresses: the school site, the console and the Coolify dashboard. The old unencrypted Coolify port (8000) should still be closed (section 14.9).

**Q: What if the server dies?**
Encrypted backups run every night (7 daily and 4 weekly copies). A restore was tested successfully. Off-site copies are recommended next.

### About deployment and costs
**Q: Where is it hosted?**
On an Oracle Cloud ARM server (2 CPUs, 12 GB RAM) in the benxsolutions tenancy, managed with Coolify.

**Q: How do you release an update?**
Push the code to GitHub, then click Redeploy in Coolify (or in the console's Deployments page); pushing alone doesn't deploy. It builds and restarts in a few minutes, and database changes apply automatically. The site is down for about 30–60 seconds while the containers restart, so deploy outside class hours.

**Q: What does it cost to run?**
The server is an Oracle Cloud instance. Ongoing variable costs are the **AI API usage**: Sarvam per minute of audio, and OpenAI per quiz, teaching resource or grading suggestion. ClassPulse now records every AI call, and the console's **Usage & costs** page shows an **estimate** per school and per model, in US dollars, from the price rates in console Settings (section 15.5.5). The providers' invoices are the real bill; keep the rates in Settings up to date.

**Q: Can one school's AI use be capped?**
Yes. Console → the school → Features & limits → **AI audio minutes per month**. Once used up, new transcriptions are refused until the next month (section 8.8).

**Q: Can it handle more schools?**
Yes, it is multi-tenant: create a school in the console (Schools → New school, section 15.5.2). A single server is sized for a pilot. Larger scale needs more worker capacity and the scaling steps in section 19.

**Q: Can we switch a feature off for one school, for example on a cheaper plan?**
Yes. Console → the school → Features & limits: exams, assignments, live quiz, classroom devices, AI grading and teacher tools can each be switched off per school, and students and teachers can be capped (section 15.5.3).

**Q: Who can log in to the server?**
Whoever has the SSH key file (`ubuntu` user) or the Coolify admin login. The platform console is separate: only super admin accounts, each with its own authenticator.

---

## 21. Glossary
| Term | Meaning |
|---|---|
| **API** | The server's set of URLs that the website (and the Pi) call to do things |
| **Audit log** | A permanent-style record of who did what and when (kept 365 days here) |
| **Authenticator app** | A phone app (Google Authenticator, Microsoft Authenticator, 1Password…) that shows a new 6-digit sign-in code every 30 seconds |
| **Backend / frontend** | Server-side code / what runs in the browser |
| **bcrypt** | A deliberately slow password-hashing method that makes stolen password databases hard to crack |
| **Bloom's taxonomy** | Six levels of thinking a question can test: remember, understand, apply, analyse, evaluate, create |
| **BullMQ** | A job queue library built on Redis |
| **Caddy** | A web server/router; ours forwards requests to the API or the web app |
| **CI** | Continuous Integration: automatic checks run on every code push |
| **Code-mixed speech** | Speech mixing languages, e.g. Tamil sentences with English technical words |
| **Container / Docker** | A packaged app with everything it needs, so it runs the same anywhere |
| **Coolify** | A self-hosted dashboard that deploys apps from GitHub onto your own server |
| **Cookie (httpOnly)** | A small value the browser stores and sends back; httpOnly means page scripts can't read it |
| **CRUD** | Create, Read, Update, Delete |
| **Deploy key** | An SSH key that grants access to one GitHub repository only |
| **DNS / A record** | The internet's phone book; an A record maps a name (classpulse.benxsolutions.in) to an IP address |
| **Drizzle ORM** | A library for talking to the database from TypeScript safely |
| **E2E test** | End-to-end test: a robot browser clicks through the real app like a user |
| **Enrollment token** | A one-time code used to register a Raspberry Pi |
| **Environment variables** | Settings given to a program at start-up (passwords, keys, options) |
| **Feature switch** | A per-school on/off setting in the console that hides and blocks one feature |
| **Grounding** | Giving the AI the teacher's own material (syllabus, notes, lecture transcripts) so its output is based on it |
| **ffmpeg** | A tool for converting and measuring audio/video files |
| **Health check** | A URL that reports whether the service is working |
| **HSTS** | A header telling browsers to always use HTTPS for this site |
| **Idempotent** | Doing it twice has the same effect as doing it once (safe to retry) |
| **JWT** | JSON Web Token: a digitally signed login token |
| **Keep-alive** | Reusing a network connection for several requests |
| **Let's Encrypt** | A free authority that issues HTTPS certificates |
| **LLM** | Large Language Model, e.g. GPT-4.1 mini, which writes the quiz |
| **Long-polling** | The client asks "anything new?" and the server holds the request until there is (or a timeout) |
| **Migration** | A versioned change to the database structure |
| **Monorepo** | One repository containing several apps/packages |
| **Multi-tenant** | One installation serving many separate schools |
| **Next.js / React** | Frameworks for building the website |
| **OCI** | Oracle Cloud Infrastructure |
| **p95** | 95th percentile: 95% of measurements were at or below this value |
| **PCM / WAV** | Raw digital audio / a common audio file format containing PCM |
| **PhET** | Free interactive science and maths simulations from the University of Colorado Boulder |
| **Platform console** | The owner's control room at `/platform` on its own address, for super admins only |
| **PostgreSQL** | The database system |
| **PWA** | Progressive Web App: a website that can be installed like an app |
| **Rate limiting** | Capping how many attempts are allowed in a time window |
| **RBAC** | Role-Based Access Control: what each role may do |
| **Recovery code** | A single-use backup code (like `abcd-2345`) that signs a super admin in without their phone |
| **Redis** | A very fast in-memory data store |
| **Reverse proxy** | A server in front of other servers that forwards requests (Traefik, Caddy) |
| **SHA-256** | A fingerprint of data; any change gives a different fingerprint |
| **SMTP** | The standard way programs send email through a mailbox provider (Gmail, GoDaddy) |
| **Socket.IO / WebSocket** | A persistent two-way connection for real-time features |
| **SPF** | A DNS record listing which mail servers may send email for a domain; mail from other servers is treated as suspicious |
| **sslip.io** | A free service turning an IP into a hostname (e.g. classpulse.129.159.227.74.sslip.io). ClassPulse used it before the real `benxsolutions.in` addresses; those old addresses no longer work |
| **STT** | Speech-to-text (transcription) |
| **Structured outputs** | Forcing the AI to reply in an exact data format |
| **Super admin** | A ClassPulse operator account for the platform console, above all schools |
| **systemd / timer** | Linux's service manager / its scheduler (used instead of cron) |
| **TLS / HTTPS** | Encryption for web traffic |
| **TOTP** | Time-based one-time password: the 6-digit codes an authenticator app shows |
| **Traefik** | Coolify's reverse proxy that handles HTTPS certificates |
| **TypeScript** | JavaScript with type checking |
| **UUID** | A random unique ID like `3f1c…` |
| **VCN** | Virtual Cloud Network: the server's private network inside Oracle Cloud (addresses like `10.0.0.112`) |
| **Volume** | Persistent storage for a container (survives restarts and redeploys) |
| **WER** | Word error rate: the share of words a speech-to-text system gets wrong (lower is better; over 100% means it added many wrong words) |
| **Worker** | The background process that runs slow jobs |
| **zod** | A library that checks data has the expected shape |

---

## 22. Quick reference card
| Thing | Value |
|---|---|
| Live site | https://classpulse.benxsolutions.in |
| Sign-in pages | `/admin/login`, `/teacher/login`, `/student/login` (`/login` is a chooser) |
| Platform console | https://ops.benxsolutions.in ("Super admin sign in"); password + authenticator code; 5 attempts per 15 minutes |
| Owner's super admin | `saicharan312008@gmail.com` |
| Create a super admin | `sudo docker exec -it $API node dist/scripts/createSuperAdmin.js --email … --name …` (section 15.5.1) |
| Health check | `/api/health/ready` (or console → Health) |
| Coolify | https://coolify.benxsolutions.in → Project ClassPulse → production → classpulse (env vars go in the **Production** section) |
| Deploying | By hand only (Coolify or console → Redeploy); 30–60 s of downtime, so outside class hours |
| Email sender | `ClassPulse <admin@benxsolutions.in>` via GoDaddy (`smtpout.secureserver.net:465`); about 250–300 emails a day |
| DNS | GoDaddy, A records `classpulse`, `ops`, `coolify` → 129.159.227.74 |
| GitHub | `NINJA981/classpulse` (private), branch `main` |
| Server | Oracle Cloud `benx`, 129.159.227.74, Ubuntu 24.04, ARM64, 2 OCPU / 12 GB |
| SSH | `ssh -i ssh-key-2026-07-19.key ubuntu@129.159.227.74` (docker needs `sudo`) |
| Coolify app ID | `bmbcqf7x63jjpirzhi8tzsby` |
| Admins | `admin@benxsolutions.in` (BenX Pilot School, BENX), `admin2@benxsolutions.in` (BenX School 2, BENX2), `e2e-admin@benxsolutions.in` (E2E Test School, tests only) |
| Backups | Nightly about 02:30 server time (`classpulse-backup.service`) → `/var/backups/classpulse/{daily,weekly}`, about 270 MB each; key: `classpulse-backup.key` (owner only) |
| Default AI | STT Sarvam `saaras:v3` (codemix); quiz `gpt-4.1-mini` for new schools (existing schools keep their saved choice); 5 questions; bilingual on |
| Limits | Upload 300 MB; 1–30 questions per request; audio kept 30 days; session 12 h (console 2 h); join codes 30 days; enrollment tokens 24 h; set-password links 72 h; live PIN 6 digits; exam access code 6 characters; assignment files 10 MB each, up to 10; teacher materials 20 MB; voice prompts 60 s |
| Kept for | Console logs 14 days; audit log 365 days; health history 30 days |
| Job queues | `lesson-generation`, `email`, `resources` (all run by the worker) |
| Key docs | `docs/agents/api.md`, `docs/agents/architecture.md`, `docs/agents/database.md`, `docs/agents/deployment.md`, `docs/agents/hardware-raspberry-pi.md`, `docs/agents/pilot-runbook.md`; research: `docs/agents/research/local-models-rnd.md`, `docs/agents/research/stt-benchmark-2026-10-12.md` |
