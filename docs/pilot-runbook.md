# Pilot runbook

## Before the pilot (T-2 weeks)

- [ ] VPS deployed per `docs/deployment.md`, with `/api/health/ready` green and an uptime monitor configured.
- [ ] Backups are scheduled, **and a restore drill has been done** on a staging VM.
- [ ] The Sarvam and OpenAI keys are set and checked by uploading a 2-minute test lecture. The lesson reaches *Ready for review*.
- [ ] The first admin has been created and has changed their password.
- [ ] Load test passed: 100 students in one live quiz (see "Load test" below).

## Onboarding a school (admin console → Onboarding)

1. **School profile**: name, code and timezone.
2. **Rooms**: one per physical classroom that has a Pi.
3. **Sections**: name, subject, room and teachers. Each section gets a 6-character join code.
4. **Teachers**: create each account and hand over the one-time password in person. Teachers change it at first login.
5. **Students**: import a CSV (`name,rollNumber,email`) into a section. Download the credentials CSV. It is shown once, so print the slips immediately.
6. **Timetable**: optional. It powers the teacher's "Today" view.
7. **Classroom devices**: provision one Pi per room, following `docs/hardware-raspberry-pi.md`.

## A teaching day

1. The teacher opens **Record a class**, picks the section and confirms the room device is *online*, then presses **Start recording**.
2. At the end of class, the teacher presses **Stop recording**. Processing usually finishes in 2–6 minutes, depending on lecture length.
3. The teacher reviews the questions, edits or approves them, and presses **Publish**. Students see the quiz immediately.
4. Optional: **Start live quiz**, then open the projector view. Students join at `/student/live` with the PIN or by scanning the QR code.

## Incident playbook

| Symptom | Action |
|---|---|
| `/api/health/ready` returns 503 | `docker compose … ps`, then check the logs of the failing dependency. Postgres or Redis volume full? `df -h` |
| Lessons stuck in *Queued* | Check the worker: `docker compose … logs worker`, then restart it. Stuck jobs are re-queued on start. |
| Lessons *Failed* with "Speech-to-text is not configured" or "…provider error" | Check the keys and quota at the provider. Then press **Try again** on the lesson. |
| Pi offline | Follow the troubleshooting table in `docs/hardware-raspberry-pi.md`. The teacher can upload a phone recording as a fallback. |
| Student forgot password | Admin → Students → **Reset password**, then hand over the new one-time password. |
| Suspected account compromise | Disable the user (this revokes all of their sessions immediately), then reset the password. |

## Load test

```bash
# from a machine near the VPS (not the VPS itself)
node apps/api/scripts/loadtest-live.mjs --base https://app.school.org \
  --admin 'admin@school.org:<password>' --teacher 'teacher@school.org:<password>' \
  --lesson <publishedLessonId> --students 100
```

The script imports N load-test students into the lesson's section, signs them in, joins a live session and answers every question. It reports p95 acknowledgement latency and dropped answers. Disable or delete the `Load Test NNN` accounts afterwards.

Local reference run (2026-10-10, dev stack on one machine): 100/100 joined, 500/500 answers acknowledged, 0 dropped, ack latency p50 3 ms / p95 5 ms.

**Targets:** p95 under 300 ms, 0 dropped answers, API memory stable.

## Data retention

- Lecture audio is deleted automatically after `AUDIO_RETENTION_DAYS` (30 by default). Transcripts, questions and results are kept.
- Student data is held in Postgres and in the encrypted backups. If an account is deleted, its attempts and guardians are removed in the same cascade.
