import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, Todo, type LegalSection } from '@/components/legal/legal-page';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using ClassPulse, for schools, teachers, students and parents.',
};

const link = 'font-bold text-ink underline underline-offset-4';

const sections: LegalSection[] = [
  {
    id: 'about',
    title: 'About these terms',
    body: (
      <>
        <p>
          ClassPulse is provided by <strong>BenX Solutions</strong> to schools under a written agreement with each school. These
          terms explain the rules for everyone who uses ClassPulse through their school: school admins, teachers, students and
          parents. If these terms and the school’s agreement with us differ, the school’s agreement wins.
        </p>
        <p>
          How we handle personal data is explained in our <Link href="/privacy" className={link}>privacy notice</Link>.
        </p>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'Your account',
    body: (
      <ul>
        <li>Your school creates your account. Use only your own account and keep your password private.</li>
        <li>Tell your teacher or school admin straight away if you think someone else has used your account.</li>
        <li>Students under 18 may use ClassPulse only after their school has obtained a parent’s or guardian’s consent.</li>
        <li>The school can change, disable or delete accounts. When an account is deleted, its data is erased.</li>
      </ul>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    body: (
      <>
        <p>Please use ClassPulse only for learning and teaching at your school. Do not:</p>
        <ul>
          <li>try to see or change data you are not allowed to, or get around security or exam rules;</li>
          <li>upload anything unlawful, harmful, hateful, sexually explicit, or that bullies or harasses anyone;</li>
          <li>upload other people’s personal data, or material you do not have the right to share;</li>
          <li>record or share recordings of others outside what your school allows;</li>
          <li>try to overload, attack, copy or reverse-engineer the service;</li>
          <li>try to trick the AI features into marking work unfairly.</li>
        </ul>
        <p>Breaking these rules may lead to your school or us suspending access. Schools apply their own discipline policies.</p>
      </>
    ),
  },
  {
    id: 'exams',
    title: 'Quizzes and secure exams',
    body: (
      <p>
        During a secure exam, ClassPulse records events such as leaving full screen, switching tabs, copy and paste or using a
        second device, and shows them to your teacher. These events are signals, not proof: your teacher decides what they mean.
        Exams are timed and marked on the server.
      </p>
    ),
  },
  {
    id: 'recordings',
    title: 'Classroom recordings',
    body: (
      <p>
        Teachers may record lessons so ClassPulse can make a transcript and quiz. Recordings are deleted automatically after 30
        days. Schools must tell students and parents that lessons may be recorded. Please avoid saying personal details (such as
        phone numbers or health information) during a recorded lesson.
      </p>
    ),
  },
  {
    id: 'ai',
    title: 'AI features',
    body: (
      <ul>
        <li>
          ClassPulse uses AI services to transcribe lessons, draft quiz questions and teaching material, and suggest marks for
          assignments. AI output can be wrong.
        </li>
        <li>Teachers review AI-drafted questions before students see them, and decide every final mark. AI never grades on its own.</li>
        <li>
          Which AI providers we use, and what they receive, is listed in the <Link href="/privacy#sub-processors" className={link}>privacy notice</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: 'content',
    title: 'Your content',
    body: (
      <p>
        Content you create or upload (answers, assignments, lesson plans, materials) stays yours or your school’s. You let us
        store and process it only to provide ClassPulse to your school. Teachers are responsible for having the right to upload
        teaching materials.
      </p>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    body: (
      <p>
        We work to keep ClassPulse available and safe, but it may sometimes be unavailable for maintenance or because of
        problems outside our control. We may improve or change features. We will tell schools in advance about changes that
        affect them significantly.
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Responsibility',
    body: (
      <p>
        The school’s agreement with BenX Solutions sets out each side’s responsibilities and limits of liability. Nothing in
        these terms limits rights you have under Indian law. <Todo>counsel to review liability wording</Todo>
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law and contact',
    body: (
      <>
        <p>
          These terms are governed by the laws of India. Courts at <Todo>city</Todo> have jurisdiction, subject to any mandatory
          consumer-protection rules.
        </p>
        <p>
          Questions: contact your school first, or <Todo>support email address</Todo>. Privacy complaints go to the grievance
          officer named in the <Link href="/privacy#grievance" className={link}>privacy notice</Link>.
        </p>
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of use"
      effective="12 October 2026"
      sections={sections}
      intro={<p>These are the rules for using ClassPulse. They are written to be read by students and parents as well as staff.</p>}
    />
  );
}
