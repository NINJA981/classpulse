# ClassPulse API reference

All endpoints live under `/api`. Request and response types are defined in `packages/shared` (`@classpulse/shared`). Type names in this document refer to that package.

## Conventions

- **Authentication.** A successful login sets the httpOnly cookie `cp_session`. The browser always calls the API on the same origin, so there is no CORS setup. Test clients can send the same token as `Authorization: Bearer <token>`.
- **Forced password change.** If a user must change their password, every authenticated route returns `403 PASSWORD_CHANGE_REQUIRED`. The exceptions are `GET /auth/me`, `POST /auth/change-password` and `POST /auth/logout`.
- **Errors.** Every non-2xx response has the body `{ "error": { "code": ErrorCode, "message": string, "details"?: unknown } }`. For `VALIDATION_FAILED`, `details` is an array of `{ path, message }`.
- **Success responses.** Single resources are returned as-is (no envelope). Paginated lists return `Paginated<T>`, which is `{ items, page, pageSize, total }`.
- **IDs.** IDs are UUIDs. A malformed ID returns `400 VALIDATION_FAILED`, and an ID that doesn't exist (or isn't visible to you) returns `404`.
- **Authorization.**
  - Admin routes are limited to the admin's own institution.
  - Teachers can only see their own sections, their own lessons, and the lessons of the sections they teach.
  - Students can only see sections they are enrolled in.
- **Platform state.** The platform console (super admin) can change how school routes answer:
  - `403 FEATURE_DISABLED`: the route belongs to a feature switched off for the caller's school. The gated prefixes are listed in [Feature switches](#feature-switches).
  - `403 SCHOOL_SUSPENDED`: the caller's school is suspended. Every school session is refused until it is reactivated.
  - `503 MAINTENANCE`: maintenance mode is on with "block school sign-ins and requests". Logins and `POST /auth/set-password` are refused too. `POST /auth/logout` and `GET /status` always work.
- **Platform sessions are separate.** Console routes (`/api/platform/*`) use their own cookie, `cp_platform`. A school session never passes them, and a platform session never passes school routes. See [Platform console](#platform-console-super-admin-apiplatform).

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health/live` | Process liveness check. |
| GET | `/health/ready` | Checks DB, Redis and storage. Returns `503` if any check fails. |

## Status: `/api/status`

| Method | Path | Response |
|---|---|---|
| GET | `/` | `PlatformStatus` (`{ ok, banner, maintenance }`). Public and never blocked by maintenance. The sign-in pages use it to show the platform banner and maintenance message. |

## Public: `/api/public`

No session. Served on the school address only (the console host answers 404). These routes are **not** exempt from the same-origin guard: the product page posts JSON to its own origin, so a cross-site `Origin` gets `403` and a `text/plain` or form body `415`.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/demo-requests` | `DemoRequestInput` (strict: unknown fields are `400`) | `204` (no body) |

**`POST /demo-requests`** ("Book a demo" on `/about`):
- **Body.** Required: `name` (≤ 100), `school` (≤ 150), `city` (≤ 80), `phone` (8–20 digits; spaces, dashes, dots, brackets and a leading `+` are accepted and normalised to `+digits`). Optional: `email` (valid address, ≤ 254), `role` (≤ 80), `classrooms` (integer 1–5000), `message` (≤ 1000, line breaks kept). Every text field has control characters (CR/LF included) replaced and whitespace collapsed. The browser form validates with the same schema.
- **Honeypot.** `website` must be empty. When it is filled, the answer is still `204` and nothing is sent.
- **Email.** One email per request through the `email` queue (kind `demo-request`), built with `renderEmail()`, to the fixed inbox `DEMO_REQUEST_TO` (default: the address in `MAIL_FROM`). It is never sent to the visitor's address, which is only the `Reply-To`. The subject is `Demo request: <school>, <city>` on one line.
- **Answers.** `204` for a sent request, a duplicate (the identical request again within 24 hours is not emailed twice) and a tripped honeypot alike. `400 VALIDATION_FAILED` with field `details`. `429 RATE_LIMITED`: `DEMO_REQUEST_RATE_LIMIT` (default 5) requests per IP per hour, and at most 50 emailed requests per 24 hours across all visitors. `503 EMAIL_UNAVAILABLE` when email (or the inbox) isn't configured; the form then offers the email fallback.
- **Privacy.** Nothing is stored and the body is never logged. With `E2E_MAIL_CAPTURE` on (never in production) and no inbox configured, requests go to `demo-requests@classpulse.test` in the capture.

## Auth: `/api/auth`

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/admin/login` | `StaffLoginInput` | `SessionResponse` + cookie. Admins only: a teacher's credentials get the same `401` as a wrong password |
| POST | `/teacher/login` | `StaffLoginInput` | `SessionResponse` + cookie. Teachers only |
| POST | `/student/login` | `StudentLoginInput` | `SessionResponse` + cookie |
| POST | `/login` | `StaffLoginInput` | `SessionResponse` + cookie (admin or teacher). Kept for older clients and scripts; the web app uses the role endpoints |
| POST | `/logout` | — | `204` and clears the cookie (no session needed) |
| GET | `/me` | — | `MeResponse`: the user, the platform `notice` (banner, maintenance) and the school's `features` |
| POST | `/change-password` | `ChangePasswordInput` | `SessionResponse` + new cookie; old sessions are revoked |
| GET | `/password-token/:token` | — | `PasswordTokenPreview` (purpose `invite` or `reset`, who it is for). An unusable link returns `400`, not `401` |
| POST | `/set-password` | `SetPasswordInput` (`token`, `newPassword`) | `SessionResponse` + cookie. Redeems an emailed link; the user is signed in |
| POST | `/forgot-password` | `ForgotPasswordInput` (`{ email }` or `{ rollNumber, institutionCode }`) | Always `204`, answered before any lookup so the timing reveals nothing. An active account with an email address gets a reset link |

Logins are rate-limited (`429 RATE_LIMITED`; `LOGIN_RATE_LIMIT` attempts per IP and account per 15 minutes). The three set-password routes share a limit of 20 requests per 15 minutes per IP.

Student login finds the school from the roll number. Only when several schools use the same roll number does it return `400` with `details: { field: 'institutionCode' }`, and the login page then asks for the school code.

**Emailed links.** Set-password links (invitations and resets) are single-use and expire after 72 hours (`PASSWORD_TOKEN_TTL_HOURS`). Only the SHA-256 of a token is stored. Issuing a new link revokes the user's older ones. Email is sent only when `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` are all set. Endpoints that send a link report what happened as `EmailDelivery`: `queued`, `no_email` (the account has no address) or `email_disabled` (SMTP not configured, or the school's `emailInvites` switch is off).

### Feature switches

| Feature | Routes that answer `403 FEATURE_DISABLED` when it is off |
|---|---|
| `exams` | `/api/exams/*`, `/api/student/exams/*` |
| `assignments` | `/api/assignments/*`, `/api/assignment-files/*` |
| `liveQuiz` | `/api/live-sessions/*` |
| `devices` | `/api/admin/devices/*`, `/api/recordings/*` |
| `teacherTools` | `/api/curriculum/*`, `/api/resources/*`, `/api/simulations/*`, `/api/insights/*` |
| `exams` (with `teacherTools`) | `POST /api/resources/:id/publish-exam` needs both switches on |
| `aiGrading` | `POST /api/assignments/:id/submissions/:sid/ai-suggest` |
| `emailInvites` | No route is refused. When it is off, no set-password link is created or emailed for that school's users (invitations, admin "email a reset link", "Forgot password?"), and endpoints report `email_disabled`, so admins fall back to one-time passwords |

The web app also hides the matching menu items, using `features` from `GET /auth/me`.

## Admin console (admin role)

### `/api/admin/institution`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `Institution` |
| PUT | `/` | `InstitutionInput` | `Institution` |

### `/api/admin/overview`
| GET | `/` | — | `AdminOverview` |
|---|---|---|---|

### `/api/admin/rooms`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `Room[]` |
| POST | `/` | `RoomInput` | `Room` (201) |
| PATCH | `/:id` | `RoomInput` (partial) | `Room` |
| DELETE | `/:id` | — | `204`; returns `409` if a device is attached |

### `/api/admin/teachers`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `Teacher[]` |
| POST | `/` | `CreateTeacherInput` | `CreatedWithPassword<Teacher>` (201) |
| PATCH | `/:id` | `UpdateTeacherInput` | `Teacher` |
| DELETE | `/:id` | — | `204`; returns `409` if the teacher owns lessons (disable them instead) |
| POST | `/import` | `ImportTeachersInput` (1–500 rows of `name, email, department?`) | `ImportTeachersResult` (`created` with one-time passwords and `invite`, `skipped` with reasons) |
| POST | `/:id/reset-password` | — | `PasswordResetResult` |
| POST | `/:id/send-invite` | — | `SendLinkResult` (`{ invite: EmailDelivery }`): emails a set-password invitation |
| POST | `/:id/send-reset-link` | — | `SendLinkResult`: emails a password-reset link |

### `/api/admin/students`
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `?sectionId=&q=&page=&pageSize=` | `Paginated<Student>` |
| POST | `/` | `CreateStudentInput` | `CreatedWithPassword<Student>` (201) |
| POST | `/import` | `ImportStudentsInput` (up to 2,000 rows of `name, rollNumber, email?`) | `ImportStudentsResult` |
| PATCH | `/:id` | `UpdateStudentInput` | `Student` |
| DELETE | `/:id` | — | `204` |
| POST | `/:id/reset-password` | — | `PasswordResetResult` |
| POST | `/:id/send-invite` | — | `SendLinkResult` |
| POST | `/:id/send-reset-link` | — | `SendLinkResult` |

Students created by an admin must change their password on first login. Teachers and students now carry an `inviteStatus` (`none`, `queued`, `sent`, `failed`, `accepted`). When email is configured, creating or importing an account with an email address also queues an invitation. The one-time password is still returned as a fallback.

`maxTeachers` and `maxStudents` limits set in the platform console are enforced on create and import (disabled accounts count).

The CSV templates on the Teachers and Students pages are generated in the browser. There is no template endpoint.

### `/api/admin/sections`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `Section[]` |
| POST | `/` | `SectionInput` | `Section` (201); the join code is generated |
| PATCH | `/:id` | `UpdateSectionInput` | `Section` (`teacherIds` replaces the teacher list) |
| DELETE | `/:id` | — | `204`; returns `409` if the section has lessons |
| POST | `/:id/rotate-code` | — | `Section` |
| GET | `/:id/students` | — | `Student[]` |
| PUT | `/:id/students` | `SetSectionStudentsInput` | `Student[]` |

### `/api/admin/timetable`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | `?sectionId=` | `TimetableSlot[]` |
| PUT | `/:sectionId` | `ReplaceTimetableInput` | `TimetableSlot[]` (replaces that section's week) |

### `/api/admin/settings/models`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `ModelSettings` |
| PATCH | `/` | `UpdateModelSettingsInput` | `ModelSettings`; models must come from `STT_MODELS[provider]` / `LLM_MODELS` (else `400`), and switching provider alone picks that provider's default model |

### `/api/admin/devices`
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `Device[]` |
| POST | `/enrollment-tokens` | `CreateEnrollmentTokenInput` | `EnrollmentToken` (201); the token is shown once |
| DELETE | `/:id` | — | `204`; revokes the device key |

## Teacher studio (teacher role)

### `/api/teacher`
| Method | Path | Response |
|---|---|---|
| GET | `/dashboard` | `TeacherDashboard` |
| GET | `/sections` | `Section[]` (my sections) |
| GET | `/timetable` | `TimetableSlot[]` (my slots and my sections' slots) |

### `/api/lessons` (teacher owner; admin can read)
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `ListLessonsQuery` | `Paginated<LessonSummary>` |
| POST | `/` | `CreateLessonInput` | `LessonDetail` (201, status `draft`) |
| GET | `/:id` | — | `LessonDetail` |
| PATCH | `/:id` | `UpdateLessonInput` | `LessonDetail` |
| DELETE | `/:id` | — | `204`; only for `draft` or `failed` lessons with no attempts |
| POST | `/:id/audio` | multipart field `file` (audio/*) | `LessonDetail`; audio is normalized to 16 kHz mono WAV and transcription starts (status `queued` → `transcribed`) |
| GET | `/:id/audio` | `Range` supported | `audio/wav` stream (teacher owner or admin) |
| GET | `/:id/transcript` | — | `LessonTranscript` |
| POST | `/:id/generate` | `GenerateLessonInput` | `202 { jobId }` (rate-limited). The teacher's quiz: `questionCount` (1–30, default from AI settings), `difficulty` (`easy`/`medium`/`hard`/`mixed`), `mode` (`append`, `replace_unapproved`, `replace_all`). `409` unless `confirmRegenerate: true` when questions would be removed or the lesson is published (it is unpublished first) |
| POST | `/:id/transcribe` | — | `202 { jobId }`: re-runs transcription only (e.g. after it failed) |
| POST | `/:id/publish` | — | `LessonDetail`; needs ≥1 approved question and status `ready_for_review` |
| POST | `/:id/unpublish` | — | `LessonDetail` (back to `ready_for_review`) |
| POST | `/:id/questions` | `QuestionInput` | `Question` (201, approved, marked as edited by teacher) |
| POST | `/:id/questions/approve-all` | — | `Question[]` |
| PUT | `/:id/assignment` | `AssignmentInput` | `Assignment` (the lesson's own assignment) |
| POST | `/:id/assignments` | `AssignmentInput` | `Assignment` (201): an extra assignment for the lesson, then managed under `/api/assignments` |
| GET | `/:id/attempts` | — | `AttemptSummary[]` |
| GET | `/:id/analytics` | — | `LessonAnalytics` |
| POST | `/:id/analytics/remedial` | — | `RemedialPlan` (LLM; cached on the lesson; rate-limited) |

### `/api/questions` (teacher who owns the lesson)
| Method | Path | Body | Response |
|---|---|---|---|
| PATCH | `/:id` | `UpdateQuestionInput` | `Question` (sets `editedByTeacher`) |
| POST | `/:id/approve` | — | `Question` |
| POST | `/:id/reject` | — | `Question` |
| DELETE | `/:id` | — | `204` |

Published lessons are read-only: you must unpublish before editing questions.

Questions carry two optional tags, written by the quiz generator and editable by the teacher: `bloomLevel` (`remember`, `understand`, `apply`, `analyze`, `evaluate`, `create`) and `competency` (a short phrase, up to 160 characters). Class insights are built from them.

Uploading audio (`POST /lessons/:id/audio`) returns `409 INVALID_STATE` when transcribing it would take the school past its monthly `aiAudioMinutesPerMonth` limit. The month starts on the 1st in the school's time zone.

### `/api/assignments` (teacher; feature `assignments`)
Assignments can be standalone or attached to a lesson (several per lesson).

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `ListAssignmentsQuery` (`?sectionId=&lessonId=&status=`) | `AssignmentSummary[]` |
| POST | `/` | `CreateAssignmentInput` (`AssignmentInput` + `sectionId`, optional `lessonId`) | `Assignment` (201, `draft`) |
| GET | `/:id` | — | `Assignment` |
| PATCH | `/:id` | `UpdateAssignmentInput` | `Assignment` |
| DELETE | `/:id` | — | `204` |
| POST | `/:id/publish` | — | `Assignment` |
| POST | `/:id/close` | — | `Assignment` |
| GET | `/:id/submissions` | — | `SubmissionTrackerRow[]` (every enrolled student: `missing`, `submitted`, `late` or `returned`) |
| GET | `/:id/submissions/:sid` | — | `SubmissionDetail` (text, files, marks, feedback, stored AI suggestion) |
| PUT | `/:id/submissions/:sid/grade` | `GradeSubmissionInput` (`rubricMarks`, `feedback`) | `SubmissionDetail` |
| POST | `/:id/submissions/:sid/return` | — | `SubmissionDetail` (the student now sees marks and feedback) |
| POST | `/:id/return-all` | — | `{ returned }`: returns every graded submission |
| POST | `/:id/submissions/:sid/ai-suggest` | — | `AiGradeSuggestion` (`rubricMarks`, `feedback`, `note`, `model`), also stored on the submission. Feature `aiGrading`; rate-limited. The AI reads typed text and JPEG/PNG photos only; otherwise `409` |

`AssignmentInput` fields: `title`, `prompt`, `rubric` (up to 20 items of `criterion`, `marks`, `descriptor`), `estimatedMinutes`, `dueAt`, `latePolicy` (`allow_late`: accepted and flagged late; `closed`: refused after the due date), `allowFiles`, `maxFiles` (1–10) and `reminders`. With `reminders` on and email configured, students who have not submitted get one email at most 24 hours before the due date.

### `/api/assignment-files` (feature `assignments`)
| Method | Path | Response |
|---|---|---|
| GET | `/:id` | The file. Images and PDFs open inline; other types download. Only the student who uploaded it, or a teacher of the assignment's section, can read it; everyone else gets `404` |

### `/api/exams` (teacher; feature `exams`)
Secure, timed exams built from approved lesson questions. When an exam is published, its question pool is frozen. Each student gets one attempt with their own sample of `questionsPerStudent` questions, in shuffled order with shuffled options. The server owns the clock, autosaves answers, records integrity events and grades.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | — | `ExamSummary[]` |
| POST | `/` | `ExamInput` | `ExamDetail` (201, `draft`) |
| GET | `/:id` | — | `ExamDetail` |
| PATCH | `/:id` | `UpdateExamInput` | `ExamDetail` (drafts) |
| DELETE | `/:id` | — | `204` |
| GET | `/:id/question-pool` | `ExamPoolQuery` (`?lessonIds=&difficulty=&topic=`) | `ExamPoolCandidate[]`: approved questions from the teacher's lessons in the exam's section |
| PUT | `/:id/questions` | `SetExamQuestionsInput` (`questionIds`, 1–500) | `ExamDetail` |
| POST | `/:id/publish` | — | `ExamDetail` (pool snapshotted) |
| POST | `/:id/close` | — | `ExamDetail` |
| POST | `/:id/rotate-code` | — | `ExamDetail` with a new 6-character access code |
| GET | `/:id/monitor` | — | `ExamMonitor` (live per-student status, time left, warnings) |
| POST | `/:id/attempts/:aid/unlock` | — | `ExamMonitorRow`: lets the student continue on another device |
| POST | `/:id/attempts/:aid/extra-time` | `ExtraTimeInput` (`minutes`, 1–240) | `ExamMonitorRow`: extends that attempt |
| POST | `/:id/attempts/:aid/force-submit` | — | `ExamMonitorRow`: submits and grades that attempt now |
| GET | `/:id/results` | — | `ExamResults` (scores and each attempt's integrity timeline) |
| GET | `/:id/results.csv` | — | CSV download |

`ExamInput` fields: `title`, `sectionId`, `instructions`, `opensAt`, `closesAt` (must be after `opensAt`), `durationMin` (1–600), `questionsPerStudent` (1–200), `shuffleQuestions`, `shuffleOptions`, `requireFullscreen`, `useAccessCode`, `singleDevice` (all default `true`), `maxViolations` (auto-submit after this many warnings; `null` logs and warns only) and `resultsVisibility` (`after_close` by default, `immediately` or `never`).

A periodic sweep auto-submits attempts still open past their deadline (plus a 30-second save grace) and closes published exams past `closesAt`.

### `/api/curriculum` (teacher; feature `teacherTools`)
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/catalog` | `?level=&board=&subject=` | `CatalogEntry[]`: built-in syllabus starter lists (NCERT/CBSE Classes 6–12, plus generic undergraduate outlines) |
| POST | `/catalog/:key/import` | `{ sectionId?: Id \| null }` | `CourseDetail` (201): creates a course and its units for the school |
| GET | `/courses` | `?q=&mine=true\|false` | `Course[]` |
| POST | `/courses` | `CourseInput` | `CourseDetail` (201) |
| GET | `/courses/:id` | — | `CourseDetail` |
| PATCH | `/courses/:id` | `CourseInput` (partial) | `CourseDetail` |
| DELETE | `/courses/:id` | — | `204` |
| POST | `/courses/:id/units` | `UnitInput` | `Unit` (201) |
| PUT | `/courses/:id/units/order` | `ReorderUnitsInput` (every unit id, first to last) | `CourseDetail` |
| PATCH | `/units/:id` | `UnitInput` (partial) | `Unit` |
| DELETE | `/units/:id` | — | `204` |
| POST | `/units/:id/draft-summary` | — | `UnitDraft` (AI-drafted summary and objectives; saved only when the teacher saves the unit). Rate-limited |
| GET | `/materials` | `?courseId=&unitId=` | `Material[]` (the teacher's own) |
| POST | `/materials` | multipart: `file` (PDF, DOCX or TXT, up to 20 MB), optional `title`, `courseId`, `unitId` | `Material` (201). The text is extracted and later used for grounding |
| PATCH | `/materials/:id` | `UpdateMaterialInput` | `Material` |
| DELETE | `/materials/:id` | — | `204` |

### `/api/resources` (teacher; feature `teacherTools`)
AI teaching resources: `lesson_plan`, `worksheet`, `question_paper` and `presentation`. Generation runs on the `resources` queue in the worker.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `ListResourcesQuery` (`?type=&scope=mine\|shared&courseId=&q=`) | `ResourceSummary[]` |
| POST | `/generate` | `GenerateResourceInput` | `ResourceDetail` (201, status `queued`). Rate-limited |
| POST | `/voice` | multipart: `audio` (up to 60 s, 5 MB) | `VoicePromptResult` (`text`, `languageCode`): a spoken request transcribed with the school's STT provider. The audio is not stored. Rate-limited |
| GET | `/:id` | — | `ResourceDetail` (own resources, or ones shared in the school) |
| PATCH | `/:id` | `UpdateResourceInput` (`title`, `content` validated against the type's schema) | `ResourceDetail` |
| DELETE | `/:id` | — | `204` |
| POST | `/:id/regenerate` | — | `ResourceDetail`. Rate-limited |
| POST | `/:id/share` / `/:id/unshare` | — | `ResourceDetail`: adds it to, or removes it from, the school library |
| POST | `/:id/copy` | — | `ResourceDetail` (201): a teacher's own copy of a shared resource |
| GET | `/:id/export` | — | The file in the type's format: Word (`.docx`) for plans, worksheets and papers; PowerPoint (`.pptx`) for presentations |
| GET | `/:id/export.docx`, `/:id/export.pptx` | — | The same, with an explicit format (`404` if the type uses the other one) |
| POST | `/:id/publish-exam` | `PublishPaperExamInput` (`sectionId`, `opensAt`, `closesAt`, `durationMin`, optional `title`, `instructions`, `questionsPerStudent`) | `PublishPaperExamResult` (201: `examId`, `mcqCount`, `skipped`). Creates a **draft** exam from a question paper's MCQ and assertion–reason questions; the teacher reviews it in the exam editor and publishes. Needs both the `teacherTools` and `exams` switches on (otherwise `403 FEATURE_DISABLED`) |

`GenerateResourceInput`: `title`, `courseId`, `unitIds` (≤ 20), `lessonIds` (≤ 10, the teacher's recorded lessons), `materialIds` (≤ 10), `prompt`, `language` and `options` (per type):
- `lesson_plan`: `durationMin`, `periods`, `pedagogy`.
- `worksheet`: `itemCount`, `difficulty`, `itemTypes`, `includeAnswerKey`.
- `question_paper`: `examName`, `maxMarks`, `durationMin`, `sections` (blueprint: name, type, count, marks each, internal choice), `bloomMix`, `difficultyMix`.
- `presentation`: `slideCount`, `includeSpeakerNotes`, `theme`.

Grounding text (unit summaries and objectives, lesson transcripts, material text) is capped at 60,000 characters. Sources are re-checked against the resource owner.

### `/api/simulations` (teacher; feature `teacherTools`)
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `?q=&subject=` | `Simulation[]`: the built-in PhET catalog plus the school's links |
| POST | `/links` | `SimulationLinkInput` (`title`, `url`, `subject?`, `description?`) | `Simulation` (201). `https` only, no port or credentials, host must be one of `phet.colorado.edu`, `www.geogebra.org`, `geogebra.org`, `www.desmos.com`, `ophysics.com`, `www.olabs.edu.in` |
| DELETE | `/links/:id` | — | `204` (the teacher who added it) |

### `/api/insights` (teacher; feature `teacherTools`)
| Method | Path | Response |
|---|---|---|
| GET | `/sections/:sectionId` | `SectionInsights`: accuracy by Bloom level and by topic, for the class and per student. `404` unless the teacher teaches the section |

### `/api/recordings` (teacher): classroom-device recording
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/devices` | `?sectionId=` | `Device[]` usable for that section (devices in its room) |
| POST | `/` | `StartRecordingInput` | `RecordingSession` (201). Creates a lesson in status `recording` and sends a `start_recording` command to the device |
| GET | `/:id` | — | `RecordingSession` |
| POST | `/:id/stop` | — | `RecordingSession` (status `stopping`; the device uploads its backlog, then finalizes) |
| POST | `/:id/cancel` | — | `RecordingSession` (`cancelled`; the lesson is set to `failed`) |

### `/api/live-sessions`
| Method | Path | Role | Response |
|---|---|---|---|
| POST | `/` (`CreateLiveSessionInput`) | teacher owner of a published lesson | `LiveSessionInfo` (201) |
| GET | `/:id` | teacher owner | `LiveSessionInfo` |
| GET | `/:id/results` | teacher owner | `LiveSessionResults` |
| GET | `/pin/:pin` | student enrolled in the lesson's section | `LivePinLookup` (rate-limited) |

The real-time protocol is Socket.IO; see `ClientToServerEvents` and `ServerToClientEvents` in `packages/shared/src/live.ts`.

## Student portal (student role): `/api/student`

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/dashboard` | — | `StudentDashboard` |
| PATCH | `/profile` | `UpdateStudentProfileInput` | `SessionResponse` |
| GET | `/sections` | — | `StudentSection[]` |
| GET | `/sections/preview/:joinCode` | — | `SectionPreview` |
| POST | `/enrollments` | `JoinSectionInput` | `StudentSection` (201); expired codes return `409` |
| GET | `/quizzes` | — | `StudentQuizListItem[]` (published lessons in my sections) |
| GET | `/quizzes/:lessonId` | — | `StudentQuiz` (no answer key) |
| POST | `/quizzes/:lessonId/attempts` | `SubmitQuizAttemptInput` | `QuizAttemptResult` (201; idempotent per `idempotencyKey`) |
| GET | `/quizzes/:lessonId/attempts/latest` | — | `QuizAttemptResult`, or `404` |
| GET | `/assignments` | — | `StudentAssignment[]` (published only, with state `todo`, `submitted`, `late`, `returned` or `closed`) |
| POST | `/assignments/:id/submission` | `SubmitAssignmentInput` (`text`, up to 20,000 characters), as JSON or multipart with files in field `files` | `StudentAssignment`. Create or update. After `dueAt` it is refused when the late policy is `closed`, otherwise accepted and flagged late. Files: PDF, JPEG, PNG, HEIC/HEIF or DOCX, up to 10 MB each, at most the assignment's `maxFiles` |
| DELETE | `/assignments/:id/files/:fileId` | — | `StudentAssignment` (removes one of the student's own files) |
| GET | `/guardians` | — | `Guardian[]` |
| POST | `/guardians` | `GuardianInput` | `Guardian` (201) |
| DELETE | `/guardians/:id` | — | `204` (own guardians only) |

### `/api/student/exams` (student; feature `exams`)
Attempt calls carry the per-attempt device token in the `X-Exam-Token` header. With `singleDevice` on, only one device at a time can hold the attempt.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/` | — | `StudentExamListItem[]` (state `upcoming`, `open`, `in_progress`, `submitted` or `missed`) |
| POST | `/:id/start` | `StartExamInput` (`accessCode` when the exam uses one) | `StartExamResponse` (201 when a new attempt starts, 200 when resuming): `attemptToken` (send it back as `X-Exam-Token`) and the student's `paper` without the answer key. Rate-limited like live PINs |
| GET | `/:id/attempt` | — | `StudentExamPaper` (questions, saved answers, deadline) |
| PUT | `/:id/attempt/answers/:examQuestionId` | `SaveExamAnswerInput` (`selectedIndex` 0–3 or `null`) | `204`. Accepted until the deadline plus 30 seconds |
| POST | `/:id/attempt/events` | `ExamEventInput` (`fullscreen_exit`, `tab_hidden`, `window_blur`, `copy`, `paste`, `context_menu`, `print`, `second_device`, `resume`) | `ExamEventResponse` (`violationCount`, `autoSubmitted`). `context_menu` and `resume` are informational; the rest count as warnings |
| POST | `/:id/attempt/submit` | — | `StudentExamResult` |
| GET | `/:id/result` | — | `StudentExamResult`, subject to the exam's `resultsVisibility` |

## Notifications: `/api/notifications` (any signed-in school user)

"Your request is done." When a background job a person started finishes or fails, the API records one notification for them, sends it live to their open tabs (socket event `notification:new`), and, if they turned push on and the server has VAPID keys, to their phone or desktop through Web Push. Producers call `notify()` (`modules/notifications/notify.ts`): lessons transcribed / questions ready / failed (uploads, classroom-device recordings and the stuck-lesson timeout), AI teaching resources ready / failed, and redeploys or restarts for the super admin who started them. Kinds: `NOTIFICATION_KINDS` in `packages/shared/src/notifications.ts`.

Every route is scoped to the signed-in person (the owner always comes from the session, never from the body or path): someone else's notification is `404`. Platform sessions get `401` here.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `NotificationListQuery`: `before` (ISO time, exclusive cursor), `limit` (1–50, default 20), `unreadOnly` (`true`/`false`) | `NotificationListResponse` (`items` newest first, `unreadCount`, `nextBefore`: pass it as `before` for the next page; `null` at the end) |
| POST | `/:id/read` | — | `NotificationDto`. Idempotent: an already-read notification keeps its first `readAt` |
| POST | `/read-all` | — | `MarkAllReadResponse` (`{ updated }`) |
| GET | `/prefs` | — | `NotificationPrefs` (`{ push }`, default `{ push: true }`). In-app (bell and toast) is always on |
| PUT | `/prefs` | `NotificationPrefs` (strict: unknown fields `400`) | `NotificationPrefs` |
| GET | `/push-key` | — | `PushKeyResponse`: the VAPID public key for `pushManager.subscribe()`, or `{ publicKey: null }` when push is not configured on this server |
| POST | `/push-subscriptions` | `PushSubscriptionInput` (the browser's `PushSubscription.toJSON()`; strict) | `204` |
| DELETE | `/push-subscriptions` | `PushUnsubscribeInput` (`{ endpoint }`) | `204` (also for an endpoint that isn't yours: nothing happens) |

- **Push endpoints (SSRF guard).** `endpoint` must be `https`, ≤ 500 characters, without user info or a port, on a known push service (`PUSH_ENDPOINT_HOSTS`: `fcm.googleapis.com`, `*.push.services.mozilla.com`, `*.notify.windows.com`, `web.push.apple.com`); anything else is `400`. `keys.p256dh` ≤ 128 and `keys.auth` ≤ 64 characters. The sender re-checks the allow-list before every delivery.
- **Subscriptions.** Unique per endpoint (stored with its sha256): an endpoint another account had (someone else signed in on that browser before) moves to the caller. An account keeps its 10 most recent subscriptions (`MAX_PUSH_SUBSCRIPTIONS`); subscribing another drops the oldest. A `404`/`410` from the push service deletes the subscription; 5 failed deliveries in a row delete it too. Subscribe/unsubscribe are not audited.
- **Rate limits** (per account, not per IP): subscribe, unsubscribe and `PUT /prefs` 30 per 15 minutes; `/:id/read` and `/read-all` 120 per minute. The list is not limited (it is paged).
- **De-duplication.** One notification per recipient + kind + entity (lesson, resource, deployment) + attempt: a retried or recovered job never notifies twice.
- **Links** are same-origin paths (`/teacher/lessons/<id>`); `notify()` drops anything else. Titles are short sentences (≤ 200), bodies ≤ 500; no transcripts, marks or other people's names.
- **Live event.** `notification:new` (`NotificationDto`) is sent to the recipient's `user:<id>` room, from the API or (through the Redis `cp:notify` relay) the worker. See `ServerToClientEvents`.
- **Web Push payload.** `PushPayload` JSON (`id`, `title`, short `body`, `link`, `tone`; under 3 KB), TTL one day, urgency `normal`, 5-second timeout per device. iPhone/iPad push works only for the site added to the Home Screen (iOS 16.4+).

## Classroom devices: `/api/devices`

The device contract (headers, endpoints and audio format) is documented at the top of `packages/shared/src/devices.ts`. Devices authenticate with the `X-Device-Id` and `X-Device-Key` headers. They never use the session cookie.

## Platform console (super admin): `/api/platform`

The console API for ClassPulse operators. In production it is reachable only on `PLATFORM_HOST`: the router answers `404` for `/platform` and `/api/platform` on every school address. Every route except the sign-in steps needs a platform session: the `cp_platform` cookie (httpOnly, `SameSite=Strict`, 2 hours) or, for scripts, `Authorization: Platform <token>`. Platform accounts live in `platform_admins`, not in `users`, and are created only with `npm run create-superadmin` (see `docs/agents/deployment.md`).

Most changes are written to the audit log (`audit_logs`, kept 365 days). Codes and passwords are never logged or audited.

### Sign-in: `/api/platform/auth`
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/login` | `PlatformLoginInput` (`email`, `password`) | `PlatformLoginResponse`: a 5-minute `challengeToken`. At first sign-in it also includes `enrolment` (`secret`, `otpauthUri` for the QR code). `409` if `PLATFORM_ENCRYPTION_KEY` is not set |
| POST | `/enroll` | `PlatformEnrollInput` (`challengeToken`, `code`) | `PlatformEnrollResponse` + cookie: confirms the authenticator and returns 10 single-use `recoveryCodes` (shown once) |
| POST | `/verify` | `PlatformVerifyInput` (`challengeToken` and either `code` or `recoveryCode`) | `PlatformSessionResponse` + cookie |
| POST | `/logout` | — | `204`. Revokes every platform session of that admin |
| GET | `/me` | — | `PlatformSessionResponse` (works during a forced password change) |
| POST | `/change-password` | `PlatformChangePasswordInput` | `PlatformSessionResponse` + new cookie |
| POST | `/recovery-codes/regenerate` | `RegenerateRecoveryCodesInput` (`code`) | `RecoveryCodesResponse` (10 new codes; the old ones stop working) |

`/login`, `/enroll`, `/verify` and `/recovery-codes/regenerate` are limited to 5 attempts per 15 minutes per IP and account. Authenticator codes are 6-digit TOTP; each code is accepted once. Recovery codes look like `abcd-2345`. The initial password from `create-superadmin` must be changed straight after the first sign-in.

### Schools: `/api/platform/schools`
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `?q=` | `PlatformSchool[]` |
| POST | `/` | `CreateSchoolInput` (school fields, optional `contact` and `notes`, `admin: { name, email }`) | `CreateSchoolResult` (201): the school, its first admin, a one-time password (shown once) and `invite` |
| GET | `/:id` | — | `PlatformSchoolDetail` (counts, `features`, `limits`, contact, notes) |
| PATCH | `/:id` | `UpdateSchoolInput` | `PlatformSchoolDetail` |
| PUT | `/:id/features` | `InstitutionFeatures` (all seven booleans) | `PlatformSchoolDetail` |
| PUT | `/:id/limits` | `InstitutionLimits` (`maxStudents`, `maxTeachers`, `aiAudioMinutesPerMonth`, `storageGb`; `null` = unlimited) | `PlatformSchoolDetail` |
| POST | `/:id/suspend` | `SuspendSchoolInput` (`reason`, 3–300 characters) | `PlatformSchoolDetail`. Every user of the school is signed out and refused (`403 SCHOOL_SUSPENDED`). No data is deleted |
| POST | `/:id/reactivate` | — | `PlatformSchoolDetail` |
| GET | `/:id/admins` | — | `PlatformSchoolAdmin[]` |
| POST | `/:id/admins` | `SchoolAdminInput` (`name`, `email`) | `CreatedSchoolAdmin` (201) |
| POST | `/:id/admins/:adminId/disable` / `/enable` | — | `PlatformSchoolAdmin` |
| POST | `/:id/admins/:adminId/reset-password` | — | `PasswordResetResult` (a new one-time password) |
| POST | `/:id/admins/:adminId/send-invite` | — | `SendLinkResult` |
| GET | `/:id/:view` | `PlatformViewQuery` (`?q=&page=&pageSize=`) | `Paginated<PlatformViewRow>`; `view` is one of `teachers`, `students`, `sections`, `lessons`, `exams`, `assignments`, `devices`, `live-sessions` (read-only) |

`storageGb` is a warning only; the other limits are enforced.

### Users and settings
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/platform/users` | `?q=` (at least 2 characters) `&role=admin\|teacher\|student` | `PlatformUserHit[]`: search across every school |
| GET | `/api/platform/settings` | — | `PlatformSettings` |
| PUT | `/api/platform/settings` | `UpdatePlatformSettingsInput`: any of `maintenance` (`enabled`, `message`, `blockLogins`), `banner` (`enabled`, `message`, `level`), `defaultModels` (for new schools), `aiPrices` (USD per 1M tokens per LLM model, per audio hour per STT model). Each section is replaced whole | `PlatformSettings` |

### Usage and cost: `/api/platform/stats`
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/` | `PlatformStatsQuery` (`from`, `to`, `institutionId`, `granularity`, default `day`) | `PlatformStats`: totals, time series, per-school rows, AI usage by model and kind, estimated cost |
| GET | `/overview` | — | `PlatformOverviewStats` |
| GET | `/export.csv` | the same, plus `section` = `activity` (default), `schools` or `ai` | CSV download |

AI usage comes from `ai_usage`, one row per provider call (successful or not) with tokens or audio seconds. Kinds: `stt`, `quiz`, `questions`, `remedial`, `grading`, `resource`, `voice`. Cost is not stored. It is estimated when read, from the `aiPrices` rates in settings, so treat it as an estimate and check provider invoices.

### Operations: `/api/platform/ops`
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/health` | — | `PlatformHealth`: database, Redis, worker heartbeat, API process, storage and disk, email, AI providers, classroom devices, backups, the three queues, and `alerts` |
| GET | `/health/history` | `?hours=` (1–720, default 24) | `HealthHistory` (snapshots every 5 minutes, kept 30 days) |
| POST | `/providers/:provider/test` | `provider` = `openai` or `sarvam` | `ProviderTestResult` (audited) |
| GET | `/queues/:name/failed` | `name` = `lesson-generation`, `email` or `resources`; `?limit=` (≤ 200) | `{ items: FailedJob[] }` |
| POST | `/queues/:name/jobs/:id/retry` | — | `{ ok: true }` |
| POST | `/queues/:name/jobs/:id/remove` | — | `{ ok: true }` |
| POST | `/queues/:name/retry-all-failed` | — | `{ ok: true, retried }` |
| GET | `/logs` | `LogsQuery` (`after`, `before`, `level`, `service`, `institutionId`, `q`, `from`, `to`, `limit` ≤ 500) | `AppLogPage` from `app_logs` (kept 14 days) |
| GET | `/logs.csv` | the same | CSV download |
| GET | `/audit` | `AuditQuery` (`actor`, `institutionId`, `action` prefix, `from`, `to`, `page`, `pageSize` ≤ 100) | `AuditLogPage` |
| GET | `/audit.csv` | the same | CSV download |
| GET | `/app` | — | `DeployedApp`, or `CoolifyNotConfigured` (`configured: false` with setup `instructions`) |
| GET | `/deployments` | — | `DeploymentList` (or `CoolifyNotConfigured`) |
| GET | `/deployments/:id/logs` | — | `DeploymentLogs` |
| POST | `/redeploy` | `{ confirm: "REDEPLOY" }` | `DeployActionResult` (audited) |
| POST | `/restart` | `{ confirm: "RESTART" }` | `DeployActionResult` (audited) |

Alerts are raised for: a component that is down, a queue that is unavailable or has failed jobs, a backup older than 26 hours (or a backup folder that is not mounted in production), disk over 85% (critical over 95%), AI provider failures in the last hour, and offline classroom devices.

The deployments routes call the Coolify API with `COOLIFY_API_URL`, `COOLIFY_API_TOKEN` and `COOLIFY_APP_UUID`. Responses are reduced to a fixed set of fields, so environment variables and keys from Coolify are never returned.

`/api/platform/audit` serves the same paged audit list as `/api/platform/ops/audit`.

### Notifications: `/api/platform/notifications`

The same routes, bodies and limits as [`/api/notifications`](#notifications-apinotifications-any-signed-in-school-user), for the signed-in super admin's own notifications (today: their redeploy or restart finished or failed). Only a platform session passes (`authenticatePlatform()`); school sessions get `401`. There is no socket on the console host, so the console polls `GET /`; Web Push works the same way. Platform notifications are never sent to a `user:<id>` socket room.


## Test helpers: `/api/test`

Mounted only when `E2E_MAIL_CAPTURE=true`, which production refuses at start-up. `GET /api/test/emails?to=<address>` returns captured outgoing email for the Playwright `accounts` spec. `POST /api/test/notifications` (school session; body `{ kind, tone, title, body?, link? }`, strict, kinds and tones from `NOTIFICATION_KINDS`/`NOTIFICATION_TONES`) calls `notify()` for the signed-in user and answers `204`, for the notifications e2e spec. It is also refused (`404`) if production ever mounted it.
