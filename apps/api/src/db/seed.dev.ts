/**
 * Development seed (`npm run db:seed`). Creates a small demo school with known
 * credentials. Refuses to run in production and is a no-op if the DEMO school exists.
 */
import { eq } from 'drizzle-orm';
import { DEFAULT_MODEL_SETTINGS, type Day } from '@classiq/shared';
import { env } from '../config/env.js';
import { generateJoinCode, hashPassword } from '../lib/crypto.js';
import { addDays } from '../lib/time.js';
import { closeDb, db } from './client.js';
import {
  enrollments,
  institutions,
  modelSettings,
  rooms,
  sections,
  sectionTeachers,
  timetableSlots,
  users,
} from './schema/index.js';

const DEMO_CODE = 'DEMO';
const ADMIN = { email: 'admin@demo.school', password: 'Admin@12345', name: 'Demo Admin' };
const TEACHER_PASSWORD = 'Teacher@12345';
const STUDENT_PASSWORD = 'Student@12345';

const STUDENT_NAMES_A = ['Aarav Sharma', 'Diya Patel', 'Ishaan Reddy', 'Meera Iyer', 'Kabir Singh'];
const STUDENT_NAMES_B = ['Ananya Gupta', 'Rohan Das', 'Saanvi Nair'];

const PERIODS = [
  { period: 1, startTime: '09:00', endTime: '09:45' },
  { period: 2, startTime: '09:50', endTime: '10:35' },
  { period: 3, startTime: '10:50', endTime: '11:35' },
];
const WEEKDAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

async function main(): Promise<number> {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed: NODE_ENV is production. Use `npm run create-admin` instead.');
    return 1;
  }

  const existing = await db.query.institutions.findFirst({ where: eq(institutions.code, DEMO_CODE) });
  if (existing) {
    console.log(`The demo school (code ${DEMO_CODE}) already exists — nothing to do.`);
    return 0;
  }

  const [adminHash, teacherHash, studentHash] = await Promise.all([
    hashPassword(ADMIN.password),
    hashPassword(TEACHER_PASSWORD),
    hashPassword(STUDENT_PASSWORD),
  ]);

  await db.transaction(async (tx) => {
    const [inst] = await tx
      .insert(institutions)
      .values({ name: 'Demo Public School', code: DEMO_CODE, timezone: 'Asia/Kolkata', academicYear: '2026-27' })
      .returning();
    const institutionId = inst!.id;

    await tx.insert(modelSettings).values({ institutionId, ...DEFAULT_MODEL_SETTINGS });

    await tx.insert(users).values({
      institutionId,
      role: 'admin',
      name: ADMIN.name,
      email: ADMIN.email,
      passwordHash: adminHash,
    });
    const [anita, rahul] = await tx
      .insert(users)
      .values([
        { institutionId, role: 'teacher' as const, name: 'Anita Verma', email: 'anita@demo.school', department: 'Science', passwordHash: teacherHash },
        { institutionId, role: 'teacher' as const, name: 'Rahul Mehta', email: 'rahul@demo.school', department: 'Mathematics', passwordHash: teacherHash },
      ])
      .returning();

    const [room101, room102] = await tx
      .insert(rooms)
      .values([
        { institutionId, name: 'Room 101', building: 'Main Block', capacity: 40 },
        { institutionId, name: 'Room 102', building: 'Main Block', capacity: 40 },
      ])
      .returning();

    const joinCodeExpiresAt = addDays(new Date(), 30);
    const [secA, secB] = await tx
      .insert(sections)
      .values([
        { institutionId, name: 'Grade 10 - A', grade: '10', subject: 'Science', roomId: room101!.id, joinCode: generateJoinCode(), joinCodeExpiresAt },
        { institutionId, name: 'Grade 10 - B', grade: '10', subject: 'Mathematics', roomId: room102!.id, joinCode: generateJoinCode(), joinCodeExpiresAt },
      ])
      .returning();

    await tx.insert(sectionTeachers).values([
      { sectionId: secA!.id, teacherId: anita!.id },
      { sectionId: secB!.id, teacherId: rahul!.id },
    ]);

    const studentRows = (prefix: string, names: string[]) =>
      names.map((name, i) => ({
        institutionId,
        role: 'student' as const,
        name,
        rollNumber: `${prefix}-${String(i + 1).padStart(2, '0')}`,
        passwordHash: studentHash,
        mustChangePassword: false, // seed convenience only
      }));
    const studentsA = await tx.insert(users).values(studentRows('10A', STUDENT_NAMES_A)).returning({ id: users.id });
    const studentsB = await tx.insert(users).values(studentRows('10B', STUDENT_NAMES_B)).returning({ id: users.id });
    await tx.insert(enrollments).values([
      ...studentsA.map((s) => ({ sectionId: secA!.id, studentId: s.id })),
      ...studentsB.map((s) => ({ sectionId: secB!.id, studentId: s.id })),
    ]);

    // Sample week: Anita teaches Science in 10-A, Rahul teaches Mathematics in 10-B, with a swap on period 3.
    const slots = WEEKDAYS.flatMap((day) =>
      PERIODS.flatMap(({ period, startTime, endTime }) => {
        const swap = period === 3;
        return [
          {
            sectionId: secA!.id,
            day,
            period,
            startTime,
            endTime,
            subject: swap ? 'Mathematics' : 'Science',
            teacherId: swap ? rahul!.id : anita!.id,
            roomId: room101!.id,
          },
          {
            sectionId: secB!.id,
            day,
            period,
            startTime,
            endTime,
            subject: swap ? 'Science' : 'Mathematics',
            teacherId: swap ? anita!.id : rahul!.id,
            roomId: room102!.id,
          },
        ];
      }),
    );
    await tx.insert(timetableSlots).values(slots);
  });

  console.log('\nSeeded "Demo Public School" (school code DEMO). Sign in with:\n');
  console.table([
    { role: 'admin', login: ADMIN.email, password: ADMIN.password },
    { role: 'teacher', login: 'anita@demo.school', password: TEACHER_PASSWORD },
    { role: 'teacher', login: 'rahul@demo.school', password: TEACHER_PASSWORD },
    { role: 'student', login: '10A-01 … 10A-05 (Grade 10 - A)', password: STUDENT_PASSWORD },
    { role: 'student', login: '10B-01 … 10B-03 (Grade 10 - B)', password: STUDENT_PASSWORD },
  ]);
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
} finally {
  await closeDb();
}
process.exit(exitCode);
