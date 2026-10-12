# ClassPulse retention schedule

> **Draft — needs legal review.** Prepared 12 October 2026 from the code. Counsel should confirm each period, especially the log periods (see "Open legal questions").

How long each kind of data is kept, and what deletes it. "Automatic" means a timed task in the worker does it; nobody has to remember.

| Data | Kept for | How it is deleted | Where it is set |
|---|---|---|---|
| **Lesson audio** (lecture WAV) | **30 days** after upload | Automatic: `jobs/retention.ts` deletes the file and clears the lesson's audio fields | `AUDIO_RETENTION_DAYS` (default 30) |
| Lessons stuck in recording or processing | Failed after 48 hours, then their audio follows the 30-day rule | Automatic: `jobs/retention.ts` | `STUCK_LESSON_HOURS` = 48 (code constant) |
| **Transcripts** (text and timestamped segments) | **365 days** after the lesson was created | Automatic: `jobs/retention.ts` (`purgeOldTranscripts`). The lesson, summary and quiz remain | `TRANSCRIPT_RETENTION_DAYS` (default 365) |
| Raw recording chunks from classroom devices | Until the recording is assembled into one file (minutes); leftovers after 24 h | Automatic: on finalise, and the orphan sweep (`jobs/storageSweep.ts`) | — |
| Orphaned stored files (no database row) | 24 hours | Automatic: `jobs/storageSweep.ts` | `ORPHAN_MIN_AGE_MS` (code constant) |
| **Accounts** (admins, teachers, students) | While the school uses ClassPulse | The school admin deletes them (students: **Delete permanently**), or school offboarding | — |
| Guardians, enrolments, quiz/exam/live results, submissions and files | With the student's account | Deleted with the student (database cascade, and files removed from storage) | — |
| Exam integrity events | With the exam attempt | Deleted with the exam or the student | — |
| Teacher materials, teaching resources, courses | While the school uses ClassPulse | Deleted by the teacher, or with the teacher or school | — |
| Password-set links (hash only) | Until used or expired (72 h); rows stay with the account | Deleted with the account | — |
| **Application logs** (`app_logs`) | **14 days** | Automatic: `jobs/opsTasks.ts` | `LOG_RETENTION_DAYS` = 14 (code constant) |
| **Audit log** (`audit_logs`) | **365 days** | Automatic: `jobs/opsTasks.ts` | `AUDIT_RETENTION_DAYS` = 365 (code constant) |
| Health snapshots (no personal data) | 30 days | Automatic: `jobs/opsTasks.ts` | `HEALTH_SNAPSHOT_RETENTION_DAYS` = 30 |
| Email log (recipient stored only as a SHA-256 hash) | **No limit yet** | — | **Gap: add a 365-day purge** |
| AI usage records (school, model, tokens; no personal data) | No limit (billing records) | — | — |
| **Encrypted backups** (database and audio) | **About 5 weeks**: 7 nightly + 4 weekly | `infra/backup.sh` rotation | `rotate … 7` / `rotate … 4` |
| Router access logs (Caddy/Traefik) | **TODO: confirm** (container log rotation) | Docker log rotation | Coolify / Docker settings |
| A school's data after offboarding | Deleted when the platform admin deletes the school (after an export); still in backups for up to 5 weeks | Platform console → school → Data & offboarding | — |

## Deletion requests (erasure)

- **One student:** the school admin uses **Download data** (if a copy was asked for), then **Delete permanently**. All rows cascade; stored files are removed. The audit log keeps entries about the account (for example its sign-ins) until they age out at 365 days. Backups age out within about 5 weeks.
- **A whole school:** suspend it, export it, then delete it from the platform console (typed school code). Every row and stored file is removed. Audit entries are kept, unlinked from the school, for up to 365 days.

## Open legal questions (verify with counsel)

1. **DPDP Rules 2025, Rule 6 (security safeguards)** asks for logs to be kept for **one year** to detect unauthorised access, unless the law requires otherwise. Our audit log is 365 days, but application logs are 14 days. Is the audit log enough?
2. **CERT-In Directions (28 April 2022)** require ICT system logs to be kept for **180 days**, within India. Application and router logs are kept for much less, and the OCI region is not yet confirmed as India.
3. Should transcripts be kept for a shorter time (for example the academic year), given they may contain children's voices turned into text?
4. Should backups be kept for longer, or shorter, given that erased data survives in them for up to 5 weeks?
5. Is any record (for example grades) subject to a school-side legal retention period (board or state rules), which the school rather than ClassPulse should manage?
