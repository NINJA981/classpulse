import { and, asc, count, eq, sql, type SQL } from 'drizzle-orm';
import type { Room, RoomInput } from '@classiq/shared';
import { db } from '../../db/client.js';
import { devices, rooms } from '../../db/schema/index.js';
import { conflict, isUniqueViolation, notFound } from '../../lib/errors.js';

const ROOM_NAME_UNIQUE = 'rooms_institution_name_unique';

/** Active (non-revoked) devices installed in the room. */
const deviceCountSql = sql<number>`(select count(*)::int from ${devices} d where d.room_id = "rooms"."id" and d.revoked_at is null)`;

async function findRooms(where: SQL | undefined): Promise<Room[]> {
  const rows = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      building: rooms.building,
      capacity: rooms.capacity,
      deviceCount: deviceCountSql,
    })
    .from(rooms)
    .where(where)
    .orderBy(asc(rooms.name));
  return rows;
}

async function findRoom(institutionId: string, id: string): Promise<Room> {
  const [room] = await findRooms(and(eq(rooms.institutionId, institutionId), eq(rooms.id, id)));
  if (!room) throw notFound('Room');
  return room;
}

function rethrowRoomConflict(err: unknown): never {
  if (isUniqueViolation(err, ROOM_NAME_UNIQUE)) throw conflict('A room with that name already exists');
  throw err;
}

export const listRooms = (institutionId: string) => findRooms(eq(rooms.institutionId, institutionId));

export async function createRoom(institutionId: string, input: RoomInput): Promise<Room> {
  const [row] = await db
    .insert(rooms)
    .values({ institutionId, name: input.name, building: input.building ?? null, capacity: input.capacity ?? null })
    .returning()
    .catch(rethrowRoomConflict);
  return { id: row!.id, name: row!.name, building: row!.building, capacity: row!.capacity, deviceCount: 0 };
}

export async function updateRoom(institutionId: string, id: string, input: Partial<RoomInput>): Promise<Room> {
  if (Object.keys(input).length > 0) {
    const updated = await db
      .update(rooms)
      .set(input)
      .where(and(eq(rooms.id, id), eq(rooms.institutionId, institutionId)))
      .returning({ id: rooms.id })
      .catch(rethrowRoomConflict);
    if (updated.length === 0) throw notFound('Room');
  }
  return findRoom(institutionId, id);
}

export async function deleteRoom(institutionId: string, id: string): Promise<void> {
  await findRoom(institutionId, id);
  const [attached] = await db.select({ n: count() }).from(devices).where(eq(devices.roomId, id));
  if ((attached?.n ?? 0) > 0) throw conflict('Remove the devices registered to this room before deleting it');
  await db.delete(rooms).where(and(eq(rooms.id, id), eq(rooms.institutionId, institutionId)));
}
