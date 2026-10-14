/**
 * Platform usage and AI-cost statistics. Everything is computed at read time with SQL aggregates over the
 * existing tables plus `ai_usage`, `email_log` and `audit_logs` — there are no counters to keep in sync.
 * Days are counted in STATS_TIME_ZONE; empty days/weeks come from generate_series. AI cost is an ESTIMATE
 * from the platform's editable price rates (Settings), never a provider invoice.
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  AI_COST_NOTE,
  STATS_MAX_RANGE_DAYS,
  STATS_TIME_ZONE,
  type AiPrices,
  type AiUsageKind,
  type InstitutionStatus,
  type PlatformOverviewStats,
  type PlatformStats,
  type PlatformStatsCsvQuery,
  type PlatformStatsQuery,
  type StatsActivity,
  type StatsAiRow,
  type StatsAiTotals,
  type StatsBucket,
  type StatsRanking,
  type StatsSchoolRow,
  type StatsTotals,
} from '@classiq/shared';
import { db } from '../../db/client.js';
import {
  aiUsage,
  assignmentSubmissions,
  assignments,
  auditLogs,
  devices,
  emailLog,
  examAttempts,
  exams,
  institutions,
  lessons,
  liveParticipants,
  liveSessions,
  questions,
  quizAttempts,
  sections,
  submissionFiles,
  users,
} from '../../db/schema/index.js';
import { badRequest } from '../../lib/errors.js';
import { getPlatformSettings } from '../../lib/platformState.js';

const TZ = STATS_TIME_ZONE;
const DAY_MS = 86_400_000;
const RANKING_SIZE = 5;

/** Event metrics counted from the content tables (activeUsers is computed separately: distinct users). */
const EVENT_METRICS = [
  'lessonsCreated',
  'lessonsPublished',
  'audioMinutes',
  'quizzesPublished',
  'quizAttempts',
  'liveSessions',
  'livePlayers',
  'examsPublished',
  'examAttempts',
  'assignmentsPublished',
  'submissions',
  'emailsSent',
  'emailsFailed',
] as const satisfies readonly (keyof StatsActivity)[];
type EventMetric = (typeof EVENT_METRICS)[number];

/* ----------------------------------------------------------------------------
 * Range
 * ------------------------------------------------------------------------- */

interface Range {
  from: string;
  to: string;
  granularity: 'day' | 'week';
  institutionId: string | null;
}

/** Today's date (YYYY-MM-DD) in the stats time zone. */
function todayIn(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const shiftDays = (date: string, days: number) => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

export function resolveRange(q: PlatformStatsQuery): Range {
  const to = q.to ?? todayIn(TZ);
  const from = q.from ?? shiftDays(to, -29);
  if (Number.isNaN(dayNumber(from)) || Number.isNaN(dayNumber(to))) throw badRequest('Enter valid dates.');
  if (from > to) throw badRequest('The start date must be on or before the end date.');
  if (dayNumber(to) - dayNumber(from) + 1 > STATS_MAX_RANGE_DAYS) {
    throw badRequest(`Choose a range of at most ${STATS_MAX_RANGE_DAYS} days.`);
  }
  return { from, to, granularity: q.granularity, institutionId: q.institutionId ?? null };
}

/* ----------------------------------------------------------------------------
 * SQL building blocks (all values are bound parameters)
 * ------------------------------------------------------------------------- */

/** `r(lo, hi)`: the range as timestamptz bounds, [from 00:00, to+1 00:00) in TZ. */
const rangeCte = (r: Range) => sql`r as (
  select (${r.from}::date::timestamp at time zone ${TZ}) as lo,
         ((${r.to}::date + 1)::timestamp at time zone ${TZ}) as hi
)`;

const inRange = (col: SQL) => sql`${col} >= r.lo and ${col} < r.hi`;

/** `ev(metric, inst, at, v)`: one row per counted event in the range. */
const eventsCte = () => sql`ev as (
  select 'lessonsCreated'::text as metric, l.institution_id as inst, l.created_at as at, 1::float8 as v
    from ${lessons} l, r where ${inRange(sql`l.created_at`)}
  union all
  select 'audioMinutes', l.institution_id, l.created_at, l.duration_sec / 60.0
    from ${lessons} l, r where l.duration_sec is not null and ${inRange(sql`l.created_at`)}
  union all
  select 'lessonsPublished', l.institution_id, l.published_at, 1
    from ${lessons} l, r where ${inRange(sql`l.published_at`)}
  union all
  select 'quizzesPublished', l.institution_id, l.published_at, 1
    from ${lessons} l, r where ${inRange(sql`l.published_at`)}
      and exists (select 1 from ${questions} q where q.lesson_id = l.id and q.status = 'approved')
  union all
  select 'quizAttempts', l.institution_id, qa.submitted_at, 1
    from ${quizAttempts} qa join ${lessons} l on l.id = qa.lesson_id, r where ${inRange(sql`qa.submitted_at`)}
  union all
  select 'liveSessions', l.institution_id, ls.started_at, 1
    from ${liveSessions} ls join ${lessons} l on l.id = ls.lesson_id, r where ${inRange(sql`ls.started_at`)}
  union all
  select 'livePlayers', l.institution_id, lp.joined_at, 1
    from ${liveParticipants} lp join ${liveSessions} ls on ls.id = lp.session_id join ${lessons} l on l.id = ls.lesson_id, r
    where ${inRange(sql`lp.joined_at`)}
  union all
  select 'examsPublished', e.institution_id, e.published_at, 1
    from ${exams} e, r where ${inRange(sql`e.published_at`)}
  union all
  select 'examAttempts', e.institution_id, ea.started_at, 1
    from ${examAttempts} ea join ${exams} e on e.id = ea.exam_id, r where ${inRange(sql`ea.started_at`)}
  union all
  select 'assignmentsPublished', s.institution_id, a.published_at, 1
    from ${assignments} a join ${sections} s on s.id = a.section_id, r where ${inRange(sql`a.published_at`)}
  union all
  select 'submissions', s.institution_id, sub.submitted_at, 1
    from ${assignmentSubmissions} sub join ${assignments} a on a.id = sub.assignment_id join ${sections} s on s.id = a.section_id, r
    where ${inRange(sql`sub.submitted_at`)}
  union all
  select case when el.status = 'sent' then 'emailsSent' else 'emailsFailed' end, el.institution_id, el.at, 1
    from ${emailLog} el, r where el.status in ('sent', 'failed') and ${inRange(sql`el.at`)}
)`;

/** `au(uid, inst, at)`: school sign-ins (audit log) plus users whose last sign-in falls in the range. */
const activeUsersCte = () => sql`au as (
  select al.actor_id as uid, al.institution_id as inst, al.at
    from ${auditLogs} al, r where al.action = 'auth.login' and al.actor_id is not null and ${inRange(sql`al.at`)}
  union all
  select u.id, u.institution_id, u.last_login_at
    from ${users} u, r where ${inRange(sql`u.last_login_at`)}
)`;

const instFilter = (r: Range, col: SQL) => sql`(${r.institutionId}::uuid is null or ${col} = ${r.institutionId}::uuid)`;

const bucketOf = (r: Range, col: SQL) => sql`date_trunc(${r.granularity}, ${col} at time zone ${TZ})::date`;

/** `coalesce(sum(e.v) filter (where e.metric = 'x'), 0) as "x"`, one per event metric. */
const pivot = () =>
  sql.join(
    EVENT_METRICS.map((m) => sql`coalesce(sum(e.v) filter (where e.metric = ${m}), 0)::float8 as ${sql.identifier(m)}`),
    sql`, `,
  );

/* ----------------------------------------------------------------------------
 * Cost estimate
 * ------------------------------------------------------------------------- */

interface AiAggRow {
  provider: string;
  model: string;
  kind: AiUsageKind;
  calls: number;
  failures: number;
  inputTokens: number;
  outputTokens: number;
  audioSeconds: number;
}

/** Exact model id, else the longest configured prefix ("gpt-4.1-mini-2025-04-14" → "gpt-4.1-mini"). */
function rateFor<T>(table: Record<string, T>, model: string): T | undefined {
  if (table[model]) return table[model];
  const key = Object.keys(table)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : undefined;
}

const isAudioKind = (row: AiAggRow) => row.kind === 'stt' || row.kind === 'voice' || row.audioSeconds > 0;

/** Estimated USD for an aggregate row; `priced` is false when usage exists but no rate is configured. */
export function estimateCost(row: AiAggRow, prices: AiPrices): { costUsd: number; priced: boolean } {
  if (isAudioKind(row)) {
    if (row.audioSeconds <= 0) return { costUsd: 0, priced: true };
    const rate = rateFor(prices.stt, row.model);
    return rate ? { costUsd: (row.audioSeconds / 3600) * rate.perHour, priced: true } : { costUsd: 0, priced: false };
  }
  if (row.inputTokens <= 0 && row.outputTokens <= 0) return { costUsd: 0, priced: true };
  const rate = rateFor(prices.llm, row.model);
  if (!rate) return { costUsd: 0, priced: false };
  return { costUsd: (row.inputTokens / 1e6) * rate.inputPer1M + (row.outputTokens / 1e6) * rate.outputPer1M, priced: true };
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
const money = (n: number) => round(n, 4);
const minutes = (secs: number) => round(secs / 60, 1);
const num = (v: unknown) => Number(v ?? 0) || 0;

const emptyActivity = (): StatsActivity => ({
  activeUsers: 0,
  lessonsCreated: 0,
  lessonsPublished: 0,
  audioMinutes: 0,
  quizzesPublished: 0,
  quizAttempts: 0,
  liveSessions: 0,
  livePlayers: 0,
  examsPublished: 0,
  examAttempts: 0,
  assignmentsPublished: 0,
  submissions: 0,
  emailsSent: 0,
  emailsFailed: 0,
});

const emptyAi = (): StatsAiTotals => ({ aiCalls: 0, aiFailures: 0, aiInputTokens: 0, aiOutputTokens: 0, aiAudioMinutes: 0, aiCostUsd: 0 });

/** Running AI totals (audio kept in seconds until the end to avoid rounding drift). */
class AiAcc {
  calls = 0;
  failures = 0;
  input = 0;
  output = 0;
  secs = 0;
  cost = 0;
  add(row: AiAggRow, cost: number) {
    this.calls += row.calls;
    this.failures += row.failures;
    this.input += row.inputTokens;
    this.output += row.outputTokens;
    this.secs += row.audioSeconds;
    this.cost += cost;
  }
  toTotals(): StatsAiTotals {
    return {
      aiCalls: this.calls,
      aiFailures: this.failures,
      aiInputTokens: this.input,
      aiOutputTokens: this.output,
      aiAudioMinutes: minutes(this.secs),
      aiCostUsd: money(this.cost),
    };
  }
}

function eventValues(row: Record<string, unknown>): Omit<StatsActivity, 'activeUsers'> {
  const out = {} as Record<EventMetric, number>;
  for (const m of EVENT_METRICS) out[m] = m === 'audioMinutes' ? round(num(row[m]), 1) : num(row[m]);
  return out;
}

/* ----------------------------------------------------------------------------
 * Queries
 * ------------------------------------------------------------------------- */

async function totals(r: Range): Promise<StatsTotals> {
  const f = (col: SQL) => instFilter(r, col);
  const res = await db.execute<Record<keyof StatsTotals, number>>(sql`
    select
      (select count(*)::int from ${institutions} i where ${f(sql`i.id`)}) as "schools",
      (select count(*)::int from ${institutions} i where i.status = 'active' and ${f(sql`i.id`)}) as "activeSchools",
      (select count(*)::int from ${institutions} i where i.status = 'suspended' and ${f(sql`i.id`)}) as "suspendedSchools",
      (select count(*)::int from ${users} u where u.role = 'admin' and ${f(sql`u.institution_id`)}) as "admins",
      (select count(*)::int from ${users} u where u.role = 'teacher' and ${f(sql`u.institution_id`)}) as "teachers",
      (select count(*)::int from ${users} u where u.role = 'student' and ${f(sql`u.institution_id`)}) as "students",
      (select count(*)::int from ${sections} s where ${f(sql`s.institution_id`)}) as "sections",
      (select count(*)::int from ${devices} d where d.revoked_at is null and ${f(sql`d.institution_id`)}) as "devices"
  `);
  const row = res.rows[0] ?? ({} as Record<string, unknown>);
  return {
    schools: num(row.schools),
    activeSchools: num(row.activeSchools),
    suspendedSchools: num(row.suspendedSchools),
    admins: num(row.admins),
    teachers: num(row.teachers),
    students: num(row.students),
    sections: num(row.sections),
    devices: num(row.devices),
  };
}

async function seriesRows(r: Range): Promise<Record<string, unknown>[]> {
  const res = await db.execute<Record<string, unknown>>(sql`
    with ${rangeCte(r)}, ${eventsCte()}, ${activeUsersCte()},
    b as (
      select gs::date as bucket
      from generate_series(date_trunc(${r.granularity}, ${r.from}::date::timestamp), ${r.to}::date::timestamp, ${`1 ${r.granularity}`}::interval) gs
    ),
    e as (
      select ${bucketOf(r, sql`ev.at`)} as bucket, ev.metric, sum(ev.v) as v
      from ev where ${instFilter(r, sql`ev.inst`)} group by 1, 2
    ),
    a as (
      select ${bucketOf(r, sql`au.at`)} as bucket, count(distinct au.uid)::int as n
      from au where ${instFilter(r, sql`au.inst`)} group by 1
    )
    select to_char(b.bucket, 'YYYY-MM-DD') as bucket, coalesce(a.n, 0) as "activeUsers", ${pivot()}
    from b left join a on a.bucket = b.bucket left join e on e.bucket = b.bucket
    group by b.bucket, a.n
    order by b.bucket
  `);
  return res.rows;
}

async function schoolRows(r: Range): Promise<Record<string, unknown>[]> {
  const res = await db.execute<Record<string, unknown>>(sql`
    with ${rangeCte(r)}, ${eventsCte()}, ${activeUsersCte()},
    e as (select ev.inst, ev.metric, sum(ev.v) as v from ev group by 1, 2),
    a as (select au.inst, count(distinct au.uid)::int as n from au group by 1),
    files as (
      select l.institution_id as inst, sum(l.audio_size_bytes)::float8 as bytes
        from ${lessons} l where l.audio_object_key is not null group by 1
      union all
      select s.institution_id, sum(sf.size_bytes)::float8
        from ${submissionFiles} sf
        join ${assignmentSubmissions} sub on sub.id = sf.submission_id
        join ${assignments} asg on asg.id = sub.assignment_id
        join ${sections} s on s.id = asg.section_id
        group by 1
    ),
    st as (select inst, sum(bytes)::float8 as bytes from files group by 1),
    uc as (
      select u.institution_id as inst,
             count(*) filter (where u.role = 'teacher')::int as teachers,
             count(*) filter (where u.role = 'student')::int as students
      from ${users} u group by 1
    )
    select i.id as "institutionId", i.name, i.code, i.status,
           coalesce(uc.teachers, 0) as teachers, coalesce(uc.students, 0) as students,
           coalesce(st.bytes, 0) as "storageBytes", coalesce(a.n, 0) as "activeUsers", ${pivot()}
    from ${institutions} i
    left join uc on uc.inst = i.id
    left join st on st.inst = i.id
    left join a on a.inst = i.id
    left join e on e.inst = i.id
    where ${instFilter(r, sql`i.id`)}
    group by i.id, uc.teachers, uc.students, st.bytes, a.n
    order by i.name
  `);
  return res.rows;
}

interface AiRowWithKeys extends AiAggRow {
  bucket: string;
  institutionId: string | null;
}

async function aiRows(r: Range): Promise<AiRowWithKeys[]> {
  const res = await db.execute<Record<string, unknown>>(sql`
    with ${rangeCte(r)}
    select to_char(${bucketOf(r, sql`u.at`)}, 'YYYY-MM-DD') as bucket, u.institution_id as "institutionId",
           u.provider, u.model, u.kind,
           count(*)::int as calls,
           (count(*) filter (where not u.ok))::int as failures,
           coalesce(sum(u.input_tokens), 0)::float8 as "inputTokens",
           coalesce(sum(u.output_tokens), 0)::float8 as "outputTokens",
           coalesce(sum(u.audio_seconds) filter (where u.ok), 0)::float8 as "audioSeconds"
    from ${aiUsage} u, r
    where ${inRange(sql`u.at`)} and ${instFilter(r, sql`u.institution_id`)}
    group by 1, 2, 3, 4, 5
  `);
  return res.rows.map((x) => ({
    bucket: String(x.bucket),
    institutionId: (x.institutionId as string | null) ?? null,
    provider: String(x.provider),
    model: String(x.model),
    kind: x.kind as AiUsageKind,
    calls: num(x.calls),
    failures: num(x.failures),
    inputTokens: num(x.inputTokens),
    outputTokens: num(x.outputTokens),
    audioSeconds: num(x.audioSeconds),
  }));
}

/* ----------------------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------------------- */

const ranking = (rows: StatsSchoolRow[], value: (r: StatsSchoolRow) => number): StatsRanking[] =>
  rows
    .map((r) => ({ institutionId: r.institutionId, name: r.name, value: value(r) }))
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, RANKING_SIZE);

export async function getStats(query: PlatformStatsQuery): Promise<PlatformStats> {
  const r = resolveRange(query);
  const [tot, series, schools, ai, settings] = await Promise.all([totals(r), seriesRows(r), schoolRows(r), aiRows(r), getPlatformSettings()]);
  const prices = settings.aiPrices;

  const byBucket = new Map<string, AiAcc>();
  const bySchool = new Map<string, AiAcc>();
  const byModel = new Map<string, { row: StatsAiRow; secs: number; cost: number }>();
  const all = new AiAcc();
  for (const row of ai) {
    const { costUsd, priced } = estimateCost(row, prices);
    all.add(row, costUsd);
    if (!byBucket.has(row.bucket)) byBucket.set(row.bucket, new AiAcc());
    byBucket.get(row.bucket)!.add(row, costUsd);
    if (row.institutionId) {
      if (!bySchool.has(row.institutionId)) bySchool.set(row.institutionId, new AiAcc());
      bySchool.get(row.institutionId)!.add(row, costUsd);
    }
    const key = `${row.provider}\u0000${row.model}\u0000${row.kind}`;
    const m = byModel.get(key) ?? {
      row: { provider: row.provider, model: row.model, kind: row.kind, calls: 0, failures: 0, inputTokens: 0, outputTokens: 0, audioMinutes: 0, costUsd: 0, priced: true },
      secs: 0,
      cost: 0,
    };
    m.row.calls += row.calls;
    m.row.failures += row.failures;
    m.row.inputTokens += row.inputTokens;
    m.row.outputTokens += row.outputTokens;
    m.row.priced &&= priced;
    m.secs += row.audioSeconds;
    m.cost += costUsd;
    byModel.set(key, m);
  }

  const seriesOut: StatsBucket[] = series.map((row) => ({
    bucket: String(row.bucket),
    activeUsers: num(row.activeUsers),
    ...eventValues(row),
    ...(byBucket.get(String(row.bucket))?.toTotals() ?? emptyAi()),
  }));

  const schoolsOut: StatsSchoolRow[] = schools.map((row) => {
    const events = eventValues(row);
    const id = String(row.institutionId);
    return {
      institutionId: id,
      name: String(row.name),
      code: String(row.code),
      status: row.status as InstitutionStatus,
      teachers: num(row.teachers),
      students: num(row.students),
      storageBytes: num(row.storageBytes),
      activeUsers: num(row.activeUsers),
      ...events,
      ...(bySchool.get(id)?.toTotals() ?? emptyAi()),
      activity: events.lessonsCreated + events.quizAttempts + events.livePlayers + events.examAttempts + events.submissions,
    };
  });

  const summary = { ...emptyActivity(), ...all.toTotals() };
  for (const b of seriesOut) for (const m of EVENT_METRICS) summary[m] += b[m];
  summary.audioMinutes = round(summary.audioMinutes, 1);
  // Every user belongs to exactly one school, so distinct users per school add up.
  summary.activeUsers = schoolsOut.reduce((n, s) => n + s.activeUsers, 0);

  const aiOut = [...byModel.values()]
    .map(({ row, secs, cost }) => ({ ...row, audioMinutes: minutes(secs), costUsd: money(cost) }))
    .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls);

  return {
    range: { from: r.from, to: r.to, granularity: r.granularity, timeZone: TZ, institutionId: r.institutionId },
    totals: tot,
    summary,
    series: seriesOut,
    schools: schoolsOut,
    ai: aiOut,
    rankings: { byActivity: ranking(schoolsOut, (s) => s.activity), byAiCost: ranking(schoolsOut, (s) => s.aiCostUsd) },
    costNote: AI_COST_NOTE,
    currency: 'USD',
  };
}

export async function getOverview(): Promise<PlatformOverviewStats> {
  const [kpiRes, aiRes, settings] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      with t as (
        select (date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ}) as day_lo,
               (date_trunc('week', now() at time zone ${TZ}) at time zone ${TZ}) as week_lo
      )
      select
        (select count(*)::int from ${institutions}) as schools,
        (select count(*)::int from ${institutions} where status = 'active') as "activeSchools",
        (select count(*)::int from ${institutions} where status = 'suspended') as "suspendedSchools",
        (select count(distinct x.uid)::int from (
            select al.actor_id as uid from ${auditLogs} al, t where al.action = 'auth.login' and al.actor_id is not null and al.at >= t.day_lo
            union
            select u.id from ${users} u, t where u.last_login_at >= t.day_lo
         ) x) as "activeUsersToday",
        (select count(*)::int from ${lessons} l, t where l.created_at >= t.week_lo) as "lessonsThisWeek",
        (select count(*)::int from ${aiUsage} u where not u.ok and u.at > now() - interval '24 hours') as "aiFailures24h",
        (select count(*)::int from ${emailLog} el where el.status = 'failed' and el.at > now() - interval '24 hours') as "emailsFailed24h"
    `),
    db.execute<Record<string, unknown>>(sql`
      select u.institution_id as "institutionId", i.name, u.provider, u.model, u.kind,
             count(*)::int as calls,
             (count(*) filter (where not u.ok))::int as failures,
             coalesce(sum(u.input_tokens), 0)::float8 as "inputTokens",
             coalesce(sum(u.output_tokens), 0)::float8 as "outputTokens",
             coalesce(sum(u.audio_seconds) filter (where u.ok), 0)::float8 as "audioSeconds"
      from ${aiUsage} u
      left join ${institutions} i on i.id = u.institution_id
      where u.at >= (date_trunc('month', now() at time zone ${TZ}) at time zone ${TZ})
      group by 1, 2, 3, 4, 5
    `),
    getPlatformSettings(),
  ]);
  const k = kpiRes.rows[0] ?? {};
  let total = 0;
  const perSchool = new Map<string, StatsRanking>();
  for (const x of aiRes.rows) {
    const row: AiAggRow = {
      provider: String(x.provider),
      model: String(x.model),
      kind: x.kind as AiUsageKind,
      calls: num(x.calls),
      failures: num(x.failures),
      inputTokens: num(x.inputTokens),
      outputTokens: num(x.outputTokens),
      audioSeconds: num(x.audioSeconds),
    };
    const { costUsd } = estimateCost(row, settings.aiPrices);
    total += costUsd;
    if (!x.institutionId) continue;
    const id = String(x.institutionId);
    const entry = perSchool.get(id) ?? { institutionId: id, name: String(x.name ?? 'Unknown school'), value: 0 };
    entry.value += costUsd;
    perSchool.set(id, entry);
  }
  return {
    schools: num(k.schools),
    activeSchools: num(k.activeSchools),
    suspendedSchools: num(k.suspendedSchools),
    activeUsersToday: num(k.activeUsersToday),
    lessonsThisWeek: num(k.lessonsThisWeek),
    aiCostThisMonthUsd: money(total),
    aiFailures24h: num(k.aiFailures24h),
    emailsFailed24h: num(k.emailsFailed24h),
    aiCostBySchool: [...perSchool.values()]
      .map((s) => ({ ...s, value: money(s.value) }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10),
    costNote: AI_COST_NOTE,
    currency: 'USD',
    timeZone: TZ,
  };
}

/* ----------------------------------------------------------------------------
 * CSV export
 * ------------------------------------------------------------------------- */

/** CSV cell: quoted when needed, with spreadsheet formula injection neutralised. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const ACTIVITY_COLUMNS: [keyof StatsActivity, string][] = [
  ['activeUsers', 'Active users'],
  ['lessonsCreated', 'Lessons created'],
  ['lessonsPublished', 'Lessons published'],
  ['audioMinutes', 'Audio minutes'],
  ['quizzesPublished', 'Quizzes published'],
  ['quizAttempts', 'Quiz attempts'],
  ['liveSessions', 'Live sessions'],
  ['livePlayers', 'Live players'],
  ['examsPublished', 'Exams published'],
  ['examAttempts', 'Exam attempts'],
  ['assignmentsPublished', 'Assignments published'],
  ['submissions', 'Submissions'],
  ['emailsSent', 'Emails sent'],
  ['emailsFailed', 'Emails failed'],
];

const AI_COLUMNS: [keyof StatsAiTotals, string][] = [
  ['aiCalls', 'AI calls'],
  ['aiFailures', 'AI failures'],
  ['aiInputTokens', 'Input tokens'],
  ['aiOutputTokens', 'Output tokens'],
  ['aiAudioMinutes', 'AI audio minutes'],
  ['aiCostUsd', 'Estimated AI cost (USD)'],
];

export async function statsCsv(query: PlatformStatsCsvQuery): Promise<{ filename: string; csv: string }> {
  const stats = await getStats(query);
  const { from, to } = stats.range;
  let lines: (string | number | null)[][];
  if (query.section === 'schools') {
    lines = [
      ['School', 'Code', 'Status', 'Teachers', 'Students', 'Storage (bytes)', ...ACTIVITY_COLUMNS.map((c) => c[1]), ...AI_COLUMNS.map((c) => c[1])],
      ...stats.schools.map((s) => [
        s.name,
        s.code,
        s.status,
        s.teachers,
        s.students,
        s.storageBytes,
        ...ACTIVITY_COLUMNS.map(([k]) => s[k]),
        ...AI_COLUMNS.map(([k]) => s[k]),
      ]),
    ];
  } else if (query.section === 'ai') {
    lines = [
      ['Provider', 'Model', 'Kind', 'Calls', 'Failures', 'Input tokens', 'Output tokens', 'Audio minutes', 'Estimated cost (USD)', 'Price rate set'],
      ...stats.ai.map((a) => [a.provider, a.model, a.kind, a.calls, a.failures, a.inputTokens, a.outputTokens, a.audioMinutes, a.costUsd, a.priced ? 'yes' : 'no']),
    ];
  } else {
    lines = [
      [stats.range.granularity === 'week' ? 'Week starting' : 'Date', ...ACTIVITY_COLUMNS.map((c) => c[1]), ...AI_COLUMNS.map((c) => c[1])],
      ...stats.series.map((b) => [b.bucket, ...ACTIVITY_COLUMNS.map(([k]) => b[k]), ...AI_COLUMNS.map(([k]) => b[k])]),
    ];
  }
  const csv = lines.map((cols) => cols.map(csvCell).join(',')).join('\r\n') + '\r\n';
  return { filename: `classiq-${query.section}-${from}-to-${to}.csv`, csv };
}
