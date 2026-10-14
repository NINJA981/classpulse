# Personal data breach response runbook

> **Draft — needs legal review.** Prepared 12 October 2026. Every legal deadline below is marked **(verify with counsel)**. Fill in the contacts table before you need it.

A **personal data breach** is any unauthorised processing, or accidental disclosure, access, sharing, change, loss or destruction of personal data that affects its confidentiality, integrity or availability (DPDP Act 2023, section 2(u)). Examples for ClassIQ:
- one school can see another school's data;
- a leaked database dump, backup archive or log export;
- a stolen admin, platform or server credential that was used;
- students' work or recordings sent to the wrong people;
- ransomware, or loss of the server **and** its backups.

ClassIQ holds **children's data**. Treat every suspected breach as serious until it is ruled out.

## Roles

BenX Solutions is the **Data Processor**; each school is the **Data Fiduciary**. Under the DPDP Act the school is responsible for notifying the Data Protection Board and affected people. Our job is to **tell the school without delay**, give it everything it needs, and (where the DPA says so) prepare the notices for it. **TODO (counsel):** confirm in the DPA whether BenX notifies the Board on the school's behalf.

## Contacts (fill in now)

| Role | Name | Phone | Email |
|---|---|---|---|
| Incident lead (owner, BenX Solutions) | **TODO** | **TODO** | **TODO** |
| Backup incident lead | **TODO** | **TODO** | **TODO** |
| Grievance officer | **TODO** | **TODO** | **TODO** |
| Legal counsel | **TODO** | **TODO** | **TODO** |
| Each school's contact | From the console: **Schools → school → Overview → Contact** | | |
| Data Protection Board of India | **TODO: official breach-intimation channel** | | |
| CERT-In | incident@cert-in.org.in (**verify**) | +91-1800-11-4949 (**verify**) | |
| Oracle Cloud support | **TODO** | | |
| Sarvam AI / OpenAI security contacts | **TODO** | | |

## Timeline at a glance

| When | What |
|---|---|
| **0 – 1 h** | Detect, open an incident log, call the incident lead, start containment, **preserve evidence**. |
| **Within 6 h of noticing** | If it is a reportable cyber incident under the **CERT-In Directions of 28 April 2022** (for example data breach or leak, unauthorised access to IT systems, ransomware): **report to CERT-In** **(verify with counsel)**. |
| **Without delay** (same day) | **Tell every affected school** (Data Fiduciary): what we know so far. |
| **Without delay** | The school (with our help) tells the **Data Protection Board** and **each affected person** (Rule 7(1) and 7(2)(a), DPDP Rules 2025) **(verify with counsel)**. |
| **Within 72 h** of becoming aware (or longer if the Board allows) | **Detailed report to the Board**: updated description, facts, circumstances and reasons; mitigation; findings about who caused it; measures to stop it happening again; a report on the notices sent to affected people (Rule 7(2)(b)) **(verify with counsel)**. |
| Within 2 weeks | Post-incident review, fixes shipped, runbook updated. |

> The DPDP Rules 2025 were notified in November 2025, and most obligations, including Rule 7, are expected to apply about 18 months later (around May 2027). **Verify the commencement date with counsel.** Follow this runbook now anyway: schools expect it, and CERT-In reporting already applies.

## 1. Detection

Signals to watch:
- console **Health → Alerts**, **Logs** (errors, 401/403 spikes), **Audit log** (unexpected exports, password resets, platform sign-ins, `student.export`, `platform.school.export`, `platform.school.delete`);
- reports from a school, teacher, parent or student, or a security researcher;
- a provider notice (Oracle, Sarvam, OpenAI, GoDaddy);
- unusual server activity: SSH logins, new containers, disk or CPU spikes.

Whoever notices: **write down the time you noticed**, what you saw, and tell the incident lead immediately. Do not investigate alone on the production server, and do not delete anything.

## 2. Containment (stop the bleeding)

Pick what fits; record every action with its time in the incident log.

- **Compromised school account:** console → school → disable the account, or reset its password (sessions are revoked).
- **Compromised school (wide):** console → **Suspend** the school (everyone is signed out).
- **Platform admin compromise:** change the password, regenerate recovery codes, rotate `PLATFORM_ENCRYPTION_KEY` (with care: re-enrolment needed), and delete Coolify API tokens.
- **Whole service:** turn on **maintenance mode** with "block sign-ins" (console → Settings), or stop the app in Coolify.
- **Leaked secrets:** rotate `JWT_SECRET` (signs everyone out), the database password, `SARVAM_API_KEY`, `OPENAI_API_KEY`, `SMTP_PASS`, the Coolify token and SSH keys. Revoke and re-enrol classroom devices if device keys leaked.
- **Network:** close ports in the OCI Security List; block attacker IP addresses.
- **Provider breach:** pause that provider (switch speech-to-text provider in AI settings; stop AI generation) until it is understood.

## 3. Preserve evidence (before changing more)

- **Do not** wipe or rebuild the server before taking copies.
- Export the console **Audit log** and **Logs** as CSV (logs are only kept 14 days).
- Copy container logs: `docker logs <container> > file` for api, worker, router and Traefik.
- Copy relevant `audit_logs` and `app_logs` rows with `pg_dump --table` into an encrypted file.
- Take an **OCI boot-volume backup or snapshot** of the instance.
- Keep the latest encrypted backup archives aside so rotation does not delete them.
- Save emails, screenshots and messages from whoever reported it.
- Store everything encrypted, off the server, with a note of who collected it and when (chain of custody).

## 4. Assessment

Answer these in the incident log:
1. What happened, and how? When did it start, and when did it stop?
2. Which **schools** are affected? Which **people** (count by role; how many are children)?
3. Which **data** is affected: accounts, guardian contacts, audio, transcripts, grades, exam data, submissions, files?
4. Was it **read**, **copied**, **changed** or **lost**? Is it still exposed?
5. What is the likely **harm** (for example contact details of children exposed, grades changed)?
6. Is it still going on? Are the containment steps working?

Useful queries: the audit log filtered by actor, IP or action; `app_logs` by request id or user id; per-school counts from the console.

## 5. Notification

### To each affected school (always; without delay)
Send to the school contact and the school admin(s). Template:

> **Subject: ClassIQ security incident affecting [School name] — [date]**
>
> We are writing to tell you about a security incident that affects personal data your school holds in ClassIQ.
> **What happened:** [plain description] on [date/time], noticed on [date/time].
> **Data involved:** [categories], for about [number] people ([number] students).
> **What we have done:** [containment steps].
> **What you may need to do:** [for example ask users to change passwords].
> **Your legal duties:** as the Data Fiduciary, your school must inform the Data Protection Board of India and the affected people. We have attached draft notices and will send a detailed report within [48] hours so you can meet the 72-hour deadline.
> **Contact:** [incident lead, phone, email].

### To the Data Protection Board (by or with the school) **(verify with counsel)**
- **Without delay:** a short intimation with what is known.
- **Within 72 hours:** the detailed report (see the timeline above).

### To affected people (by or with the school) **(verify with counsel)**
Plain language, in the school's usual channel (for children: **to their parents**). Rule 7(1) asks for:
- a description of the breach, including its nature, extent, timing and location;
- the likely consequences for them;
- what has been done and is being done to reduce the risk;
- safety steps they can take;
- contact details of someone who can answer their questions.

### To CERT-In **(verify with counsel)**
Within 6 hours of noticing, for incident types in the CERT-In Directions, using CERT-In's incident reporting form.

### Others
- Providers involved (Oracle, Sarvam, OpenAI, GoDaddy), if the breach came through them or affects them.
- The police, for crimes such as extortion, if counsel advises.

## 6. Recovery

- Fix the root cause; deploy and verify.
- Restore from backup if data was lost or changed (`infra/restore.sh`, handbook section 15.2).
- Lift suspension or maintenance only when it is safe.
- Watch closely for 2 weeks (logs, audit, alerts).

## 7. After the incident

- Write a blameless post-incident review within 2 weeks: timeline, cause, impact, what worked, what to change.
- Update this runbook, the security audit and `SECURITY-AUDIT.local.md`.
- Keep the incident log and evidence for **at least one year** (**verify the period with counsel**).

## Incident log template

| Time (IST) | Who | What was seen or done |
|---|---|---|
| | | |
