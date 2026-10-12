# Parental consent: guidance for schools

> **Draft — needs legal review.** Prepared 12 October 2026. This is guidance for schools using ClassPulse, not legal advice. Each school should check it with its own advisers.

## Why this matters

Under India's **Digital Personal Data Protection Act, 2023** (DPDP Act), anyone **under 18 is a child**. Section 9 says a Data Fiduciary must get **verifiable consent from a parent or lawful guardian** before processing a child's personal data. It also says a Data Fiduciary must not do processing likely to harm a child, or track, behaviourally monitor or target advertising at children.

When your school uses ClassPulse, **your school is the Data Fiduciary** and BenX Solutions is your **Data Processor**. ClassPulse cannot collect consent for you: you know the families, and you hold the records.

> **Educational institutions.** The DPDP Rules, 2025 (Fourth Schedule) exempt some processing by educational institutions from the consent and tracking rules, to the extent needed for educational activities or children's safety. **Verify with counsel** how far this covers ClassPulse (for example recordings, AI processing and exam integrity events). Until counsel says otherwise, **collect consent anyway**: it is simple, and parents expect it.

## What the school must do

1. **Give parents a clear notice** before their child starts using ClassPulse. It should cover:
   - what ClassPulse is used for at your school;
   - what data is used (see the sample form);
   - that **lessons may be recorded** and turned into text, and that recordings are deleted after 30 days;
   - that AI services are used, including **OpenAI in the United States** (see the [sub-processor list](sub-processors.md));
   - how long data is kept (see the [retention schedule](retention-schedule.md));
   - how parents can ask to see, correct or delete data, withdraw consent, or complain.
   Our public privacy notice is at `/privacy` on the ClassPulse address. You can link to it.
2. **Collect verifiable consent** from a parent or lawful guardian for each student under 18:
   - **Verify the parent is an adult and really the parent or guardian.** Use identity details the school already holds and trusts (admission records), or check an ID, or use a DigiLocker-style token **(verify the accepted methods with counsel; see Rule 10 of the DPDP Rules 2025)**.
   - Consent must be **free, specific, informed and unambiguous**, given by a clear action (a signature, or a checked box in a verified parent portal).
3. **Keep a record** of each consent: student, parent name, relation, how they were verified, date, the version of the notice they saw, and how they gave consent. Keep it for as long as the student uses ClassPulse, plus **TODO: period agreed with counsel**.
4. **Only create ClassPulse accounts for students whose consent is recorded.** (ClassPulse does not yet store a consent flag per student. Keep the record in your school system.)
5. **Handle withdrawals.** If a parent withdraws consent, disable or delete the student in ClassPulse (**Admin → Students**). If the parent asks for a copy first, use **Download data** on that student.
6. **Handle requests** to access, correct or delete data. Admins can edit and delete students, and download a student's data. For anything else, contact BenX Solutions (**TODO: support email**).
7. **Recording in class.** Tell students when a lesson is being recorded. Teachers should avoid reading out personal details (phone numbers, health, family matters) in recorded lessons.

## Students aged 18 or over

They give their own consent; no parent is needed. Use the same notice.

## Sample consent form

> **[School name] — Consent for the use of ClassPulse**
>
> ClassPulse is a learning platform our school uses for lesson recordings and transcripts, quizzes, exams and homework. It is provided by BenX Solutions on the school's behalf.
>
> **What data is used**
> - Your child's name, roll number, class and (optional) email address.
> - Your contact details, if added as a guardian (name, relation, phone, email).
> - Quiz, exam and homework answers, marks and teacher feedback.
> - During secure online exams only: events such as leaving full screen or switching tabs.
> - Classroom audio recordings and transcripts. Your child's voice may be recorded when they speak in class. Recordings are deleted after 30 days; transcripts after one year.
>
> **AI services.** Lesson recordings are turned into text by Sarvam AI (India). Quiz questions and teaching material are drafted by OpenAI (United States) from the lesson text. If a teacher asks for an AI marking suggestion, your child's typed answer or photo of their work is sent to OpenAI, **without their name**. Teachers check every question and decide every mark.
>
> **We will not** sell your child's data, show advertising, or track your child for advertising.
>
> **Your rights.** You can ask the school to see, correct or delete your child's data, withdraw this consent at any time, or complain. Contact: [school contact]. The ClassPulse privacy notice is at [link]/privacy.
>
> ---
>
> Student name: ______________________ Class / section: __________ Roll no.: __________
>
> Parent / guardian name: ______________________ Relation: ☐ Mother ☐ Father ☐ Guardian ☐ Other: ________
>
> Identity checked by the school: ☐ admission records ☐ ID document (type): ________ ☐ other: ________ Checked by (staff): ____________
>
> ☐ I am the parent or lawful guardian of this student and I am 18 or older.
> ☐ I have read the information above and **I consent** to my child using ClassPulse as described.
> ☐ I consent to lessons in which my child takes part being recorded and transcribed as described.
>
> Signature: ______________________ Date: ____________ Phone / email: ______________________
>
> *Office use:* consent recorded on ________ by ________ · notice version: 12 Oct 2026 · withdrawn on: ________

## Open questions for counsel

- Does the Fourth Schedule exemption for educational institutions cover lesson recording, AI processing and exam integrity monitoring? Should schools still collect consent?
- Which verification methods are acceptable for a school (admission records, DigiLocker, ID check)?
- Is a separate consent needed for the OpenAI (US) transfer and for AI grading suggestions?
- Should ClassPulse store a per-student consent record (date, method, notice version)? This needs a schema change: a `consents` table or columns on `users`.
