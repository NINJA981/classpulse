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


---

## 🏗️ Complete System Architecture & Data Flow (`Admin ⇄ Teacher ⇄ Student ⇄ Backend`)

### 1. System Topology & Page-to-Page Navigation (`flowchart TD`)

```mermaid
flowchart TD
    subgraph AdminPortal["SIH-admin (:5171)"]
        A_Login["/login (Admin Login)"]
        A_Overview["/overview (School KPIs)"]
        A_Classrooms["/classrooms (Sections & Join Codes)"]
        A_Teachers["/teachers (Faculty Directory)"]
        A_Students["/students (Student Directory)"]
        A_Timetable["/timetable (Master Schedule)"]
        A_Settings["/settings (AI Model Routing)"]
    end

    subgraph TeacherPortal["SIH-teacher (:3000)"]
        T_Login["/login (Teacher Login)"]
        T_Home["/ (Dashboard & KPIs)"]
        T_Record["/record-transcribe (Live Mic + Upload)"]
        T_NewLesson["/lessons/new (Multi-Modal Lesson Creator)"]
        T_LessonDetail["/lessons/[id] (Transcript, Quiz & Assignment Editor)"]
        T_LiveHost["/lessons/[id]/live-host (Socket.IO Quiz Host)"]
        T_Analytics["/lessons/[id]/analytics (Mastery Heatmap & Remedial AI)"]
        T_PrevClasses["/previous-classes (Audio Replay & Archive)"]
        T_Timetable["/timetable (Faculty Weekly Grid)"]
        T_Circles["/classes-circle (Fast Test & Student Circles)"]
    end

    subgraph StudentPortal["SIH-student (:3001)"]
        S_Login["/login (Roll No / OTP Login)"]
        S_Dash["/dashboard (Student Home)"]
        S_Join["/join (Join Class via 6-Char Code)"]
        S_Quizzes["/quizzes (Quiz Hub & Live PIN Entry)"]
        S_QuizPlay["/quizzes/[id] (Bilingual Self-Paced Quiz)"]
        S_LiveArena["/quizzes/live (Socket.IO Live Quiz Player)"]
        S_Assign["/assignments (Homework & Deadlines)"]
        S_Guardians["/guardians (Parent Alert Contacts)"]
    end

    subgraph BackendAPI["SIH-backend (:5000)"]
        R_Auth["/api/auth/* (authRoutes.ts)"]
        R_Admin["/api/admin/* (adminRoutes.ts)"]
        R_Lessons["/api/lessons/* (lessonRoutes.ts)"]
        R_Questions["/api/questions/* (questionRoutes.ts)"]
        R_Student["/api/student/* (studentRoutes.ts)"]
        R_LiveQuiz["/api/live-quiz/* + Socket.IO (liveQuizSocket.ts)"]
    end

    subgraph AIServices["AI & Media Pipeline (src/services/)"]
        SVC_FFmpeg["ffmpeg (16kHz Mono 25s Chunker)"]
        SVC_Sarvam["sarvamService.ts (Saaras v3 STT)"]
        SVC_OpenAI["openaiService.ts (GPT-4o-mini / Whisper)"]
        SVC_Gemini["geminiService.ts (Gemini 2.5 Flash Fallback)"]
        SVC_PDF["pdfParseService.ts (PDF/DOCX Extractor)"]
    end

    subgraph Database["SQLite + Drizzle ORM (sqlite.db)"]
        DB_Tables[("users | sections | lessons | questions | assignments | student_quiz_submissions")]
    end

    A_Login --> R_Auth
    A_Overview & A_Classrooms & A_Teachers & A_Students & A_Timetable & A_Settings --> R_Admin

    T_Login --> R_Auth
    T_Home & T_Record & T_NewLesson & T_LessonDetail & T_Analytics & T_PrevClasses --> R_Lessons
    T_LessonDetail --> R_Questions
    T_LiveHost <--> R_LiveQuiz
    T_Timetable & T_Circles --> R_Admin

    S_Login & S_Dash & S_Join & S_Quizzes & S_QuizPlay & S_Assign & S_Guardians --> R_Student
    S_LiveArena <--> R_LiveQuiz

    R_Lessons --> SVC_FFmpeg --> SVC_Sarvam
    R_Lessons --> SVC_PDF
    R_Lessons --> SVC_OpenAI & SVC_Gemini

    R_Auth & R_Admin & R_Lessons & R_Questions & R_Student & R_LiveQuiz <--> DB_Tables
```

---

### 2. Lecture Ingestion ➔ AI Pipeline ➔ Teacher Review ➔ Publish (`sequenceDiagram`)

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant UI_New as SIH-teacher (/lessons/new)
    participant API_T as SIH-teacher (lib/api.ts)
    participant Ctrl_L as SIH-backend (lessonController.ts)
    participant Svc_STT as sarvamService.ts + pdfParseService.ts
    participant Svc_LLM as openaiService.ts / geminiService.ts
    participant DB as SQLite DB (Drizzle ORM)
    participant UI_Review as SIH-teacher (/lessons/[id])

    Teacher->>UI_New: Select Section, Subject, Language & Upload Audio/PDF
    UI_New->>API_T: api.createLesson(formData)
    API_T->>Ctrl_L: POST /api/lessons (upload.array('files'))
    Ctrl_L->>DB: INSERT INTO lessons (status='Processing', audioUrl, docUrls)
    Ctrl_L-->>UI_New: 201 Created { lesson }

    UI_New->>API_T: api.generateLessonContent(lesson.id)
    API_T->>Ctrl_L: POST /api/lessons/:id/generate
    Ctrl_L->>Svc_STT: processAudioFiles() -> transcribeWithSarvam(filePath, language)
    Note over Svc_STT: Splits >25s MP3/WAV via ffmpeg into 25s chunks and calls Sarvam Saaras v3 STT
    Svc_STT-->>Ctrl_L: { sarvamTranscript, whisperTranscript, segments }
    Ctrl_L->>Svc_STT: extractTextFromFiles(docFiles)
    Svc_STT-->>Ctrl_L: documentText

    Ctrl_L->>Svc_LLM: generatePedagogicalContent(combinedContext, subject, language)
    Note over Svc_LLM: Primary: OpenAI gpt-4o-mini (JSON Schema) | Fallback: Gemini 2.5 Flash
    Svc_LLM-->>Ctrl_L: { summary, keyTakeaways, questions[5], assignment }

    Ctrl_L->>DB: UPDATE lessons SET transcript, whisperTranscript, sarvamTranscript, status='Review_Pending'
    Ctrl_L->>DB: INSERT INTO questions (stem, stemLocal, options, optionsLocal, explanation, sourceCitation)
    Ctrl_L->>DB: INSERT INTO assignments (title, tasks, rubric, status='draft')
    Ctrl_L-->>UI_New: 200 OK { lesson, questions, assignment }

    UI_New->>UI_Review: router.push('/lessons/' + lesson.id)
    Teacher->>UI_Review: Compare Whisper vs Sarvam Transcript
    UI_Review->>API_T: api.selectTranscript(lesson.id, 'sarvam')
    API_T->>Ctrl_L: POST /api/lessons/:id/transcript/select
    Ctrl_L->>DB: UPDATE lessons SET selectedTranscriptSource='sarvam', transcript=sarvamTranscript

    Teacher->>UI_Review: Edit / Approve Questions & Assignment
    UI_Review->>API_T: api.updateQuestion(q.id, { approved: true })
    API_T->>Ctrl_L: PATCH /api/questions/:id (questionController.updateQuestion)
    Ctrl_L->>DB: UPDATE questions SET approved=true

    Teacher->>UI_Review: Click "Publish Lesson"
    UI_Review->>API_T: api.publishLesson(lesson.id)
    API_T->>Ctrl_L: POST /api/lessons/:id/publish (approveLesson)
    Ctrl_L->>DB: UPDATE lessons SET status='Approved_Published'
    Ctrl_L->>DB: UPDATE assignments SET status='published'
    Ctrl_L-->>UI_Review: 200 OK { lesson }
```

---

### 3. Student Quiz Submission ➔ Teacher Analytics & Remedial AI Flow (`sequenceDiagram`)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant UI_SQuiz as SIH-student (/quizzes/[id])
    participant API_S as SIH-student (lib/api.ts)
    participant Ctrl_S as SIH-backend (studentQuizController.ts)
    participant DB as SQLite DB (Drizzle ORM)
    participant UI_TAnalytics as SIH-teacher (/lessons/[id]/analytics)
    participant Ctrl_L as SIH-backend (lessonController.ts)
    participant Svc_LLM as openaiService.ts

    Student->>UI_SQuiz: Open /quizzes
    UI_SQuiz->>API_S: apiFetch('/student/quizzes')
    API_S->>Ctrl_S: GET /api/student/quizzes (getAvailableQuizzes)
    Ctrl_S->>DB: SELECT lessons WHERE status='Approved_Published' + approved questions
    Ctrl_S-->>UI_SQuiz: 200 OK { quizzes }

    Student->>UI_SQuiz: Open /quizzes/[id] & Toggle Bilingual Mode (EN / Local)
    UI_SQuiz->>API_S: apiFetch('/student/quizzes/' + id)
    API_S->>Ctrl_S: GET /api/student/quizzes/:id (getQuizById)
    Ctrl_S-->>UI_SQuiz: { id, title, questions (without answer keys) }

    Student->>UI_SQuiz: Select answers & Click "Submit Quiz"
    UI_SQuiz->>API_S: apiFetch('/student/quizzes/' + id + '/submit', POST)
    API_S->>Ctrl_S: POST /api/student/quizzes/:id/submit (submitQuizAnswers)
    Ctrl_S->>DB: Grade answers against questions.correctAnswerIndex
    Ctrl_S->>DB: INSERT INTO student_quiz_submissions (lessonId, studentName, rollNumber, score, totalQuestions, percentage, results)
    Ctrl_S-->>UI_SQuiz: 201 Created { submission, results (with explanations & citations) }

    Note over UI_TAnalytics,Svc_LLM: Teacher opens Class Mastery & Remedial AI (/lessons/[id]/analytics)
    UI_TAnalytics->>Ctrl_L: GET /api/lessons/:id/analytics (getLessonAnalytics)
    Ctrl_L->>DB: SELECT questions + SELECT student_quiz_submissions WHERE lessonId=:id
    Ctrl_L->>Ctrl_L: Compute per-question accuracyPct & classify critical (<50%), moderate (50-74%), mastered (>=75%)
    Ctrl_L->>Svc_LLM: Generate targeted Remedial Notes & Action Steps for weak concepts
    Svc_LLM-->>Ctrl_L: remedialNotes[]
    Ctrl_L-->>UI_TAnalytics: { classAveragePct, criticalGapsCount, questions[], remedialNotes[] }
```

---

### 4. Real-Time Live Gamified Quiz Flow (`Socket.IO` + REST)

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant T_Host as SIH-teacher (/lessons/[id]/live-host)
    participant REST as SIH-backend (liveQuizRoutes.ts)
    participant Socket as SIH-backend (liveQuizSocket.ts)
    participant S_Arena as SIH-student (/quizzes/live)
    actor Student

    Teacher->>T_Host: Click "Launch Live Quiz" on /lessons/[id]
    T_Host->>REST: POST /api/live-quiz/create { lessonId }
    REST->>Socket: createLiveRoom(lessonId, title, subject, className, approvedQuestions)
    REST-->>T_Host: { pin: "482910", questionCount: 5 }
    T_Host->>Socket: emit('host:join', { pin })
    Socket-->>T_Host: emit('room:state', { status: 'lobby', players: [] })

    Student->>S_Arena: Enter 6-digit PIN + Name + Roll No on /quizzes
    S_Arena->>Socket: emit('player:join', { pin, name, rollNumber })
    Socket-->>T_Host: emit('room:players_updated', { players })
    Socket-->>S_Arena: Callback { ok: true, title, subject }

    loop For Each Question (0 .. N-1)
        Teacher->>T_Host: Click "Start Quiz" / "Next Question"
        T_Host->>Socket: emit('host:next_question', { pin })
        Socket-->>T_Host: Broadcast 'question:start' { questionIndex, stem, stemLocal, options, timeLimitSec: 20 }
        Socket-->>S_Arena: Broadcast 'question:start' { questionIndex, stem, stemLocal, options, timeLimitSec: 20 }

        Student->>S_Arena: Tap Option before timer expires
        S_Arena->>Socket: emit('player:submit_answer', { pin, selectedOptionIndex })
        Note over Socket: Calculates speed bonus (up to +500 pts) + streak multiplier (+100 * streak)
        Socket-->>S_Arena: Callback { ok: true }
        Socket-->>T_Host: emit('host:answer_count', { answeredCount, totalPlayers })

        Teacher->>T_Host: Timer ends or Click "Reveal Answer"
        T_Host->>Socket: emit('host:reveal_answer', { pin })
        Socket-->>T_Host: Broadcast 'question:reveal' { correctAnswerIndex, explanation, optionCounts, leaderboard }
        Socket-->>S_Arena: Broadcast 'question:reveal' { correctAnswerIndex, explanation, leaderboard }
    end

    Teacher->>T_Host: Click "Finish & Save Results"
    T_Host->>Socket: emit('host:end_quiz', { pin })
    Socket->>REST: Persist all player scores into student_quiz_submissions table
    Socket-->>T_Host: Broadcast 'quiz:finished' { podium, leaderboard }
    Socket-->>S_Arena: Broadcast 'quiz:finished' { podium, leaderboard }
```

---

### 5. Database Schema & Entity-Relationship Diagram (`erDiagram`)

```mermaid
erDiagram
    USERS ||--o{ LESSONS : "creates (teacherId)"
    SECTIONS ||--o{ LESSONS : "assigned_to (className)"
    LESSONS ||--o{ QUESTIONS : "contains (lessonId)"
    LESSONS ||--o| ASSIGNMENTS : "has (lessonId)"
    LESSONS ||--o{ STUDENT_QUIZ_SUBMISSIONS : "records (lessonId)"

    USERS {
        text id PK
        text name
        text email UK
        text passwordHash
        text role "teacher | admin"
        text schoolName
        integer createdAt
    }

    SECTIONS {
        text id PK
        text name "e.g. Grade 10 - Section B"
        text grade
        text subject
        integer studentCount
    }

    LESSONS {
        text id PK
        text title
        text className
        text subject
        text language "English | Hindi | Tamil | Telugu | Kannada"
        text status "Processing | Review_Pending | Approved_Published | Failed"
        text sourceType "Live_Capture | Uploaded_Audio | PDF_Doc | Mixed"
        text audioUrl
        text documentUrls "JSON string[]"
        text transcript "Active selected transcript"
        text whisperTranscript "Whisper STT output"
        text sarvamTranscript "Sarvam Saaras v3 STT output"
        text selectedTranscriptSource "whisper | sarvam"
        text summary
        text keyTakeaways "JSON string[]"
        text teacherId FK
        integer createdAt
    }

    QUESTIONS {
        text id PK
        text lessonId FK
        text type "mcq"
        text stem "English question"
        text stemLocal "Regional language question"
        text options "JSON string[4]"
        text optionsLocal "JSON string[4]"
        integer correctAnswerIndex "0..3"
        text explanation "English explanation"
        text explanationLocal "Regional explanation"
        text difficulty "Easy | Medium | Hard"
        text topicTag
        text sourceCitation "Transcript timestamp or doc citation"
        integer approved "boolean (0 or 1)"
    }

    ASSIGNMENTS {
        text id PK
        text lessonId FK
        text title
        text dueDate
        integer estimatedMinutes
        text tasks "JSON AssignmentTask[]"
        text rubric "JSON string[]"
        text status "draft | published"
    }

    STUDENT_QUIZ_SUBMISSIONS {
        text id PK
        text lessonId FK
        text studentName
        text rollNumber
        integer score
        integer totalQuestions
        integer percentage
        text answers "JSON Record<questionId, index>"
        text results "JSON GradedQuestionResult[]"
        integer submittedAt
    }
```

---

### 6. Complete Page-to-Function-to-Endpoint Reference Matrix

#### Admin Portal (`SIH-admin` — Port `5171`)
| Page | Frontend Function | Backend Endpoint | Backend Handler | State / DB Table |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `AuthContext.login()` | `POST /api/auth/login` | `authController.login` | `users` |
| `/overview` | `apiFetch('/admin/overview')` | `GET /api/admin/overview` | `adminRoutes.ts` | Aggregates `sections`, `users`, `lessons`, `questions`, `student_quiz_submissions` |
| `/classrooms` | `createSection()`, `saveEdit()`, `removeSection()`, `regenerateJoinCode()` | `GET/POST/PATCH/DELETE /api/admin/sections` | `adminRoutes.ts` | `sections` + `sectionMeta` (`joinCode`, `room`) |
| `/teachers` | `createTeacher()`, `deleteTeacher()` | `GET/POST/DELETE /api/admin/teachers` | `adminRoutes.ts` | `users` |
| `/students` | `createStudent()`, `deleteStudent()` | `GET/POST/DELETE /api/admin/students` | `adminRoutes.ts` | `extraStudents` + `sections.studentCount` |
| `/timetable` | `saveCell()`, `persistTimetable()` | `GET/PUT /api/admin/timetables` | `adminRoutes.ts` | `storedTimetables` (synced with Teacher `/timetable`) |
| `/settings` | `saveModels()` | `GET/PATCH /api/admin/settings/models` | `adminRoutes.ts` | `modelSettings` (`sttPrimary`, `llmPrimary`, `ttsProvider`) |

#### Teacher Portal (`SIH-teacher` — Port `3000`)
| Page | Frontend Function (`lib/api.ts`) | Backend Endpoint | Backend Handler & Services | State / DB Table |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `api.login()` | `POST /api/auth/login` | `authController.login` | `users` |
| `/` | `api.getLessons()` | `GET /api/lessons` | `lessonController.getLessons` | `lessons`, `questions`, `assignments` |
| `/record-transcribe` & `/lessons/new` | `api.createLesson()` ➔ `api.generateLessonContent()` | `POST /api/lessons` ➔ `POST /api/lessons/:id/generate` | `createLesson` ➔ `generateLessonContent` ➔ `transcribeWithSarvam` ➔ `generatePedagogicalContent` | `lessons`, `questions`, `assignments` |
| `/lessons/[id]` | `api.getLessonById()`, `api.selectTranscript()`, `api.updateQuestion()`, `api.updateAssignment()`, `api.publishLesson()` | `GET /api/lessons/:id`, `POST /api/lessons/:id/transcript/select`, `PATCH /api/questions/:id`, `PATCH /api/lessons/:id/assignment`, `POST /api/lessons/:id/publish` | `getLessonById`, `selectTranscript`, `updateQuestion`, `updateLessonAssignment`, `approveLesson` | `lessons`, `questions`, `assignments` |
| `/lessons/[id]/live-host` | `api.createLiveQuizSession()` + Socket.IO `host:*` | `POST /api/live-quiz/create` + `ws://localhost:5000` | `liveQuizRoutes.ts` + `initLiveQuizSocket` | Live rooms + `student_quiz_submissions` |
| `/lessons/[id]/analytics` | `api.getLessonAnalytics()` | `GET /api/lessons/:id/analytics` | `lessonController.getLessonAnalytics` | `questions`, `student_quiz_submissions` |
| `/previous-classes` | `api.getLessonsPage()`, `api.getLessonAudioUrl()` | `GET /api/lessons?page=1`, `GET /api/lessons/:id/audio` | `getLessons`, `streamLessonAudio` | Streams audio from `uploads/` |
| `/timetable` & `/classes-circle` | `api.getTimetables()`, `api.getStudents()`, `api.createStudent()` | `GET /api/admin/timetables`, `GET/POST /api/admin/students` | `adminRoutes.ts` | Synced with Admin Console |

#### Student Portal (`SIH-student` — Port `3001`)
| Page | Frontend Function (`lib/api.ts`) | Backend Endpoint | Backend Handler | State / DB Table |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | `loginWithPassword()`, `requestOtp()`, `verifyOtp()` | `POST /api/student/auth/*` | `studentRoutes.ts` | Student JWT session |
| `/dashboard` | `apiFetch('/student/enrollments')`, `apiFetch('/student/quizzes')`, `apiFetch('/student/assignments')` | `GET /api/student/enrollments`, `/quizzes`, `/assignments` | `studentRoutes.ts` & `studentQuizController.ts` | `sections`, `lessons`, `assignments` |
| `/join` | `apiFetch('/student/sections')`, `apiFetch('/student/enrollments', POST)` | `GET /api/student/sections`, `POST /api/student/enrollments` | `studentRoutes.ts` | Verifies 6-char `joinCode` & increments `sections.studentCount` |
| `/quizzes` & `/quizzes/[id]` | `apiFetch('/student/quizzes/:id')`, `apiFetch('/student/quizzes/:id/submit', POST)` | `GET /api/student/quizzes/:id`, `POST /api/student/quizzes/:id/submit` | `getQuizById`, `submitQuizAnswers` | Grades answers & inserts into `student_quiz_submissions` |
| `/quizzes/live` | Socket.IO `player:join`, `player:submit_answer` | `ws://localhost:5000` | `initLiveQuizSocket` | Real-time gameplay & leaderboard |
| `/assignments` | `apiFetch('/student/assignments')` | `GET /api/student/assignments` | `studentRoutes.ts` | `assignments` |
| `/guardians` | `apiFetch('/student/guardians', GET/POST/DELETE)` | `GET/POST/DELETE /api/student/guardians` | `studentRoutes.ts` | `studentGuardians` |
