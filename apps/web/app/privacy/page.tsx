import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo, type LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'How ClassIQ collects, uses, shares, keeps and protects personal data for schools, teachers, students and parents.',
};

const EFFECTIVE = '12 October 2026';

const sections: LegalSection[] = [
  {
    id: 'who-we-are',
    title: 'Who we are and our role',
    body: (
      <>
        <p>
          ClassIQ is a classroom platform operated by <strong>BenX Solutions</strong> (“we”, “us”). Schools use it to record
          lessons, create quizzes, run exams and assignments, and follow their students’ progress.
        </p>
        <p>
          Under India’s Digital Personal Data Protection Act, 2023 (“DPDP Act”), <strong>your school is the Data Fiduciary</strong>: it
          decides why and how your personal data is used. <strong>BenX Solutions is the school’s Data Processor</strong>: we handle the
          data only on the school’s instructions and under a written agreement with the school.
        </p>
        <p>
          Registered address: <Todo>BenX Solutions registered address</Todo>. Contact: <Todo>privacy contact email</Todo>.
        </p>
      </>
    ),
  },
  {
    id: 'what-data',
    title: 'What data we handle',
    body: (
      <>
        <ul>
          <li>
            <strong>Account data:</strong> name, role (admin, teacher or student), school, email address (staff; optional for
            students), roll number (students), department (teachers), class and section membership, account status, last
            sign-in time. Passwords are stored only as one-way hashes.
          </li>
          <li>
            <strong>Parent and guardian contacts</strong> that a student or the school adds: name, relation, phone number, email, and
            whether they want progress updates.
          </li>
          <li>
            <strong>Classroom audio and transcripts:</strong> recordings of lessons (from a classroom device or uploaded by the
            teacher) and the text transcript made from them. Students’ voices may be audible in a recording.
          </li>
          <li>
            <strong>Learning records:</strong> quiz and live-quiz answers and scores, exam answers and scores, assignment
            submissions (typed answers, photos and files), marks, rubric scores and teacher feedback.
          </li>
          <li>
            <strong>Exam integrity events:</strong> during a secure exam only, events such as leaving full screen, switching tabs,
            copy and paste, or opening the exam on a second device.
          </li>
          <li>
            <strong>Teaching content:</strong> lesson plans, worksheets, question papers, presentations and materials that teachers
            create or upload.
          </li>
          <li>
            <strong>Device data:</strong> for classroom recording devices, the device name, room, software version, health
            statistics and network address. For people, the browser type and network (IP) address recorded with sign-ins and
            security events.
          </li>
          <li>
            <strong>Logs:</strong> technical logs of errors and unusual requests, and an audit log of important actions (who did
            what, and when). We do not write passwords, codes, cookies or keys into logs.
          </li>
        </ul>
        <p>We do not ask for and do not want sensitive data such as health, religion, caste or financial information.</p>
      </>
    ),
  },
  {
    id: 'purposes',
    title: 'Why we use it',
    body: (
      <>
        <p>Only to provide ClassIQ to the school, which means:</p>
        <ul>
          <li>signing people in and keeping accounts secure;</li>
          <li>turning lesson audio into transcripts and helping teachers create quizzes, summaries and teaching material;</li>
          <li>running quizzes, live quizzes, exams and assignments, and showing results to the right teachers and students;</li>
          <li>keeping exams fair (integrity events are shown to the teacher, who decides what they mean);</li>
          <li>sending account emails (invitations, password resets) and assignment reminders;</li>
          <li>keeping the service running, fixing problems, preventing misuse and meeting legal duties.</li>
        </ul>
        <p>We do not sell personal data and we do not use it for any purpose the school has not asked for.</p>
      </>
    ),
  },
  {
    id: 'consent',
    title: 'Legal basis and consent',
    body: (
      <>
        <p>
          The school is responsible for having a lawful basis for using personal data in ClassIQ, and for giving people the
          notice the DPDP Act requires.
        </p>
        <p>
          <strong>Students under 18 are children under the DPDP Act.</strong> Before a child uses ClassIQ, the school must
          obtain <strong>verifiable consent from a parent or lawful guardian</strong>, and keep a record of it. The school must also
          tell parents that classes may be recorded and transcribed. A parent can withdraw consent by contacting the school; the
          school will then tell us what to stop or delete.
        </p>
        <p>
          Adults (teachers, staff and students aged 18 or over) are covered by the school’s own notice and, where needed, their
          consent.
        </p>
      </>
    ),
  },
  {
    id: 'children',
    title: 'Our commitments for children’s data',
    body: (
      <ul>
        <li>No tracking for advertising, no targeted advertising, and no advertising of any kind.</li>
        <li>No profiling of children for advertising or marketing.</li>
        <li>
          No behavioural monitoring, except the exam integrity events described above, which are recorded only during a secure
          exam and only for the teacher running it.
        </li>
        <li>No third-party analytics or tracking scripts. We use only the cookies needed to keep you signed in.</li>
        <li>
          Children’s names and account details are not sent to AI providers. (Lesson audio and transcripts contain whatever is
          said in class, so teachers should avoid reading out personal details.)
        </li>
        <li>We do not sell or rent children’s data, or use it to train AI models.</li>
      </ul>
    ),
  },
  {
    id: 'sub-processors',
    title: 'Who else handles data, and where (sub-processors)',
    body: (
      <>
        <p>We use a small number of service providers. Each one receives only what it needs for its task.</p>
        <ul>
          <li>
            <strong>Oracle Cloud Infrastructure</strong> (Oracle) hosts the ClassIQ servers, database, stored files and backups.
            Region: <Todo>confirm the OCI hosting region</Todo>.
          </li>
          <li>
            <strong>Sarvam AI</strong> (India) turns lesson audio and teachers’ short voice requests into text.
          </li>
          <li>
            <strong>OpenAI</strong> (United States) writes quiz questions, summaries and teaching material from the lesson
            transcript and the teacher’s request. When a teacher asks for an <strong>AI grading suggestion</strong>, OpenAI also
            receives that student’s typed answer and attached photos (not the student’s name). If a school chooses OpenAI’s
            speech-to-text, or as a fallback for English lessons, OpenAI also receives lesson audio.{' '}
            <Todo>confirm OpenAI’s current API data-retention terms and record them here</Todo>
          </li>
          <li>
            <strong>GoDaddy</strong> (email) delivers account invitations, password resets and assignment reminders. It receives
            the recipient’s email address and the message. <Todo>confirm the email provider’s data location</Todo>
          </li>
        </ul>
        <p>
          <strong>Transfers outside India.</strong> Using OpenAI means some data (transcripts, teachers’ requests and, for grading
          suggestions or English speech-to-text, a student’s work or lesson audio) is processed in the United States. The DPDP Act
          allows this unless the Government of India restricts transfers to that country. We will tell schools before we add or
          change a sub-processor. The current list is also in the school’s data processing agreement.
        </p>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep data',
    body: (
      <>
        <ul>
          <li>
            <strong>Lesson audio:</strong> deleted automatically after <strong>30 days</strong>.
          </li>
          <li>
            <strong>Transcripts:</strong> deleted automatically after <strong>365 days</strong> by default.
          </li>
          <li>
            <strong>Accounts, quizzes, exams, assignments and grades:</strong> kept while the school uses ClassIQ, until the
            school deletes them, or until the school’s contract ends.
          </li>
          <li>
            <strong>Technical logs:</strong> 14 days. <strong>Audit log:</strong> 365 days.
          </li>
          <li>
            <strong>Backups:</strong> encrypted nightly backups are kept for about 5 weeks, then overwritten. Deleted data
            disappears from backups within that time.
          </li>
        </ul>
        <p>
          When a school leaves ClassIQ, we give the school an export of its data on request and then delete it, including
          stored files.
        </p>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect data',
    body: (
      <ul>
        <li>Encrypted connections (HTTPS) for every page and request.</li>
        <li>Passwords stored as one-way hashes; sign-in attempts are rate-limited; sessions expire.</li>
        <li>Each school’s data is kept separate; people only see what their role allows.</li>
        <li>The operator console needs a password and an authenticator code, and its actions are audited.</li>
        <li>Nightly backups are encrypted, and the key to read them is kept off the server.</li>
        <li>We keep software up to date and review the platform’s security regularly.</li>
      </ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights and how to use them',
    body: (
      <>
        <p>Under the DPDP Act you can ask to:</p>
        <ul>
          <li>
            <strong>access</strong> a summary of your personal data and how it is used (schools can download a copy of a
            student’s data from ClassIQ);
          </li>
          <li>
            <strong>correct, complete or update</strong> it;
          </li>
          <li>
            <strong>erase</strong> it when it is no longer needed or consent is withdrawn;
          </li>
          <li>
            <strong>nominate</strong> someone to act for you if you die or cannot act;
          </li>
          <li>
            <strong>complain</strong> (grievance redressal).
          </li>
        </ul>
        <p>
          <strong>Please contact your school first.</strong> The school is the Data Fiduciary and handles these requests, and we
          help it. Parents make requests on behalf of their children. If you write to us directly, we will pass your request to
          your school.
        </p>
      </>
    ),
  },
  {
    id: 'grievance',
    title: 'Grievance officer',
    body: (
      <>
        <p>If you are not satisfied with how your school or we handled a request, contact our grievance officer:</p>
        <ul>
          <li>
            Name: <Todo>grievance officer name</Todo>
          </li>
          <li>
            Email: <Todo>grievance email address</Todo>
          </li>
          <li>
            Address: <Todo>postal address</Todo>
          </li>
        </ul>
        <p>
          We aim to reply within <Todo>response time, e.g. 7 days</Todo>. If you are still not satisfied, you may complain to the
          Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: 'breach',
    title: 'If something goes wrong (data breaches)',
    body: (
      <p>
        If personal data is exposed, lost or misused, we contain it, tell the affected school without delay, and help the school
        inform the Data Protection Board of India and the people affected, as the DPDP Act and Rules require. The notice will say
        what happened, what data was involved, what we are doing about it and what you can do.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this notice',
    body: (
      <p>
        We will update this notice when our practices or the law change, and show the new effective date at the top. We will
        tell schools in advance of important changes, especially a new sub-processor. Questions? Contact your school or{' '}
        <Todo>privacy contact email</Todo>. See also our <Link href="/terms" className="font-bold text-ink underline underline-offset-4">terms of use</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy notice"
      effective={EFFECTIVE}
      sections={sections}
      intro={
        <p>
          This notice explains, in plain language, what personal data ClassIQ handles for schools, teachers, students and
          parents, why, who else sees it, how long it is kept and what rights you have.
        </p>
      }
    />
  );
}
