'use client';
import Image from 'next/image';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ROLES, type Role } from '@classpulse/shared';
import { ROLE_CARDS } from '@/components/auth/role-cards';
import { SCREENS } from './assets';
import { useLandingCopy } from './i18n/copy-context';
import type { LandingClientCopy } from './i18n/types';
import { DEMO_QUESTION } from './story/chapters';

/** Landing-only detail for each role (copy: `roles.views` in i18n; English descriptions come from ROLE_CARDS). */
type View = LandingClientCopy['roles']['views'][Role];

export function Roles() {
  const { roles: copy } = useLandingCopy();
  const [active, setActive] = useState<Role>('teacher');
  const base = useId();
  const tabRefs = useRef<Record<Role, HTMLButtonElement | null>>({
    admin: null,
    teacher: null,
    student: null,
  });

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % ROLES.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + ROLES.length) % ROLES.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ROLES.length - 1;
    if (next === null) return;
    e.preventDefault();
    const role = ROLES[next];
    if (!role) return;
    setActive(role);
    tabRefs.current[role]?.focus();
  };

  return (
    <section id="views" aria-labelledby="views-title" className="py-20 sm:py-24 lg:py-28">
      <div className="landing-container">
        <header className="max-w-3xl">
          <h2 id="views-title" className="font-display text-display-l font-extrabold text-balance">
            {copy.title}
          </h2>
          <p className="mt-5 max-w-xl text-lede text-muted">{copy.lede}</p>
        </header>

        <div
          role="tablist"
          aria-label={copy.tablistLabel}
          className="mt-10 grid grid-cols-3 border-2 border-uniform bg-surface sm:max-w-2xl lg:mt-14"
        >
          {ROLES.map((role, i) => {
            const selected = role === active;
            return (
              <button
                key={role}
                ref={(el) => {
                  tabRefs.current[role] = el;
                }}
                id={`${base}-tab-${role}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${base}-panel-${role}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(role)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={clsx(
                  'flex min-h-14 flex-col items-start justify-center px-3 py-2.5 text-left transition-colors duration-200 ease-snap sm:px-5 sm:py-3',
                  'focus-visible:-outline-offset-[6px]',
                  i > 0 && 'border-l-2 border-uniform',
                  selected ? 'bg-uniform text-chalk' : 'text-uniform hover:bg-surface-2',
                )}
              >
                <span className="font-display text-lg leading-tight font-bold sm:text-xl">
                  {copy.views[role].tab}
                </span>
                <span className={clsx('hidden text-xs sm:block', selected ? 'text-chalk-dim' : 'text-muted')}>
                  {copy.views[role].where}
                </span>
              </button>
            );
          })}
        </div>

        {ROLES.map((role) => (
          <div
            key={role}
            role="tabpanel"
            id={`${base}-panel-${role}`}
            aria-labelledby={`${base}-tab-${role}`}
            tabIndex={0}
            hidden={role !== active}
            className="mt-8 focus-visible:outline-offset-8 lg:mt-12"
          >
            <RolePanel role={role} view={copy.views[role]} />
          </div>
        ))}
      </div>
    </section>
  );
}

function RolePanel({ role, view }: { role: Role; view: View }) {
  const Icon = ROLE_CARDS[role].icon;
  const phone = role === 'student';
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-12 lg:items-center lg:gap-12">
      <div className="lg:col-span-4">
        <Icon className="size-7" strokeWidth={1.75} aria-hidden />
        <h3 className="mt-4 font-display text-display-m font-bold text-balance">{view.title}</h3>
        <p className="mt-3 text-lede text-ink">{view.description}</p>
        <ul className="mt-6 space-y-3 border-t border-line-strong pt-6">
          {view.points.map((p) => (
            <li
              key={p}
              className="grid grid-cols-[1.25rem_1fr] gap-2 text-[0.9375rem] leading-relaxed text-muted"
            >
              <span aria-hidden className="mt-2.5 h-0.5 w-3 bg-uniform" />
              {p}
            </li>
          ))}
        </ul>
      </div>

      {/* The stage: a slab of chalkboard green the device frame sits on. */}
      <div
        className={clsx(
          'relative rounded-card bg-board lg:col-span-8',
          phone ? 'flex justify-center px-6 pt-10 pb-0 sm:pt-12' : 'p-3 pb-0 sm:p-8 sm:pb-0 lg:p-10 lg:pb-0',
        )}
      >
        {phone ? <PhoneFrame alt={view.screenAlt} /> : <BrowserFrame role={role} alt={view.screenAlt} />}
      </div>
    </div>
  );
}

// --- Frames ----------------------------------------------------------------

function BrowserFrame({ role, alt }: { role: 'admin' | 'teacher'; alt: string }) {
  const shot = SCREENS[role];
  return (
    <div className="translate-y-px overflow-hidden rounded-t-[6px] border-x-2 border-t-2 border-uniform bg-surface">
      <div className="flex items-center gap-3 border-b-2 border-uniform px-3 py-2">
        <span aria-hidden className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-2.5 rounded-full border-[1.5px] border-uniform" />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate border border-line bg-surface-2 px-3 py-0.5 text-center font-mono text-[11px] text-muted">
          classpulse.benxsolutions.in/{role}
        </span>
      </div>
      {SCREENS.available ? (
        <Image
          src={shot.src}
          width={shot.width}
          height={shot.height}
          alt={alt}
          sizes="(min-width: 1024px) 760px, 100vw"
          className="block h-auto w-full"
        />
      ) : (
        <div role="img" aria-label={alt} className="@container aspect-[16/11] sm:aspect-[16/10]">
          <div aria-hidden lang="en" className="h-full">
            {role === 'admin' ? <AdminScreen /> : <TeacherScreen />}
          </div>
        </div>
      )}
    </div>
  );
}

function PhoneFrame({ alt }: { alt: string }) {
  const shot = SCREENS.student;
  return (
    <div className="w-[17rem] translate-y-px rounded-t-[2.25rem] border-x-[10px] border-t-[10px] border-uniform bg-uniform sm:w-[19rem]">
      <div className="relative overflow-hidden rounded-t-[1.5rem] bg-surface">
        <span
          aria-hidden
          className="absolute top-2 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-uniform"
        />
        {SCREENS.available ? (
          <Image
            src={shot.src}
            width={shot.width}
            height={shot.height}
            alt={alt}
            sizes="304px"
            className="block h-auto w-full"
          />
        ) : (
          <div role="img" aria-label={alt} className="h-[26rem] sm:h-[28rem]">
            <div aria-hidden lang="en" className="h-full">
              <StudentScreen />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Designed stand-ins for the real screenshots ---------------------------

function AppShell({ nav, current, children }: { nav: string[]; current: string; children: ReactNode }) {
  return (
    <div className="flex h-full text-ink">
      <nav className="hidden w-36 shrink-0 flex-col gap-0.5 border-r border-line bg-surface-2 p-3 @lg:flex">
        <span className="mb-3 flex items-center gap-1.5 font-display text-sm font-extrabold">
          <span className="size-2 bg-pulse ring-1 ring-uniform" />
          ClassPulse
        </span>
        {nav.map((n) => (
          <span
            key={n}
            className={clsx(
              'px-2 py-1.5 text-xs',
              n === current ? 'bg-uniform font-semibold text-chalk' : 'text-muted',
            )}
          >
            {n}
          </span>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-hidden p-3 @md:p-5">{children}</div>
    </div>
  );
}

const DEVICES = [
  { room: 'Room 6A', status: 'Online', backlog: '0' },
  { room: 'Room 7B', status: 'Recording', backlog: '0' },
  { room: 'Room 8A', status: 'Online', backlog: '0' },
  { room: 'Room 8B', status: 'Offline', backlog: '3' },
  { room: 'Lab 2', status: 'Online', backlog: '0' },
] as const;

function AdminScreen() {
  return (
    <AppShell
      nav={['Overview', 'Teachers', 'Students', 'Sections', 'Devices', 'Timetable', 'Settings']}
      current="Devices"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold @md:text-lg">Classroom devices</p>
          <p className="text-[11px] text-muted @md:text-xs">
            One recorder per room. Refreshes every 15 seconds.
          </p>
        </div>
        <span className="shrink-0 bg-uniform px-2.5 py-1.5 text-[11px] font-semibold text-chalk">
          Add device
        </span>
      </div>
      <table className="mt-3 w-full text-left text-[11px] @md:mt-4 @md:text-xs">
        <thead>
          <tr className="border-b border-uniform text-muted">
            <th className="py-1.5 font-semibold">Room</th>
            <th className="py-1.5 font-semibold">Status</th>
            <th className="hidden py-1.5 font-semibold @md:table-cell">Microphone</th>
            <th className="py-1.5 text-right font-semibold">Waiting to upload</th>
          </tr>
        </thead>
        <tbody>
          {DEVICES.map((d) => (
            <tr key={d.room} className="border-b border-line">
              <td className="py-2 font-semibold">{d.room}</td>
              <td className="py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={clsx(
                      'size-2 rounded-full',
                      d.status === 'Recording' && 'bg-pulse ring-1 ring-uniform',
                      d.status === 'Online' && 'bg-uniform',
                      d.status === 'Offline' && 'border border-redpen',
                    )}
                  />
                  <span className={clsx(d.status === 'Offline' && 'text-redpen')}>{d.status}</span>
                </span>
              </td>
              <td className="hidden py-2 text-muted @md:table-cell">USB mic</td>
              <td
                className={clsx(
                  'py-2 text-right font-mono tabular-nums',
                  d.backlog !== '0' && 'font-semibold text-redpen',
                )}
              >
                {d.backlog}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 hidden items-center justify-between gap-3 border border-dashed border-uniform/50 px-3 py-2 @xl:flex">
        <span className="text-xs text-muted">Add students from a spreadsheet</span>
        <span className="border border-uniform px-2 py-1 text-[11px] font-semibold">Import CSV</span>
      </div>
    </AppShell>
  );
}

function TeacherScreen() {
  const q = DEMO_QUESTION;
  return (
    <AppShell
      nav={['Today', 'Lessons', 'Record', 'Insights', 'Exams', 'Assignments', 'Studio']}
      current="Lessons"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-bold @md:text-lg">Photosynthesis, Class 8B</p>
          <p className="text-[11px] text-muted @md:text-xs">
            10 questions written from this lecture. 4 to review.
          </p>
        </div>
        <span className="hidden shrink-0 border border-uniform px-2.5 py-1.5 text-[11px] font-semibold @md:inline">
          Approve all
        </span>
      </div>
      <div className="mt-3 border border-uniform bg-surface p-3 @md:mt-4 @md:p-4">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] @md:text-[11px]">
          <span className="bg-pulse px-1.5 py-0.5 font-semibold text-uniform">AI draft</span>
          <span className="border border-line-strong px-1.5 py-0.5">Understand</span>
          <span className="inline-flex items-center gap-1 border border-line-strong px-1.5 py-0.5 font-mono">
            <Play className="size-2.5 fill-current" /> {q.timestamp}
          </span>
        </div>
        <p className="mt-2 text-xs font-semibold @md:text-sm">{q.promptEn}</p>
        <p className="mt-0.5 font-indic text-[11px] text-muted @md:text-xs" lang="ta">
          {q.promptTa}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] @md:text-xs">
          {q.options.map((o, i) => (
            <li
              key={o}
              className={clsx(
                'border px-2 py-1',
                i === q.answer ? 'border-uniform bg-uniform text-chalk' : 'border-line',
              )}
            >
              {o}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-1.5 text-[11px]">
          <span className="bg-uniform px-2.5 py-1 font-semibold text-chalk">Approve</span>
          <span className="border border-uniform px-2.5 py-1 font-semibold">Edit</span>
          <span className="border border-line px-2.5 py-1 text-muted">Reject</span>
        </div>
      </div>
      <ul className="mt-2 border-x border-t border-line text-[11px] @md:text-xs">
        {[
          { q: 'Which gas do leaves take in for photosynthesis?', t: '08:05', s: 'Approved' },
          { q: 'Where in the leaf does photosynthesis mostly happen?', t: '15:20', s: 'To review' },
        ].map((r) => (
          <li key={r.q} className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="font-mono text-muted">{r.t}</span>
            <span className="min-w-0 flex-1 truncate">{r.q}</span>
            <span className={clsx('shrink-0', r.s === 'Approved' ? 'font-semibold' : 'text-muted')}>
              {r.s}
            </span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function StudentScreen() {
  const q = DEMO_QUESTION;
  return (
    <div className="flex h-full flex-col px-4 pt-10 pb-5 text-ink">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold">Photosynthesis quiz</span>
        <span className="font-mono text-muted">3 / 10</span>
      </div>
      <span className="mt-2 block h-1 bg-line">
        <span className="block h-full w-[30%] bg-uniform" />
      </span>
      <p className="mt-5 font-indic text-[0.95rem] leading-snug font-semibold" lang="ta">
        {q.promptTa}
      </p>
      <p className="mt-1 text-xs text-muted">{q.promptEn}</p>
      <ul className="mt-4 space-y-2">
        {q.options.map((o, i) => (
          <li
            key={o}
            className={clsx(
              'flex items-center gap-2.5 border px-3 py-2.5 text-sm',
              i === q.answer ? 'border-uniform bg-uniform font-semibold text-chalk' : 'border-line-strong/40',
            )}
          >
            <span
              className={clsx(
                'grid size-5 place-items-center border font-mono text-[10px]',
                i === q.answer ? 'border-chalk' : 'border-line-strong/50',
              )}
            >
              {String.fromCharCode(65 + i)}
            </span>
            {o}
          </li>
        ))}
      </ul>
      <span className="mt-auto block bg-pulse py-2.5 text-center text-sm font-bold text-uniform ring-1 ring-uniform">
        Check answer
      </span>
    </div>
  );
}
