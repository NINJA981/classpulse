import { DAYS, type Day, type TimetableSlot, type TimetableSlotInput } from '@classpulse/shared';

export const DAY_LABELS: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

export const DEFAULT_PERIODS = 8;

/** A slot being edited locally before "Save timetable". */
export interface DraftSlot {
  subject: string;
  startTime: string;
  endTime: string;
  teacher: { id: string; name: string } | null;
  room: { id: string; name: string } | null;
}

export type Draft = Record<string, DraftSlot>;

export const cellKey = (day: Day, period: number) => `${day}:${period}`;

export function parseKey(key: string): { day: Day; period: number } {
  const [day, period] = key.split(':');
  return { day: day as Day, period: Number(period) };
}

export function draftFromSlots(slots: TimetableSlot[]): Draft {
  const draft: Draft = {};
  for (const s of slots) {
    draft[cellKey(s.day, s.period)] = {
      subject: s.subject,
      startTime: s.startTime.slice(0, 5),
      endTime: s.endTime.slice(0, 5),
      teacher: s.teacher,
      room: s.room,
    };
  }
  return draft;
}

/** Ordered keys (Mon→Sat, period 1→n) so request indices map back to cells. */
export function orderedKeys(draft: Draft): string[] {
  return Object.keys(draft).sort((a, b) => {
    const pa = parseKey(a);
    const pb = parseKey(b);
    return DAYS.indexOf(pa.day) - DAYS.indexOf(pb.day) || pa.period - pb.period;
  });
}

export function toInput(draft: Draft): { keys: string[]; slots: TimetableSlotInput[] } {
  const keys = orderedKeys(draft);
  const slots = keys.map((k) => {
    const { day, period } = parseKey(k);
    const s = draft[k]!;
    return {
      day,
      period,
      startTime: s.startTime,
      endTime: s.endTime,
      subject: s.subject.trim(),
      teacherId: s.teacher?.id ?? null,
      roomId: s.room?.id ?? null,
    };
  });
  return { keys, slots };
}

export const sameDraft = (a: Draft, b: Draft) => JSON.stringify(toInput(a).slots) === JSON.stringify(toInput(b).slots);
