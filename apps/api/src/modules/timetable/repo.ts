/** TimetableSlot DTO queries shared by the admin timetable module and the teacher studio. */
import { asc, eq, type SQL } from 'drizzle-orm';
import type { TimetableSlot } from '@classiq/shared';
import type { DbOrTx } from '../../db/client.js';
import { rooms, sections, timetableSlots, users } from '../../db/schema/index.js';

/** `where` may reference timetableSlots, sections (always joined), users (teacher) and rooms. */
export async function findSlots(dbx: DbOrTx, where: SQL | undefined): Promise<TimetableSlot[]> {
  const rows = await dbx
    .select({
      id: timetableSlots.id,
      sectionId: timetableSlots.sectionId,
      sectionName: sections.name,
      day: timetableSlots.day,
      period: timetableSlots.period,
      startTime: timetableSlots.startTime,
      endTime: timetableSlots.endTime,
      subject: timetableSlots.subject,
      teacherId: timetableSlots.teacherId,
      teacherName: users.name,
      roomId: timetableSlots.roomId,
      roomName: rooms.name,
    })
    .from(timetableSlots)
    .innerJoin(sections, eq(sections.id, timetableSlots.sectionId))
    .leftJoin(users, eq(users.id, timetableSlots.teacherId))
    .leftJoin(rooms, eq(rooms.id, timetableSlots.roomId))
    .where(where)
    // day_of_week is a Postgres enum declared mon..sat, so it sorts in week order.
    .orderBy(asc(timetableSlots.day), asc(timetableSlots.period), asc(sections.name));
  return rows.map((r) => ({
    id: r.id,
    sectionId: r.sectionId,
    sectionName: r.sectionName,
    day: r.day,
    period: r.period,
    startTime: r.startTime,
    endTime: r.endTime,
    subject: r.subject,
    teacher: r.teacherId && r.teacherName ? { id: r.teacherId, name: r.teacherName } : null,
    room: r.roomId && r.roomName ? { id: r.roomId, name: r.roomName } : null,
  }));
}
