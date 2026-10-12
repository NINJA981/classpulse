# Pilot runbook

The pilot runs at `https://classpulse.benxsolutions.in` (schools) and `https://ops.benxsolutions.in` (super admin console).

## Before the pilot (T-2 weeks)

- [ ] Server deployed per `docs/deployment.md`, with `/api/health/ready` green and an uptime monitor configured.
- [ ] Backups are scheduled, **and a restore drill has been done** on a staging VM.
- [ ] The Sarvam and OpenAI keys are set and checked by uploading a 2-minute test lecture. The lesson reaches *Ready for quiz*; **Generate quiz** then brings it to *Needs review*.
- [ ] Email is configured (the `SMTP_*` values in Coolify's **Production** section) and a test invitation arrives.
- [ ] A super admin has been created with `create-superadmin`, has signed in at `/platform/login` on the console address, enrolled an authenticator, saved the recovery codes and changed the one-time password.
- [ ] Load test passed: 100 students in one live quiz (see "Load test" below).

## Onboarding a school

### In the console (super admin)

1. **Console → Schools → New school**: school name, code, time zone, academic year, and the first admin's name and email.
2. The first admin's one-time password is shown once. With email configured, the admin also gets a set-password link (valid 72 hours).
3. Optional: **Features & limits** to switch features off or cap students, teachers or AI audio minutes.

The `createAdmin` command on the server still works as a fallback (`docs/deployment.md`).

### In the admin console (school admin, signs in at `/admin/login`)

The **Onboarding** page lists these steps:

1. **School profile**: name, code and timezone.
2. **Rooms**: one per physical classroom that has a Pi.
3. **Sections**: name, subject, room and teachers. Each section gets a 6-character join code.
4. **Teachers**: add them one at a time or import a CSV (`name,email,department`). With email configured, each teacher gets an invitation link; otherwise hand over the one-time password in person. Teachers sign in at `/teacher/login` and set their own password at first sign-in.
5. **Students**: import a CSV (`name,rollNumber,email`) into a section. Download the credentials CSV. It is shown once, so print the slips immediately. Students sign in at `/student/login` with roll number and password, and a short guided tour starts on their first visit to Home. Students with an email address also get an invitation link. The GoDaddy mailbox sends at most about 250–300 emails a day, so split very large imports across days or rely on the printed slips.
6. **Timetable**: optional. It powers the teacher's "Today" view.
7. **Classroom devices**: provision one Pi per room, following `docs/hardware-raspberry-pi.md`.

`/login` is only a chooser that links to the three sign-in pages. Each page accepts only its own role.

## A teaching day

1. The teacher opens **Record a class**, picks the section and confirms the room device is *online*, then presses **Start recording**.
2. At the end of class, the teacher presses **Stop recording**. Transcription usually finishes in 1–3 minutes, depending on lecture length; the lesson is then *Ready for quiz*.
3. On the lesson page the teacher picks the **number of questions** and the **difficulty** (Easy, Medium, Hard or Mixed) and presses **Generate quiz** (about 30 seconds).
4. The teacher reviews the questions, edits or approves them, and presses **Publish**. Students see the quiz immediately. **Change questions** adds more questions, replaces the unapproved ones, or starts over.
5. Optional: **Start live quiz**, then open the projector view. Students join at `/student/live` with the PIN or by scanning the QR code.

**Do not deploy during class hours.** Every deploy restarts all containers, and the site answers `503` for about 30–60 seconds.

## Incident playbook

| Symptom | Action |
|---|---|
| `/api/health/ready` returns 503 | If a deploy is running, wait a minute. Otherwise check the containers in Coolify (or `docker compose … ps`), then the logs of the failing dependency. Postgres or Redis volume full? `df -h` |
| Lessons stuck in *Queued* | Check the worker: `docker compose … logs worker`, then restart it. Stuck jobs are re-queued on start. |
| Lessons *Failed* with "Speech-to-text is not configured" or "…provider error" | Check the keys and quota at the provider. Then press **Try again** on the lesson. While Sarvam is down, only English lectures can be transcribed (with Whisper, Admin → AI settings). |
| Pi offline | Follow the troubleshooting table in `docs/hardware-raspberry-pi.md`. The teacher can upload a phone recording as a fallback. |
| Student or teacher forgot password | **Forgot password?** on the sign-in page, if the account has an email address. Otherwise Admin → Teachers/Students → **Reset password**, then hand over the new one-time password. |
| Invitation or reset emails don't arrive | Console → Health → Email and the `email` queue. Check the `SMTP_*` values are in Coolify's **Production** section and `SMTP_PASS` matches the mailbox password. Retry failed emails from the queue. |
| School admin locked out | Console → the school → **Admins** → reset password or resend invite. |
| Super admin sees "Too many attempts" | 5 attempts per 15 minutes per connection and account. Wait 15 minutes. |
| Suspected account compromise | Disable the user (this revokes all of their sessions immediately), then reset the password. |

## Load test

```bash
# from a machine near the server (not the server itself)
node apps/api/scripts/loadtest-live.mjs --base https://classpulse.benxsolutions.in \
  --admin 'admin@school.org:<password>' --teacher 'teacher@school.org:<password>' \
  --lesson <publishedLessonId> --students 100
```

The script imports N load-test students into the lesson's section, signs them in, joins a live session and answers every question. It reports p95 acknowledgement latency and dropped answers. Disable or delete the `Load Test NNN` accounts afterwards.

Results:
- Local reference run (2026-10-10, dev stack on one machine): 100/100 joined, 500/500 answers acknowledged, 0 dropped, ack latency p50 3 ms / p95 5 ms.
- Live run (2026-10-11/12, the production site over the internet): 0 join failures, 500/500 answers acknowledged, p95 ack 46 ms.

**Targets:** p95 under 300 ms, 0 dropped answers, API memory stable.

## Data retention

- Lecture audio is deleted automatically after `AUDIO_RETENTION_DAYS` (30 by default). Transcripts, questions and results are kept.
- Student data is held in Postgres and in the encrypted backups. If an account is deleted, its attempts and guardians are removed in the same cascade.
