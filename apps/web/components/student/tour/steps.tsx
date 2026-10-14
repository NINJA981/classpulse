'use client';
import { useState } from 'react';
import { Download } from 'lucide-react';
import type { InstitutionFeatures } from '@classiq/shared';
import { Button } from '@/components/ui';
import { useInstallPrompt } from '@/components/pwa/use-install-prompt';
import type { TourStep } from '@/components/tour';

/** Bump the version to show a reworked tour to everyone again. */
export const studentTourKey = (userId: string) => `cp-tour-student-v1:${userId}`;

/** The feature switches that change which steps are shown. */
export type StudentTourFeatures = Pick<InstitutionFeatures, 'exams' | 'assignments' | 'liveQuiz'>;

/** Nav anchors: the sidebar link on desktop, else the ☰ button (the nav collapses into a menu on phones). */
const nav = (href: string) => [`nav${href.replace(/\//g, '-')}`, 'nav-menu'] as const;

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** "Install app" when the browser offers a one-tap prompt; a status line when already installed. */
function InstallAppAction() {
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (installed) return <p className="text-sm font-semibold text-success">ClassIQ is installed on this device.</p>;
  if (!canPrompt) return null;
  return (
    <div className="flex flex-col gap-2">
      <Button
        icon={<Download className="size-4" aria-hidden />}
        onClick={() => {
          void promptInstall().then((outcome) => setDismissed(outcome !== 'accepted'));
        }}
      >
        Install app
      </Button>
      {dismissed && <p className="text-xs text-muted">No problem. You can install it later from your browser menu.</p>}
    </div>
  );
}

export function studentTourSteps(features: StudentTourFeatures): TourStep[] {
  const offers = [
    'quizzes made from your class lectures',
    features.liveQuiz && 'live quizzes in class',
    features.assignments && 'assignments',
    features.exams && 'exams',
  ].filter((x): x is string => Boolean(x));
  const homeShows = [
    'your average score',
    'the quizzes waiting for you',
    'your recent scores',
    features.assignments && 'upcoming assignments',
    'your classes',
  ].filter((x): x is string => Boolean(x));

  const steps: (TourStep | false)[] = [
    {
      id: 'welcome',
      title: 'Welcome to ClassIQ',
      body: `ClassIQ is where your classes continue after the bell: ${listJoin(offers)}. This quick tour shows you where everything is.`,
    },
    {
      id: 'home',
      target: ['home-stats', ...nav('/student')],
      title: 'Your home page',
      body: `Home shows ${listJoin(homeShows)}. Come back here any time from Home in the menu.`,
    },
    {
      id: 'join',
      target: nav('/student/join'),
      title: 'Join a class',
      body: 'Got a class code from your teacher? Open Join a class and type the 6-character code. Everything your teacher shares with that class then shows up for you.',
    },
    {
      id: 'quizzes',
      target: nav('/student/quizzes'),
      title: 'Quizzes',
      body: 'Your teachers publish a quiz after each lecture. Take it any time, see your score straight away and read the explanation for every answer. You can retake a quiz as often as you like.',
    },
    features.liveQuiz && {
      id: 'live',
      target: nav('/student/live'),
      title: 'Join a live quiz',
      body: 'When your teacher starts a live quiz in class, open Live quiz and enter the 6-digit game PIN shown on their screen. Answer each question before the timer runs out and see where you are on the leaderboard.',
    },
    features.assignments && {
      id: 'assignments',
      target: nav('/student/assignments'),
      title: 'Assignments',
      body: 'Each assignment shows its due date. Type your answer, attach photos or PDFs of your work, or both; anything handed in after the due date is marked late, and some assignments close at the deadline. When your teacher returns it, your marks and feedback appear here.',
    },
    features.exams && {
      id: 'exams',
      target: nav('/student/exams'),
      title: 'Exams',
      body: 'Exams are timed, can only be started between their open and close times, and you get one attempt (your teacher may give you an access code). Answers save as you go, some exams run in fullscreen, and leaving the tab or app is recorded for your teacher. When time runs out, your exam is submitted automatically.',
    },
    {
      id: 'profile',
      target: nav('/student/profile'),
      title: 'Your profile',
      body: 'Change your password and add your email in Profile. You can also see your classes there and replay this tour any time.',
    },
    {
      id: 'install',
      title: 'Install the app',
      body: (
        <>
          <p>Add ClassIQ to your home screen to open it like an app.</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li>
              <strong className="text-ink">Android (Chrome):</strong> tap the ⋮ menu, then “Install app” or “Add to Home
              screen”.
            </li>
            <li>
              <strong className="text-ink">iPhone (Safari):</strong> tap Share, then “Add to Home Screen”.
            </li>
          </ul>
        </>
      ),
      action: <InstallAppAction />,
    },
    {
      id: 'finish',
      title: 'You’re all set!',
      body: 'Replay this tour any time from Profile → Take the tour again. Stuck, or something looks wrong? Ask your teacher or your school admin.',
    },
  ];
  return steps.filter((s): s is TourStep => Boolean(s));
}
