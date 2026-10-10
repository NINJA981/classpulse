import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { Id, type ReplaceTimetableInput, type TimetableSlot } from '@classpulse/shared';
import { db, type DbOrTx } from '../../db/client.js';
import { rooms, sections, timetableSlots, users } from '../../db/schema/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { findSlots } from './repo.js';

export const TimetableQuery = z.object({ sectionId: Id.optional() });
export type TimetableQuery = z.infer<typeof TimetableQuery>;

export function listTimetable(institutionId: string, query: TimetableQuery): Promise<TimetableSlot[]> {
  return findSlots(
    db,
    and(
      eq(sections.institutionId, institutionId),
      query.sectionId ? eq(timetableSlots.sectionId, query.sectionId) : undefined,
    ),
  );
}

async function countTeachers(dbx: DbOrTx, institutionId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await dbx
    .select({ n: count() })
    .from(users)
    .where(and(inArray(users.id, ids), eq(users.institutionId, institutionId), eq(users.role, 'teacher')));
  return row?.n ?? 0;
}

async function countRooms(dbx: DbOrTx, institutionId: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const [row] = await dbx
    .select({ n: count() })
    .from(rooms)
    .where(and(inArray(rooms.id, ids), eq(rooms.institutionId, institutionId)));
  return row?.n ?? 0;
}

export async function replaceTimetable(
  institutionId: string,
  sectionId: string,
  input: ReplaceTimetableInput,
): Promise<TimetableSlot[]> {
  const seen = new Set<string>();
  input.slots.forEach((slot, i) => {
    const key = `${slot.day}:${slot.period}`;
    if (seen.has(key)) {
      throw badRequest(`Two slots use ${slot.day} period ${slot.period}`, [
        { path: `slots.${i}.period`, message: 'Duplicate day and period' },
      ]);
    }
    seen.add(key);
  });
  const teacherIds = [...new Set(input.slots.flatMap((s) => (s.teacherId ? [s.teacherId] : [])))];
  const roomIds = [...new Set(input.slots.flatMap((s) => (s.roomId ? [s.roomId] : [])))];

  await db.transaction(async (tx) => {
    const [section] = await tx
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.institutionId, institutionId)));
    if (!section) throw notFound('Section');
    if ((await countTeachers(tx, institutionId, teacherIds)) !== teacherIds.length) {
      throw badRequest('Unknown teacher', [{ path: 'slots', message: 'One or more teachers were not found' }]);
    }
    if ((await countRooms(tx, institutionId, roomIds)) !== roomIds.length) {
      throw badRequest('Unknown room', [{ path: 'slots', message: 'One or more rooms were not found' }]);
    }
    await tx.delete(timetableSlots).where(eq(timetableSlots.sectionId, sectionId));
    if (input.slots.length > 0) {
      await tx.insert(timetableSlots).values(
        input.slots.map((s) => ({
          sectionId,
          day: s.day,
          period: s.period,
          startTime: s.startTime,
          endTime: s.endTime,
          subject: s.subject,
          teacherId: s.teacherId ?? null,
          roomId: s.roomId ?? null,
        })),
      );
    }
  });
  return findSlots(db, eq(timetableSlots.sectionId, sectionId));
}
