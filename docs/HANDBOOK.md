# ClassPulse — The Complete Handbook

> **Who this is for:** the owner of ClassPulse, who needs to understand and explain every part of the product: what it does, how it is built, how it is deployed, and why it was built that way. It assumes no prior technical knowledge. Each technical term is explained the first time it appears, and there is a [Glossary](#21-glossary) at the end.
>
> **How to use it:**
> - **Specific question:** jump to the [FAQ](#20-faq--questions-you-may-be-asked) first, then to the section it points to.
> - **Full picture:** read sections 1–3 in order.
>
> **Secrets are deliberately not in this file.** That covers passwords, API keys and private keys, because this repository is stored on GitHub. Section 14.8 says where each secret lives.
>
> **Last updated:** 11 October 2026 (commit `678b239` and later).

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

### 1.3 Who uses it (the three roles)
| Role | Who | Where they work | What they do |
|---|---|---|---|
| **Admin** | School office / principal / IT person | `/admin` ("Admin console") | Sets up the school: rooms, classes ("sections"), teachers, students, timetable, classroom devices, AI settings |
| **Teacher** | Subject teachers | `/teacher` ("Teacher studio") | Records or uploads lectures, generates and reviews quizzes, publishes them, runs live quizzes, views analytics |
| **Student** | Students (mostly on phones) | `/student` ("Student portal") | Joins classes with a code, takes quizzes, plays live quizzes, submits assignments, manages guardian contacts |

One installation can serve **many schools** ("multi-tenant"). Each school's data is completely separate.

### 1.4 Current status (October 2026)
- **Stage:** ready for a **pilot**, meaning a first real-world trial with about 100 users at one school.
- **Live at:** `https://classpulse.129.159.227.74.sslip.io`. This is a temporary address. It moves to `https://classpulse.benxsolutions.in` once the DNS record is added (see 14.3).
- **Servers:** a single cloud server (Oracle Cloud), managed with **Coolify**.
- **Accounts:**
  - `admin@benxsolutions.in` for "BenX Pilot School" (code `BENX`)
  - `admin2@benxsolutions.in` for "BenX School 2" (code `BENX2`)
  - a test school, "E2E Test School" (code `E2ETEST`), used by automated tests

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
| **Worker** | A background helper that does slow jobs (transcription and quiz writing) so the website stays fast | `apps/api/src/worker.ts` (same code as the API, different program) |
| **PostgreSQL** | The database: where all users, classes, lessons, questions and results are stored permanently | Docker container `postgres` |
| **Redis** | A fast in-memory store used as the **job queue** (the list of jobs waiting for the worker), for login rate limiting, and for passing messages from the worker to the API | Docker container `redis` |
| **Storage** | A folder on the server's disk holding the lecture audio files | Docker volume `storage-data` |
| **Router (Caddy)** | Sends `/api/...` and `/socket.io/...` requests to the API and everything else to the web app | `infra/Caddyfile.coolify` |
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
│   │   │   │   ├── migrations/*.sql    ← database change history (0000_init, 0001_teacher_quiz_generation)
│   │   │   │   ├── migrate.ts          ← applies migrations
│   │   │   │   └── seed.dev.ts         ← demo data for local development only
│   │   │   ├── modules/<feature>/      ← one folder per feature: routes.ts (URLs) + service.ts (rules)
│   │   │   ├── middleware/             ← login check, role check, validation, rate limits, errors
│   │   │   ├── pipeline/               ← AI: sarvam.ts, openaiStt.ts, llm.ts, providers.ts
│   │   │   ├── jobs/                   ← queue, worker logic, audio retention, periodic tasks
│   │   │   ├── sockets/                ← live quiz real-time engine
│   │   │   ├── realtime/notify.ts      ← pushes progress from worker → teacher's browser
│   │   │   ├── lib/                    ← helpers: crypto, storage, ffmpeg, logger, errors
│   │   │   └── scripts/createAdmin.ts  ← command to create a school admin
│   │   ├── scripts/loadtest-live.mjs   ← 100-student live quiz load test
│   │   ├── test/*.test.ts              ← 19 automated test files (211 tests)
│   │   └── Dockerfile                  ← how the API/worker container image is built
│   ├── web/                            ← the website (Next.js)
│   │   ├── app/                        ← pages: /login, /admin/*, /teacher/*, /student/*
│   │   ├── components/                 ← building blocks: ui/ (buttons, tables…), admin/, teacher/, student/
│   │   ├── lib/                        ← api.ts (talks to API), socket.ts (live), server-session.ts
│   │   ├── proxy.ts                    ← redirects signed-out visitors to /login
│   │   ├── e2e/full-flow.spec.ts       ← end-to-end browser test (7 steps)
│   │   └── Dockerfile
│   └── classroom-agent/                ← Raspberry Pi software (Python)
│       ├── agent.py                    ← the recorder/uploader program
│       ├── install.sh                  ← installs it on a Pi
│       ├── classpulse-agent.service    ← makes it run automatically (systemd)
│       ├── agent.example.json          ← example settings file
│       └── tests/test_agent.py         ← 11 automated tests
├── packages/shared/src/                ← shared data definitions (lessons, live quiz, devices, settings…)
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
├── .github/workflows/ci.yml            ← automatic checks on GitHub
└── package.json                        ← workspace definition + top-level commands
```

**Not in git** (deliberately ignored): `.env` files (secrets), the SSH key file, sample audio recordings in the root folder, `node_modules` (downloaded libraries), build output.

---

## 5. Schools, users, roles and signing in

### 5.1 Schools (institutions)
- Each school has a **name**, a short unique **code** (for example `BENX`), a **time zone** (default Asia/Kolkata) and an **academic year**.
- Every user, room, section and lesson belongs to exactly one school. All data access is limited to the user's own school.
- A school is created with the `createAdmin` command (section 15.3), which also creates its first admin.

### 5.2 Users
All users live in one table, with a **role**: `admin`, `teacher` or `student`.
- **Staff** (admin, teacher) sign in with **email + password**. Emails are unique across the whole system.
- **Students** sign in with **roll number + password**. Roll numbers are unique within a school; two schools can both have "10A-01".
- Each user has a **status**: `active` or `disabled`. Disabled users cannot sign in, and their existing sessions stop working immediately.

### 5.3 How accounts are created
| Who | Created by | How |
|---|---|---|
| First admin of a school | Server operator | `createAdmin` command on the server, which prints a one-time password |
| Teachers | Admin | Admin → Teachers → Add, which shows a one-time password once |
| Students | Admin | Admin → Students → Add (one at a time), or **Import CSV** (up to 2,000 at once, with a credentials CSV download) |

**One-time passwords** look like `XXXX-XXXX-XX`. They use an alphabet without the confusable characters 0/O and 1/I. Every admin-created account **must change its password at first sign-in**. Until it does, every other action is blocked (`PASSWORD_CHANGE_REQUIRED`).

### 5.4 Signing in
- The **login page** has two tabs: **Teacher / Admin** (email) and **Student** (roll number).
- **School code:** if a roll number exists in more than one school, the login asks for the school code (for example `BENX`). Otherwise students never need it.
- After signing in, users land on their area: `/admin`, `/teacher` or `/student`.
- **Forgotten password:** there is no self-service reset. The admin clicks **Reset password**, which issues a new one-time password. The page footer says "Ask your school administrator".

### 5.5 Sessions (staying signed in)
- After a successful login, the server sets a **cookie** named `cp_session` containing a **JWT**: a digitally signed token saying "user X, role Y, version Z".
  - It is **httpOnly**: page scripts can't read it, which protects against theft through malicious scripts.
  - It is **Secure** in production (sent only over HTTPS) and **SameSite=Lax** (protects against cross-site request forgery).
  - It lasts **12 hours** (`SESSION_TTL_HOURS`).
- On every request the server reloads the user and checks the token's **version** against `token_version` in the database. The version increases when the user changes their password, an admin resets it, or the user is disabled. That **instantly signs out** every other device.

### 5.6 Brute-force protection (rate limits)
| What | Limit |
|---|---|
| Login attempts | 10 per 15 minutes per IP address + account (`LOGIN_RATE_LIMIT`) |
| Live quiz PIN lookups, class join codes | 30 per minute per IP |
| AI actions (generate quiz, transcribe, remedial plan) | 20 per hour per IP |
| Device registration | 10 per hour per IP |

Login also always takes the same time whether or not the account exists, so attackers can't discover valid emails by timing the response.

---

## 6. Every feature, page by page

### 6.1 Shared pages
| Page | What it does |
|---|---|
| `/` | Sends you to your area if signed in, otherwise to `/login`. |
| `/login` | Two tabs (Teacher/Admin, Student). The school code field appears only when needed. |
| `/change-password` | Current password, new password (at least 8 characters), confirm. Required at first login. |
| Error pages | "Page not found" and "Something went wrong" with a "Try again" button. |

All signed-in pages share a **sidebar** (a hamburger menu on phones) with the user's name and **Sign out**.

### 6.2 Admin console (`/admin`)
| Page | Features |
|---|---|
| **Overview** `/admin` | School name and code. Stat cards: teachers, students, sections, lessons, devices online, average quiz score. A **Lessons by status** bar chart. Quick links. A recent lessons table. |
| **Onboarding** `/admin/onboarding` | A 7-step setup checklist with progress ("N of 7 steps done"): (1) School profile form (name, code, academic year, time zone), (2) Rooms, (3) Sections, (4) Teachers, (5) Students, (6) Timetable, (7) Devices. Each step links to its page. |
| **Rooms** | Physical classrooms: name, building, capacity, device count. Add, edit and delete. A room with devices can't be deleted. |
| **Sections** | Classes (for example "Grade 10 – A"): grade, subject, room, teachers, student count, **6-character join code** (with a copy button). Actions: edit, **rotate join code** (makes the old one stop working), delete (refused if the section has lessons). |
| **Section detail** `/admin/sections/[id]` | Info, the join code with its Active/Expired status (codes expire after **30 days**), the student roster, and **Edit roster** (search and tick students). |
| **Teachers** | Name, email, department, sections, status. Add (shows a one-time password), edit, **disable** (they can't sign in; their lessons are kept), **reset password**, delete (refused if the teacher owns lessons). |
| **Students** | Search, a section filter and paging. Add, edit, disable, reset password, delete. **CSV import:** columns `name, rollNumber, email`; preview in the browser; optional "enrol into section"; afterwards **download a credentials CSV**, since the initial passwords are shown only once. |
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
- **Questions list:** counts (approved / pending / rejected), **Add question** (written by hand), **Approve all**. Each question card shows its status, difficulty and topic tag, plus an "Edited by you" badge. It shows the question and 4 options with the correct one highlighted, the explanation, the **local-language translation** (for non-English lessons), and a **citation timestamp button** that plays the exact part of the lecture the question came from. Actions: Approve, Reject, Edit, Delete.
- **Edit dialog:** question, 4 options with a "correct" radio, explanation, difficulty, topic, and optional translation fields.
- **Class recording + transcript:** an audio player, with a note on the date the audio will be deleted. A timestamped transcript highlights the current sentence; click a sentence to jump there.
- **Summary & key takeaways:** editable, up to 10 takeaways.
- **Assignment (homework):** title, instructions, rubric (criteria with marks), estimated minutes, optional due date. Published together with the lesson.
- **Processing view:** while transcribing or generating, shows a progress bar and steps. If something fails, the reason is shown in plain language with **Try again**.

### 6.4 Student portal (`/student`, playful yellow theme)
| Page | Features |
|---|---|
| **Home** | "Hi, name!", a live quiz PIN shortcut, stats (average score, quizzes to do, classes), quizzes to take, recent scores, upcoming assignments, my classes. |
| **Join a class** `/student/join` | Enter the 6-character class code. It previews "Class found" first, then **Join class**. |
| **Quizzes** | Cards with a score badge or "New". |
| **Take a quiz** | Intro (summary, takeaways), then one question at a time with Next/Back, an **English ↔ local language toggle** (when translated), and a review screen ("unanswered questions count as wrong"), then **Submit**. **Results:** score %, each answer with the correct answer, explanation and "From the lecture at 0:17". **Retake** is unlimited. |
| **Live quiz** `/student/live` | Enter the PIN (or scan the projector's QR code). Lobby, then tap an answer (it can be changed until time runs out), see whether you were right, your points and your rank, then the final leaderboard. |
| **Assignments** | Due badge, task and rubric, a text answer (up to 20,000 characters), submit and resubmit until the due date. |
| **Profile** | Name and roll number, optional email, change password, my classes, **guardians** (parent contacts: name, relation, phone, email, "send progress updates"). |

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

**OpenAI Whisper (alternative):** model `whisper-1`, with segment timestamps. Audio is split into parts of 10 minutes or less (the API has a 25 MB limit).

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

### 8.7 What the AI providers receive (privacy)
- **Sarvam:** the lecture audio.
- **OpenAI:** the transcript text, lesson title and subject, and (for remedial plans) aggregated accuracy statistics.
- **No student names or personal data are sent to either provider.**

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
- **Load test (live server, over the internet):** **100 students** in one live quiz, **500/500 answers acknowledged, 0 dropped**, response time **p95 = 42 ms** (95% of answers were confirmed within 42 milliseconds). The target was under 300 ms.

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
- In production, migrations run **automatically** each time the API starts.

### 11.2 Tables (23)
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
| | `assignments` | One homework per lesson (title, instructions, rubric, minutes, due date, status) |
| | `assignment_submissions` | Students' homework answers (one per student, editable until due) |
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

### 11.3 Important rules enforced by the database
- **Uniqueness:**
  - one email per system;
  - one roll number per school;
  - one join code globally;
  - one active live PIN at a time;
  - one assignment per lesson;
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
| `NOT_FOUND` | 404 | Doesn't exist, or you aren't allowed to see it |
| `CONFLICT`, `INVALID_STATE` | 409 | Duplicate, or the action isn't possible right now (e.g. "confirm to continue") |
| `PAYLOAD_TOO_LARGE` | 413 | Upload too big |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Not an audio file |
| `RATE_LIMITED` | 429 | Too many attempts |
| `UPSTREAM_FAILED` | 502 | The AI provider failed |
| `INTERNAL` | 500 | Unexpected server error (details are never exposed) |

### 12.2 Endpoint map (summary; full list in `docs/api.md`)
| Area | Prefix | Who | Main actions |
|---|---|---|---|
| Health | `/api/health/live`, `/api/health/ready` | Anyone | Is the server up? Are the database, Redis and storage OK? |
| Auth | `/api/auth` | Anyone / signed in | `login`, `student/login`, `logout`, `me`, `change-password` |
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
| Student | `/api/student` | Student | Dashboard, profile, sections, join by code, quizzes, submit attempt, latest result, assignments, guardians |
| Devices (Pi) | `/api/devices` | Pi (device key) | Register, heartbeat, commands, chunk upload, finalize |

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
| Headers | helmet security headers; nosniff; strict referrer policy; camera/geolocation disabled; microphone only for the site itself |
| Logs | Passwords, cookies, authorization headers, API keys and the database URL are automatically redacted; no student names in live-quiz logs |
| Secrets | Production settings validation requires a JWT secret of at least 32 characters, Redis, HTTPS, and no demo mode |
| Containers | Run as a non-root user; only the router is reachable from outside; database and Redis are private |
| Backups | Encrypted with `age`; the decryption key is kept **off** the server |

### 13.2 Data retention and privacy
- **Lecture audio:** deleted automatically after **30 days**. Transcripts, questions and results are kept.
- **What AI providers see:** audio (Sarvam/Whisper); transcript text and lesson metadata (OpenAI). No student personal data.
- **Deleting a student** also deletes their attempts, answers, enrollments, live participation and guardians (cascade).

### 13.3 Known security limitations (be honest about these)
- **Sign out** clears the cookie in the browser but does not revoke the token server-side. A stolen copy of a cookie would work until it expires (at most 12 hours) or until the password is changed.
- There is **no two-factor authentication** for admins yet.
- There is **no self-service password reset** (by design for the pilot: the admin resets passwords).
- The Coolify dashboard is still reachable on `http://129.159.227.74:8000` (no HTTPS) until it gets its own domain and the port is closed (see 14.9).

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
| Login | SSH as `ubuntu` with the private key file `ssh-key-2026-07-19.key` (kept off GitHub) |
| Firewall | OCI **Security List** (the cloud firewall) allows SSH 22, HTTP 80, HTTPS 443 and Coolify 8000 |

### 14.2 Coolify
- **What it is:** a self-hosted control panel (like a private Heroku/Vercel) running on the same server, version 4.4.3, at `http://129.159.227.74:8000`. It:
  - pulls the code from GitHub,
  - builds the Docker images on the server,
  - runs them,
  - manages HTTPS certificates (via its **Traefik** proxy) and environment variables,
  - keeps a deployment history.
- **Project:** "ClassPulse" → environment "production" → application **classpulse** (internal ID `bmbcqf7x63jjpirzhi8tzsby`).
- **Source:** the private GitHub repo `NINJA981/classpulse`, branch `main`, compose file `/infra/docker-compose.coolify.yml`. Coolify pulls with a **read-only deploy key** (an SSH key that can only read this one repository).
- **Build pack:** Docker Compose.

### 14.3 Domains and HTTPS
- **Current address:** `https://classpulse.129.159.227.74.sslip.io`. **sslip.io** is a free service that turns an IP address into a hostname, so HTTPS works without owning a DNS record.
- **Planned address:** `https://classpulse.benxsolutions.in`. To switch:
  1. at the DNS provider for benxsolutions.in, add an **A record** `classpulse → 129.159.227.74` (and `coolify → 129.159.227.74` for the dashboard);
  2. in Coolify, set the router's domain and the `PUBLIC_ORIGIN` variable to the new address;
  3. redeploy.
- **Certificates:** Let's Encrypt, issued and renewed automatically by Traefik. It needs port 80 open; that's why opening port 80 in the OCI Security List was required.

### 14.4 The production containers
Seven services, all built from this repository (`infra/docker-compose.coolify.yml`):

| Service | Image | Role | Notes |
|---|---|---|---|
| `router` | Caddy 2 (with our Caddyfile baked in) | Sends `/api` and `/socket.io` to `api`, everything else to `web` | The only service with a public domain. Upload limit 400 MB on the audio upload URL, 25 MB elsewhere. 120 s read timeout (Pi long-polls) |
| `web` | Node 22 (Next.js standalone build) | Serves the pages | Keep-alive 75 s |
| `api` | Node 22 + ffmpeg | The API + Socket.IO | **Runs database migrations on every start**, then the server. Health check `/api/health/live` |
| `worker` | Same image as api | Background jobs (AI, retention, device sweep) | Starts after the API is healthy |
| `postgres` | postgres:16-alpine | Database | Data in volume `pg-data` |
| `redis` | redis:7-alpine | Queue, rate limits, messages | Password-protected; append-only persistence; volume `redis-data` |
| (volume) `storage-data` | — | Lecture audio files | Shared by api and worker |

**Traffic path:** Internet → Traefik (HTTPS, port 443) → `router:80` → `api:5000` or `web:3000`. Traefik's timeouts were raised to **600 seconds** so long lecture uploads aren't cut off (the default was 60 s).

### 14.5 Environment variables (production settings in Coolify)
| Variable | Purpose |
|---|---|
| `PUBLIC_ORIGIN` | The site's public address (used for security checks) |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET` | Randomly generated secrets |
| `SARVAM_API_KEY`, `OPENAI_API_KEY` | AI provider keys |
| `AUDIO_RETENTION_DAYS` | 30 |
| `GENERATION_CONCURRENCY` | 1 (one AI job at a time on this 2-CPU server) |
| `LOG_LEVEL` | info |
| Set in the compose file | `NODE_ENV=production`, `TRUST_PROXY_HOPS=2` (Traefik + Caddy), `STORAGE_DIR=/data/storage`, and database/Redis URLs built from the passwords |

The full list of variables the API understands (with defaults) is in `apps/api/src/config/env.ts`. Important ones: `PORT` 5000, `SESSION_TTL_HOURS` 12, `MAX_AUDIO_UPLOAD_MB` 300, `LOGIN_RATE_LIMIT` 10, `DEVICE_OFFLINE_AFTER_SEC` 90, `PIPELINE_DEMO_FALLBACK` (forbidden in production).

### 14.6 How a new version is deployed
1. A developer commits code and pushes to `main` on GitHub. From this computer that uses the **write deploy key**, because the GitHub CLI login lacks the "workflow" permission.
2. A deploy is triggered by **Coolify → classpulse → Deploy/Redeploy**, or the Coolify API (`POST /api/v1/deploy`). **Pushing does not deploy automatically yet** (no webhook).
3. Coolify clones the repo, builds the images (about 1.5–3 minutes once cached; the first build took about 3 minutes), and starts the new containers. The API applies any new migrations on start.
4. Check: `https://<site>/api/health/ready` should return `{"status":"ok"}`.

**Rollback:** in Coolify → Deployments, redeploy an earlier commit. Migrations only go forward, so roll back only to commits with the same database structure.

### 14.7 Alternative deployment (without Coolify)
`infra/docker-compose.prod.yml` runs the same stack on any Ubuntu server, with **Caddy doing HTTPS itself**:
- Fill in `infra/.env`, then run `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build`.
- A one-shot `migrate` container applies migrations first.
- `docs/deployment.md` has step-by-step instructions.

### 14.8 Where the secrets are (no values here)
| Secret | Where it lives |
|---|---|
| Production database/Redis passwords, JWT secret, AI keys | Coolify → classpulse → Environment variables (only) |
| Local development keys | `apps/api/.env` on the developer's PC (gitignored) |
| Server SSH key | `ssh-key-2026-07-19.key` in the project folder on the owner's PC (gitignored); keep a safe copy |
| GitHub deploy keys | Private halves in the session scratch folder on the owner's PC; public halves in GitHub → repo → Settings → Deploy keys ("local push", "Coolify (read-only)") |
| Coolify API token | Created in Coolify → Keys & Tokens. **Revoke it when not needed.** |
| Backup decryption key (`classpulse-backup.key`) | **Owner only**, off the server (password manager). Without it, backups cannot be restored. |
| Coolify admin login, Oracle Cloud login | The owner. **Change them**: they were shared in a chat. |

### 14.9 Hardening still recommended
- **Domains:** add the DNS records and move the site and the Coolify dashboard to `benxsolutions.in` subdomains with HTTPS.
- **Ports:** close public ports 8000, 6001–6002 and 8080 in the OCI Security List afterwards.
- **Accounts:** enable 2FA on the Coolify admin account.
- **Credentials:** rotate the Coolify password, the Oracle password and the Sarvam key, and revoke the Coolify API token.
- **Billing:** if the Oracle account is "Always Free", Oracle may reclaim instances that sit idle for 7 days. Upgrading to Pay-As-You-Go avoids this.

---

## 15. Day-to-day operations

### 15.1 Health and monitoring
- `GET /api/health/live` reports whether the server is running.
- `GET /api/health/ready` checks the database, Redis and storage. It returns **503** if any of them fails.
- **Recommendation:** point a free uptime monitor (for example UptimeRobot) at `/api/health/ready`.
- **Logs:** in Coolify → classpulse → Logs, or `sudo docker logs <container>` over SSH. They are JSON, with secrets hidden.

### 15.2 Backups
- **What:** a full database dump (`pg_dump`) plus all lecture audio, packed and **encrypted with `age`** using a public key. Only the owner's private key can decrypt it.
- **When:** every night at **02:30 UTC**, by a **systemd timer** (`classpulse-backup.timer`; the server has no cron). If the server was off at that time, it runs at the next boot.
- **Where:** `/var/backups/classpulse/daily/` (the last 7 nights) and `/weekly/` (the last 4 Sundays) on the server. Off-site copy to S3/Oracle Object Storage is supported (`BACKUP_S3_URI`) but not configured yet.
- **Config:** `/etc/classpulse/backup.env` (root only). It holds `COMPOSE_PROJECT=<Coolify app id>`, which lets the script find the containers.
- **Scripts:** `/opt/classpulse/infra/backup.sh` and `restore.sh`.
- **Tested:** a **restore drill** decrypted the backup with the offline key and restored it into a separate scratch database. Every table's row count matched the live database, and the 17 audio files were present.
- **Restore (real emergency):** `sudo ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/restore.sh <archive.tar.age> <your-age-key-file>`. It asks you to type `RESTORE`, stops the app, replaces the database and audio, and restarts.

### 15.3 Common admin tasks
| Task | How |
|---|---|
| Create a new school + its admin | SSH to the server, then run:<br>`API=$(sudo docker ps -q --filter label=com.docker.compose.project=bmbcqf7x63jjpirzhi8tzsby --filter label=com.docker.compose.service=api)`<br>`sudo docker exec $API node dist/scripts/createAdmin.js --email x@y --name "Name" --institution-name "School" --institution-code CODE`<br>It prints a one-time password. |
| Add another admin to an existing school | The same command with the existing `--institution-code` |
| Reset a teacher/student password | Admin console → Teachers/Students → Reset password |
| Disable a user | Admin console → edit → Account status: Disabled (signs them out everywhere) |
| Change AI models | Admin → AI settings |
| Deploy a new version | Coolify → classpulse → Redeploy |
| Check a failed lesson | Lesson page shows the reason; Coolify logs for the `worker` service show the details |

### 15.4 Incident playbook
| Symptom | What to do |
|---|---|
| Site down / `ready` returns 503 | Coolify → check which container is unhealthy; `df -h` on the server (disk full?); restart the service |
| Lessons stuck in "Queued" | Check the `worker` logs; restart the worker (stuck jobs are re-queued on start) |
| "Speech-to-text credentials were rejected" | The Sarvam key is invalid or expired. Update `SARVAM_API_KEY` in Coolify and redeploy, or switch to Whisper in AI settings |
| "Question generation failed" | Check the OpenAI key and quota; try again |
| Pi shows Offline | Pi troubleshooting table in `docs/hardware-raspberry-pi.md`; the teacher can upload a phone recording instead |
| Student forgot password | Admin → Students → Reset password |
| Suspected account compromise | Disable the user (immediate sign-out everywhere), then reset the password |
| HTTPS certificate missing after a firewall change | Restart Coolify's proxy (Servers → Proxy → Restart) so Let's Encrypt retries |

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

---

## 17. Testing and quality: what was verified

### 17.1 Automated tests
| Suite | Count | What it covers |
|---|---|---|
| **API tests** (Vitest + supertest, real PostgreSQL) | **19 files, 211 tests**, all passing | Login and sessions; the permission matrix for every role (rbac); admin CRUD; sections and join codes; lessons, uploads, size and type limits; generation modes and difficulty; publishing; questions; analytics and remedial; student quizzes (server-side grading, duplicate-submit protection); live-quiz sockets (30 simulated players, no answer leak, auto-close, reconnect, rebuild after restart); devices and recordings (including running the real Pi agent); health |
| **Pi agent tests** (pytest) | **11 tests** | HTTPS required, registration, chunking, resume, retries, finalize, cancel, disk guard, end-to-end against a stub server |
| **Browser end-to-end** (Playwright) | **7 steps** | (1) admin onboarding; (2) teacher uploads, then real transcription, then generates 5 Mixed questions; (3) edit, approve, publish; (4) students sign in, join by code, take the quiz; (5) live quiz with 2 students; (6) the **real Pi agent** records, is killed mid-class, restarts, uploads, then transcription and generation; (7) analytics. **7/7 passing on the live server and locally, with real AI.** |
| **Load test** | 100 students | Live server, over the internet: 100/100 joined, 500/500 answers, 0 dropped, p95 42 ms |
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
- **No automatic deploy on push:** a GitHub webhook can be added in Coolify.
- **Domain:** still on sslip.io until the DNS records are added.
- **Security gaps:** no admin 2FA, no self-service password reset, and logout doesn't revoke tokens server-side (section 13.3).
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
It was tested with 100 simultaneous students over the internet: zero dropped answers, and 95% of answers confirmed within 42 ms.

**Q: Can a student retake a quiz?**
Yes, self-paced quizzes can be retaken any number of times. Analytics use each student's latest attempt.

**Q: What do teachers see after a quiz?**
Per-question accuracy (Critical / Moderate / Mastered), answer distributions, each student's score, and an optional AI remedial plan.

**Q: Is there homework?**
Each lesson gets an AI-drafted assignment with a rubric, which the teacher can edit. It is published with the lesson. Students submit text answers until the due date.

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

### About security and privacy
**Q: How are passwords stored?**
They are hashed with bcrypt and never stored or logged in plain text. Admin-issued passwords must be changed at first login.

**Q: Can a teacher see another teacher's lessons?**
No. Teachers only see their own lessons and sections. Schools can't see each other's data at all.

**Q: Is the audio kept forever?**
No. It is deleted automatically after 30 days. Transcripts and quiz results are kept.

**Q: Is student data sent to OpenAI?**
No student personal data. OpenAI receives the lecture transcript and lesson details; Sarvam receives the audio.

**Q: Is the site encrypted?**
Yes. HTTPS with a Let's Encrypt certificate, plus HSTS. The Coolify dashboard itself still needs its own HTTPS domain (section 14.9).

**Q: What if the server dies?**
Encrypted backups run every night (7 daily and 4 weekly copies). A restore was tested successfully. Off-site copies are recommended next.

### About deployment and costs
**Q: Where is it hosted?**
On an Oracle Cloud ARM server (2 CPUs, 12 GB RAM) in the benxsolutions tenancy, managed with Coolify.

**Q: How do you release an update?**
Push the code to GitHub, then click Redeploy in Coolify. It builds and restarts in a few minutes, and database changes apply automatically.

**Q: What does it cost to run?**
The server is an Oracle Cloud instance. Ongoing variable costs are the **AI API usage**: Sarvam per minute of audio, and OpenAI per quiz generated. Check current prices on the providers' websites, and usage in their dashboards. No figures are recorded in this project.

**Q: Can it handle more schools?**
Yes, it is multi-tenant: create a school with `createAdmin`. A single server is sized for a pilot. Larger scale needs more worker capacity and the scaling steps in section 19.

**Q: Who can log in to the server?**
Whoever has the SSH key file (`ubuntu` user) or the Coolify admin login.

---

## 21. Glossary
| Term | Meaning |
|---|---|
| **API** | The server's set of URLs that the website (and the Pi) call to do things |
| **Backend / frontend** | Server-side code / what runs in the browser |
| **bcrypt** | A deliberately slow password-hashing method that makes stolen password databases hard to crack |
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
| **PostgreSQL** | The database system |
| **Rate limiting** | Capping how many attempts are allowed in a time window |
| **RBAC** | Role-Based Access Control: what each role may do |
| **Redis** | A very fast in-memory data store |
| **Reverse proxy** | A server in front of other servers that forwards requests (Traefik, Caddy) |
| **SHA-256** | A fingerprint of data; any change gives a different fingerprint |
| **Socket.IO / WebSocket** | A persistent two-way connection for real-time features |
| **sslip.io** | A free service turning an IP into a hostname (e.g. classpulse.129.159.227.74.sslip.io) |
| **STT** | Speech-to-text (transcription) |
| **Structured outputs** | Forcing the AI to reply in an exact data format |
| **systemd / timer** | Linux's service manager / its scheduler (used instead of cron) |
| **TLS / HTTPS** | Encryption for web traffic |
| **Traefik** | Coolify's reverse proxy that handles HTTPS certificates |
| **TypeScript** | JavaScript with type checking |
| **UUID** | A random unique ID like `3f1c…` |
| **Volume** | Persistent storage for a container (survives restarts and redeploys) |
| **Worker** | The background process that runs slow jobs |
| **zod** | A library that checks data has the expected shape |

---

## 22. Quick reference card
| Thing | Value |
|---|---|
| Live site | https://classpulse.129.159.227.74.sslip.io (planned: https://classpulse.benxsolutions.in) |
| Health check | `/api/health/ready` |
| Coolify | http://129.159.227.74:8000 → Project ClassPulse → production → classpulse |
| GitHub | `NINJA981/classpulse` (private), branch `main` |
| Server | Oracle Cloud `benx`, 129.159.227.74, Ubuntu 24.04, ARM64, 2 OCPU / 12 GB |
| SSH | `ssh -i ssh-key-2026-07-19.key ubuntu@129.159.227.74` (docker needs `sudo`) |
| Coolify app ID | `bmbcqf7x63jjpirzhi8tzsby` |
| Admins | `admin@benxsolutions.in` (BenX Pilot School, BENX), `admin2@benxsolutions.in` (BenX School 2, BENX2), `e2e-admin@benxsolutions.in` (E2E Test School, tests only) |
| Backups | Nightly 02:30 UTC → `/var/backups/classpulse/{daily,weekly}`; key: `classpulse-backup.key` (owner only) |
| Default AI | STT Sarvam `saaras:v3` (codemix); quiz `gpt-4.1-mini` for new schools (existing schools keep their saved choice); 5 questions; bilingual on |
| Limits | Upload 300 MB; 1–30 questions per request; audio kept 30 days; session 12 h; join codes 30 days; enrollment tokens 24 h; live PIN 6 digits |
| Key docs | `docs/api.md`, `docs/architecture.md`, `docs/database.md`, `docs/deployment.md`, `docs/hardware-raspberry-pi.md`, `docs/pilot-runbook.md` |
