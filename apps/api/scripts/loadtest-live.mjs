#!/usr/bin/env node
/**
 * Live-quiz load test: N students play one live session against a running stack.
 *
 *   node apps/api/scripts/loadtest-live.mjs --base https://app.school.org \
 *     --admin admin@school.org:Pass --teacher teacher@school.org:Pass \
 *     --lesson <publishedLessonId> --students 100
 *
 * Creates N load-test students (imported into the lesson's section), logs each in,
 * joins them to a new live session and answers every question with random think
 * time. Reports join failures, answer-ack latency (p50/p95/max) and dropped answers.
 * Load-test accounts are named "Load Test NNN" (roll LT-<run>-NNN) — disable or
 * delete them from the admin console afterwards.
 */
import { parseArgs } from 'node:util';
import { io } from 'socket.io-client';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:5000' },
    admin: { type: 'string' },
    teacher: { type: 'string' },
    lesson: { type: 'string' },
    students: { type: 'string', default: '100' },
    'time-limit': { type: 'string', default: '20' },
  },
});
if (!args.admin || !args.teacher || !args.lesson) {
  console.error('Required: --admin email:password --teacher email:password --lesson <id>');
  process.exit(2);
}
const BASE = args.base.replace(/\/+$/, '');
const N = Number(args.students);
const RUN = Date.now().toString(36).slice(-5).toUpperCase();
const NEW_PASSWORD = `Load-${RUN}-pass!`;

async function call(method, path, { cookie, body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data?.error?.message ?? ''}`);
  const setCookie = res.headers.get('set-cookie');
  return { data, cookie: setCookie ? setCookie.split(';')[0] : cookie };
}

const staffLogin = async (cred) => {
  const [email, password] = cred.split(/:(.*)/s);
  return (await call('POST', '/auth/login', { body: { email, password } })).cookie;
};

const pct = (xs, p) => (xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))] : NaN);

async function main() {
  const adminCookie = await staffLogin(args.admin);
  const teacherCookie = await staffLogin(args.teacher);
  const { data: lesson } = await call('GET', `/lessons/${args.lesson}`, { cookie: teacherCookie });
  if (lesson.status !== 'published') throw new Error('The lesson must be published');
  console.log(`Lesson "${lesson.title}" in ${lesson.section.name}; creating ${N} students…`);

  const rows = Array.from({ length: N }, (_, i) => ({
    name: `Load Test ${String(i + 1).padStart(3, '0')}`,
    rollNumber: `LT-${RUN}-${String(i + 1).padStart(3, '0')}`,
  }));
  const { data: imported } = await call('POST', '/admin/students/import', {
    cookie: adminCookie,
    body: { sectionId: lesson.section.id, rows },
  });

  console.log('Logging students in…');
  const students = [];
  for (const s of imported.created) {
    let { cookie } = await call('POST', '/auth/student/login', { body: { rollNumber: s.rollNumber, password: s.initialPassword } });
    ({ cookie } = await call('POST', '/auth/change-password', {
      cookie,
      body: { currentPassword: s.initialPassword, newPassword: NEW_PASSWORD },
    }));
    students.push({ ...s, cookie });
  }

  const { data: session } = await call('POST', '/live-sessions', {
    cookie: teacherCookie,
    body: { lessonId: args.lesson, timeLimitSec: Number(args['time-limit']) },
  });
  console.log(`Live session PIN ${session.pin} (${session.questionCount} questions)`);

  const connect = (cookie) =>
    io(BASE, { path: '/socket.io', transports: ['websocket'], extraHeaders: { cookie }, reconnection: true });
  const ack = (socket, event, ...payload) =>
    new Promise((resolve) => socket.timeout(15_000).emit(event, ...payload, (err, res) => resolve(err ? { ok: false, error: { message: 'timeout' } } : res)));

  const host = connect(teacherCookie);
  const hostJoin = await ack(host, 'host:join', { sessionId: session.id });
  if (!hostJoin.ok) throw new Error(`host:join failed: ${hostJoin.error.message}`);

  const latencies = [];
  let joinFailures = 0;
  let dropped = 0;
  let answered = 0;
  const sockets = await Promise.all(
    students.map(async (s) => {
      const socket = connect(s.cookie);
      const res = await ack(socket, 'player:join', { pin: session.pin });
      if (!res.ok) joinFailures++;
      socket.on('question:open', (q) => {
        setTimeout(async () => {
          const started = performance.now();
          const r = await ack(socket, 'player:answer', { questionId: q.questionId, optionIndex: Math.floor(Math.random() * 4) });
          latencies.push(performance.now() - started);
          if (r.ok) answered++;
          else dropped++;
        }, Math.random() * Math.min(5_000, q.closesAt - Date.now() - 1_500));
      });
      return socket;
    }),
  );
  console.log(`${sockets.length - joinFailures}/${sockets.length} students joined; starting…`);

  const waitForAll = (expected, timeoutMs) =>
    new Promise((resolve) => {
      const t = setTimeout(resolve, timeoutMs);
      const onProgress = (p) => {
        if (p.answeredCount >= expected) {
          clearTimeout(t);
          host.off('question:progress', onProgress);
          resolve();
        }
      };
      host.on('question:progress', onProgress);
    });

  const expected = sockets.length - joinFailures;
  for (let q = 0; q < session.questionCount; q++) {
    const all = waitForAll(expected, Number(args['time-limit']) * 1000 + 2_000);
    const r = await ack(host, q === 0 ? 'host:start' : 'host:next');
    if (!r.ok) throw new Error(`advance failed: ${r.error.message}`);
    await all;
    await ack(host, 'host:close_question');
    await new Promise((res) => setTimeout(res, 1_500));
  }
  await ack(host, 'host:end');

  const { data: results } = await call('GET', `/live-sessions/${session.id}/results`, { cookie: teacherCookie });
  for (const s of [...sockets, host]) s.close();

  const report = {
    students: N,
    joinFailures,
    answersAcked: answered,
    answersDropped: dropped,
    ackLatencyMs: { p50: Math.round(pct(latencies, 50)), p95: Math.round(pct(latencies, 95)), max: Math.round(Math.max(...latencies)) },
    leaderboardEntries: results.leaderboard.length,
    pass: joinFailures === 0 && dropped === 0 && pct(latencies, 95) < 300,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
