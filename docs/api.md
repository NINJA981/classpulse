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

## Health

| Method | Path | Notes |
|---|---|---|
| GET | `/health/live` | Process liveness check. |
| GET | `/health/ready` | Checks DB, Redis and storage. Returns `503` if any check fails. |

## Auth: `/api/auth`

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/login` | `StaffLoginInput` | `SessionResponse` + cookie (admin or teacher) |
| POST | `/student/login` | `StudentLoginInput` | `SessionResponse` + cookie |
| POST | `/logout` | — | `204` and clears the cookie |
| GET | `/me` | — | `SessionResponse` |
| POST | `/change-password` | `ChangePasswordInput` | `SessionResponse` + new cookie; old sessions are revoked |

Logins are rate-limited (`429 RATE_LIMITED`; `LOGIN_RATE_LIMIT` attempts per IP and account per 15 minutes).

Student login finds the school from the roll number. Only when several schools use the same roll number does it return `400` with `details: { field: 'institutionCode' }`, and the login page then asks for the school code.

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
| POST | `/:id/reset-password` | — | `PasswordResetResult` |

### `/api/admin/students`
| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/` | `?sectionId=&q=&page=&pageSize=` | `Paginated<Student>` |
| POST | `/` | `CreateStudentInput` | `CreatedWithPassword<Student>` (201) |
| POST | `/import` | `ImportStudentsInput` | `ImportStudentsResult` |
| PATCH | `/:id` | `UpdateStudentInput` | `Student` |
| DELETE | `/:id` | — | `204` |
| POST | `/:id/reset-password` | — | `PasswordResetResult` |

Students created by an admin must change their password on first login.

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
| PUT | `/:id/assignment` | `AssignmentInput` | `Assignment` |
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
| GET | `/assignments` | — | `StudentAssignment[]` (published only) |
| POST | `/assignments/:id/submission` | `SubmitAssignmentInput` | `StudentAssignment` (create or update until `dueAt`) |
| GET | `/guardians` | — | `Guardian[]` |
| POST | `/guardians` | `GuardianInput` | `Guardian` (201) |
| DELETE | `/guardians/:id` | — | `204` (own guardians only) |

## Classroom devices: `/api/devices`

The device contract (headers, endpoints and audio format) is documented at the top of `packages/shared/src/devices.ts`. Devices authenticate with the `X-Device-Id` and `X-Device-Key` headers. They never use the session cookie.
