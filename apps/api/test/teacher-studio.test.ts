import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../src/db/client.js';
import { lessons, timetableSlots } from '../src/db/schema/index.js';
import { weekdayIn } from '../src/modules/teacher/service.js';
import { as, createInstitution, createSection, createWorld } from './helpers.js';

describe('teacher studio', () => {
  let world: Awaited<ReturnType<typeof createWorld>>;
  beforeEach(async () => {
    world = await createWorld();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists only the sections the teacher teaches', async () => {
    await createSection(world.institution.id, { teacherIds: [world.otherTeacher.id] });
    const res = await as(world.teacher).get('/api/teacher/sections');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ id: world.section.id, studentCount: 2, teachers: [{ id: world.teacher.id }] });

    const other = await as(world.otherTeacher).get('/api/teacher/sections');
    expect(other.body.map((s: { id: string }) => s.id)).not.toContain(world.section.id);
  });

  it('timetable includes my slots and slots of my sections, nothing else', async () => {
    const elsewhere = await createSection(world.institution.id, { teacherIds: [world.otherTeacher.id] });
    const foreign = await createSection((await createInstitution()).id);
    const base = { startTime: '09:00', endTime: '09:45', subject: 'Science' } as const;
    await db.insert(timetableSlots).values([
      { ...base, sectionId: world.section.id, day: 'mon', period: 1, teacherId: world.otherTeacher.id }, // my section
      { ...base, sectionId: elsewhere.id, day: 'tue', period: 1, teacherId: world.teacher.id }, // I teach this slot
      { ...base, sectionId: elsewhere.id, day: 'wed', period: 1, teacherId: world.otherTeacher.id }, // not mine
      { ...base, sectionId: foreign.id, day: 'thu', period: 1 },
    ]);
    const res = await as(world.teacher).get('/api/teacher/timetable');
    expect(res.status).toBe(200);
    expect(res.body.map((s: { day: string }) => s.day)).toEqual(['mon', 'tue']);
  });

  it('dashboard summarises sections, lessons and today’s slots', async () => {
    // Wednesday 2026-10-14 10:00 IST
    vi.useFakeTimers({ now: new Date('2026-10-14T04:30:00Z'), toFake: ['Date'] });
    await db.insert(timetableSlots).values([
      { sectionId: world.section.id, day: 'wed', period: 2, startTime: '10:00', endTime: '10:45', subject: 'Biology', roomId: world.room.id },
      { sectionId: world.section.id, day: 'wed', period: 1, startTime: '09:00', endTime: '09:45', subject: 'Science' },
      { sectionId: world.section.id, day: 'thu', period: 1, startTime: '09:00', endTime: '09:45', subject: 'Science' },
    ]);
    const lesson = { institutionId: world.institution.id, sectionId: world.section.id, subject: 'Science' };
    await db.insert(lessons).values([
      { ...lesson, teacherId: world.teacher.id, title: 'A', status: 'ready_for_review' },
      { ...lesson, teacherId: world.teacher.id, title: 'B', status: 'published' },
      { ...lesson, teacherId: world.otherTeacher.id, title: 'C', status: 'ready_for_review' },
    ]);

    const res = await as(world.teacher).get('/api/teacher/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.sections).toEqual([{ id: world.section.id, name: world.section.name, studentCount: 2 }]);
    expect(res.body.todaySlots).toEqual([
      { sectionName: world.section.name, subject: 'Science', startTime: '09:00', endTime: '09:45', room: null },
      { sectionName: world.section.name, subject: 'Biology', startTime: '10:00', endTime: '10:45', room: world.room.name },
    ]);
    expect(res.body.lessonsByStatus).toEqual({ ready_for_review: 1, published: 1 });
    expect(res.body.recentLessons).toHaveLength(2);
    expect(res.body.needsReview).toBe(1);
  });

  it('computes the weekday in the institution timezone', () => {
    // 2026-10-11 is a Sunday; 20:00 UTC Sunday is already Monday in Kolkata.
    expect(weekdayIn('Asia/Kolkata', new Date('2026-10-11T20:00:00Z'))).toBe('mon');
    expect(weekdayIn('UTC', new Date('2026-10-11T20:00:00Z'))).toBeNull();
  });
});
