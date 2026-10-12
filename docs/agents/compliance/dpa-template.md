# Data Processing Agreement (template)

> **Draft — needs legal review.** Template prepared by engineering on 12 October 2026 from how ClassPulse actually works. It is **not legal advice** and must be reviewed and completed by counsel before any school signs it. Text in **[brackets]** is to be filled in per school; **TODO** items need the owner's decision.

---

**DATA PROCESSING AGREEMENT**

between

**[School legal name]**, [address] (the **"School"**, the Data Fiduciary)

and

**BenX Solutions**, [legal form and registration number — TODO], [registered address — TODO] (**"BenX"**, the Data Processor)

Effective date: [date]. This agreement forms part of the service agreement dated [date] for ClassPulse (the **"Service Agreement"**).

## 1. Definitions

Terms such as *personal data*, *Data Fiduciary*, *Data Processor*, *Data Principal*, *child*, *personal data breach* and *Board* have the meanings given in the **Digital Personal Data Protection Act, 2023** (the **"Act"**) and the **Digital Personal Data Protection Rules, 2025** (the **"Rules"**).

## 2. Roles and scope

2.1 The School is the Data Fiduciary and decides the purposes and means of processing. BenX processes personal data only **on the School's documented instructions** (this agreement, the Service Agreement and the School's use of ClassPulse settings), to provide ClassPulse.

2.2 The subject matter, nature, purposes, categories of data and Data Principals are described in **Annex A**.

2.3 BenX will tell the School promptly if it believes an instruction breaks the Act.

## 3. The School's obligations

3.1 The School will give Data Principals the notice required by the Act and have a lawful basis for the processing.

3.2 For students under 18, the School will obtain and keep records of **verifiable parental consent** (Section 9 of the Act; Rule 10), unless an exemption applies (**verify with counsel**: Fourth Schedule, educational institutions). See `parental-consent-guidance.md`.

3.3 The School will tell parents and students that lessons may be recorded and transcribed, and that AI services, including one in the United States, are used.

3.4 The School will handle Data Principals' requests (access, correction, erasure, grievance), with BenX's help under clause 7.

## 4. BenX's obligations

4.1 **Purpose limitation.** BenX will not use School personal data for any other purpose: no sale, no advertising, no profiling, and **no training of AI models**.

4.2 **Children.** BenX will not track, behaviourally monitor or target advertising at children, except the exam-integrity events the School switches on for secure exams.

4.3 **Confidentiality.** Everyone at BenX with access is bound by confidentiality and has access only as needed.

4.4 **Security.** BenX will keep reasonable security safeguards (Section 8(5) of the Act; Rule 6), including those in **Annex C**.

4.5 **Retention and deletion.** BenX will apply the retention periods in **Annex D** and delete data as described there.

## 5. Sub-processors

5.1 The School authorises the sub-processors listed in **Annex B**.

5.2 BenX will give the School at least **[30] days'** written notice before adding or replacing a sub-processor (**TODO: confirm period**). The School may object on reasonable grounds; if the parties cannot resolve it, the School may end the Service Agreement for the affected part without penalty.

5.3 BenX will impose data protection terms on each sub-processor that are no less protective than this agreement, and stays responsible for them.

## 6. Transfers outside India

6.1 Some processing happens outside India, as shown in Annex B (OpenAI, United States).

6.2 Such transfers are allowed unless restricted by the Central Government under Section 16 of the Act. If a restriction is notified for a country used by a sub-processor, BenX will stop transferring data there and tell the School of the alternative (**verify with counsel**).

## 7. Assistance

7.1 BenX will help the School respond to Data Principal requests. In ClassPulse the School admin can **download a student's data** and **permanently delete a student**. For other requests BenX will help within **[7] working days** (**TODO**).

7.2 BenX will help the School with breach notifications and any Board enquiry.

## 8. Personal data breaches

8.1 BenX will notify the School **without undue delay**, and in any case within **[24] hours** (**TODO: confirm with counsel**) after becoming aware of a personal data breach affecting School data.

8.2 The notice will include what is known of: the nature, extent, timing and location of the breach; the categories and approximate numbers of Data Principals and records; likely consequences; measures taken or proposed; and a contact. BenX will update it as facts emerge, in time for the School to send the Board the detailed report **within 72 hours** (Rule 7) (**verify with counsel**).

8.3 **TODO (counsel):** decide whether BenX notifies the Board and Data Principals on the School's behalf, or only prepares the notices.

8.4 BenX's procedure is in `breach-response-runbook.md`.

## 9. Audit and information

9.1 On reasonable request (no more than once a year, unless after a breach), BenX will provide information needed to show compliance with this agreement: for example this agreement's annexes, security summaries and the results of security assessments.

9.2 The School can see its own audit trail in ClassPulse; the platform keeps an audit log of administrative actions for 365 days.

## 10. End of the service

10.1 On termination, or earlier at the School's written request, BenX will:
- (a) give the School a full export of its data (JSON) within **[14] days** of the request; and
- (b) then **delete** all School personal data, including stored audio and files, within **[30] days** (**TODO**), and confirm deletion in writing.

10.2 Encrypted backups containing School data are overwritten within about **5 weeks** of deletion. Audit-log entries recording actions (without the School link) may be kept for up to 365 days for security. Both are described in Annex D.

## 11. Liability, term and law

11.1 Liability is as set out in the Service Agreement (**TODO: counsel**).

11.2 This agreement lasts as long as BenX processes School personal data.

11.3 Governing law: India. Jurisdiction: courts at **[city]**.

Signed for the School: ____________________ Name / title: __________ Date: ______

Signed for BenX Solutions: ____________________ Name / title: __________ Date: ______

---

## Annex A — Description of processing

| | |
|---|---|
| **Data Principals** | School staff (admins, teachers); students (mostly children under 18); parents and guardians whose contact details are added |
| **Categories of data** | Account data (name, role, email, roll number, department, class membership); guardian contacts; classroom audio and transcripts; quiz, live-quiz, exam and assignment answers, scores, marks and feedback; exam integrity events; teaching content; device and technical data (IP address, browser, classroom device data); logs and audit entries |
| **Sensitive data** | Not intended. Audio and free text may incidentally contain anything said or written |
| **Purposes** | Providing ClassPulse: sign-in, transcription, AI-assisted quiz and teaching material drafting, quizzes, exams, assignments, results, account emails, support, security |
| **Duration** | The Service Agreement term plus the deletion period in clause 10 |

## Annex B — Authorised sub-processors

See `sub-processors.md` (keep this annex in sync):

| Sub-processor | Purpose | Location |
|---|---|---|
| Oracle Cloud Infrastructure | Hosting, database, storage, backups | **TODO: region** |
| Sarvam AI | Speech-to-text | India |
| OpenAI | AI drafting, grading suggestions, optional speech-to-text | United States |
| GoDaddy | Account and reminder emails | **TODO** |

## Annex C — Security measures

- HTTPS everywhere (HSTS being enabled at the edge, October 2026).
- Each school's data is isolated in every query; role-based access for admins, teachers and students.
- Passwords stored as bcrypt hashes; rate-limited sign-in; sessions revoked on password change and when an account is disabled.
- Platform console on a separate address, with password **and** authenticator code, 2-hour sessions and a full audit log.
- Classroom device keys stored only as hashes.
- Encrypted nightly backups (`age`), with the decryption key kept off the server.
- Secrets kept in the deployment platform, never in source code.
- Logs exclude passwords, tokens, cookies and keys.
- Regular security reviews; an external penetration test is planned before scaling (**TODO: date**).

## Annex D — Retention

See `retention-schedule.md`. In summary: lesson audio 30 days; transcripts 365 days; accounts and learning records for the life of the service or until the School deletes them; application logs 14 days; audit log 365 days; backups about 5 weeks.
