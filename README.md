# SIH-backend — ClassPulse unified backend (MongoDB)

Express + MongoDB backend for the teacher/student dashboards, now integrated
with the **lecture pipeline** sidecar: teacher audio uploads are transcribed
(Sarvam batch STT), refined, and turned into quiz questions + summaries by the
pipeline — questions land in the `Question` collection for teacher review.

## The flow

```
Teacher dashboard          SIH-backend                    Pipeline sidecar
─────────────────       ───────────────────          ────────────────────────
lessons/new ──────────▶ POST /api/lessons (draft)
                        POST /api/lessons/:id/source  (upload → /uploads)
                        POST /api/lessons/:id/generate ──▶ status: queued
                           (background job) ──────────────▶ POST /v1/ingest/audio-file
                        polls status:
                          transcribing  ◀── Sarvam batch STT
                          generating    ◀── refinement + knowledge + quiz
                          validating    ◀── question mapping
                        ready_for_review ◀── questions in Mongo
review page ──────────▶ approve/edit questions ──▶ POST /api/lessons/:id/approve
                                                     status: published
Student dashboard ────▶ GET /api/student/quizzes            (published lessons)
                       GET /api/student/quizzes/:id         (quiz w/o answers)
                       POST /api/student/quizzes/:id/submit (server-side grading)
```

## Run order (3 terminals)

```bash
# 1. Pipeline sidecar (terminal 1, from the pipeline repo)
cp .env.example .env    # set STT_PROVIDER=cloud-sarvam, SARVAM_API_KEY,
                        # LLM_PROVIDER=openai, OPENAI_API_KEY, EMBED_API_KEY
npm install && npm run prisma:push && npm run dev

# 2. This backend (terminal 2)
cp .env.example .env    # set PIPELINE_API_KEY = the pipeline's EMBED_API_KEY
npm install && npm run dev

# 3. Dashboards (terminals 3+4)
cd ../SIH-teacher && npm run dev    # :3000
cd ../SIH-student && npm run dev    # :3001
```

## Pipeline-specific env

| Variable | Default | Purpose |
|---|---|---|
| `PIPELINE_URL` | `http://localhost:4000` | Pipeline API base URL |
| `PIPELINE_API_KEY` | — | The pipeline's `EMBED_API_KEY` (server-side only) |

`GET /api/health` reports `pipeline: { ok, detail }` connectivity.

## New endpoints

| Route | Purpose |
|---|---|
| `GET /api/student/quizzes` | Published lesson quizzes for the student dashboard |
| `GET /api/student/quizzes/:lessonId` | Quiz payload (no correct answers) |
| `POST /api/student/quizzes/:lessonId/submit` | Server-side grading (MCQ + keyword-overlap for short answers) |
| `POST /api/lessons/:id/generate` | Now runs the **real** pipeline job (202, async) |
| `POST /api/lessons/:id/approve` | Publishes (requires ≥1 approved question) |

## Notes

- `Question.sourceCitation` carries the lecture timestamp (`MM:SS–MM:SS`) the
  question was generated from — shown to students in the results view.
- Only `approved` questions reach students; publish requires ≥1 approved.
- Generation failures land in `lesson.status='failed'` + `failureReason`
  (the teacher dashboard already renders this state).
