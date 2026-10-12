# ClassPulse sub-processors

> **Draft — needs legal review.** Prepared 12 October 2026 by engineering from the code and the handbook. Items marked **TODO** need the owner's input. Counsel must review before this list is given to schools.

BenX Solutions runs ClassPulse as a **Data Processor** for each school (the **Data Fiduciary** under the DPDP Act 2023). The providers below process personal data on our behalf. Each receives only what its task needs.

| Provider | What it does for ClassPulse | Personal data it receives | Where | When it is used |
|---|---|---|---|---|
| **Oracle Cloud Infrastructure** (Oracle) | Hosts the server: database, stored files (lesson audio, submission files, teacher materials), backups and logs | Everything ClassPulse stores | **TODO: confirm the OCI region** (tenancy "benxsolutions", instance `benx`) | Always |
| **Sarvam AI** | Speech-to-text (default provider, `saaras:v3` / `saarika:v2.5`) | Lesson audio (which may contain students' voices) and teachers' voice requests (up to 60 s) | India | Every transcription while Sarvam is the school's provider |
| **OpenAI** | Quiz, summary and assignment drafting; teaching tools (lesson plans, worksheets, question papers, presentations); remedial plans; AI grading suggestions; speech-to-text when a school picks Whisper | Transcript text, lesson title and subject, teacher requests, course and material text, aggregated class accuracy. **For grading suggestions only:** the student's typed answer and attached JPEG/PNG photos and their file names (never the student's name). **For Whisper only:** lesson audio | United States (**cross-border transfer**) | When a teacher generates content or asks for a grading suggestion; transcription only if the school chose Whisper |
| **GoDaddy** (email, mailbox `admin@benxsolutions.in` via SMTP) | Sends invitations, password-reset links and assignment reminders | Recipient email address and name, school name, the message | **TODO: confirm GoDaddy's mail data location** | When email is configured and an email is sent |

## Not sub-processors (for completeness)

- **Coolify** is self-hosted on our own OCI server; it is software, not a separate provider.
- **GoDaddy DNS** resolves our domain names; it receives no personal data.
- **Let's Encrypt** issues TLS certificates; it receives no personal data.
- **GitHub** holds the source code; it holds no school data.
- **No analytics, advertising or tracking services** are used in the web app.

## Provider terms to confirm (TODO)

- [ ] **OpenAI:** confirm the current API data-usage terms (API data not used for training by default; abuse-monitoring retention, often up to 30 days). Consider whether zero-data-retention is available for our account. Record the result here and in the privacy notice.
- [ ] **Sarvam AI:** confirm whether audio and transcripts are stored after processing, for how long, and whether they are used for model training. Get a data processing agreement.
- [ ] **Oracle:** confirm the region and that the Oracle Cloud data processing agreement applies to our account.
- [ ] **GoDaddy:** confirm data location and email retention terms. Consider moving to a transactional email provider with a DPA (Amazon SES Mumbai, for example).
- [ ] Keep a signed DPA, or the provider's standard DPA, for each provider on file.

## Cross-border transfers

- OpenAI processes data in the **United States**.
- Under section 16 of the DPDP Act, transfers are allowed unless the Government of India restricts transfers to that country. No such restriction for the US is known at the time of writing. **Verify with counsel**, and re-check whenever the Government publishes a notification.
- Schools must be told about this transfer: in the DPA (Annex B) and the privacy notice.
- Long-term plan (`docs/research/local-models-rnd.md`): self-hosted models, which would remove the OpenAI transfer.

## Changing this list

1. Before adding or replacing a sub-processor, update this file, the privacy notice (`apps/web/app/privacy/page.tsx`, section "Who else handles data") and DPA Annex B.
2. Email every school's contact **at least 30 days before** the change (**TODO: confirm the notice period with counsel and in the DPA**), so a school can object.
3. Record the date of the notice in the change log below.

## Change log

| Date | Change |
|---|---|
| 12 Oct 2026 | First version. |
