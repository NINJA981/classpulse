import { z } from 'zod';
import { Id, text, type IsoDate } from './common.js';
import { Password } from './auth.js';

/* ----------------------------------------------------------------------------
 * Institution
 * ------------------------------------------------------------------------- */

export const InstitutionInput = z.object({
  name: text(200),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, 'Use 2-20 letters, digits or dashes'),
  timezone: z.string().trim().min(1).max(64).default('Asia/Kolkata'),
  academicYear: z.string().trim().max(20).optional(),
});
export type InstitutionInput = z.infer<typeof InstitutionInput>;

export interface Institution {
  id: Id;
  name: string;
  code: string;
  timezone: string;
  academicYear: string | null;
  createdAt: IsoDate;
}

/* ----------------------------------------------------------------------------
 * Rooms (physical classrooms — each may host one Raspberry Pi device)
 * ------------------------------------------------------------------------- */

export const RoomInput = z.object({
  name: text(80),
  building: z.string().trim().max(80).optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
});
export type RoomInput = z.infer<typeof RoomInput>;

export interface Room {
  id: Id;
  name: string;
  building: string | null;
  capacity: number | null;
  deviceCount: number;
}

/* ----------------------------------------------------------------------------
 * Teachers
 * ------------------------------------------------------------------------- */

export const CreateTeacherInput = z.object({
  name: text(120),
  email: z.email().trim().toLowerCase(),
  department: z.string().trim().max(120).optional(),
  /** If omitted the API generates one and returns it once in `initialPassword`. */
  password: Password.optional(),
});
export type CreateTeacherInput = z.infer<typeof CreateTeacherInput>;

export const UpdateTeacherInput = z.object({
  name: text(120).optional(),
  email: z.email().trim().toLowerCase().optional(),
  department: z.string().trim().max(120).nullable().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});
export type UpdateTeacherInput = z.infer<typeof UpdateTeacherInput>;

export interface Teacher {
  id: Id;
  name: string;
  email: string;
  department: string | null;
  status: 'active' | 'disabled';
  sections: { id: Id; name: string }[];
  createdAt: IsoDate;
}

/* ----------------------------------------------------------------------------
 * Students
 * ------------------------------------------------------------------------- */

export const CreateStudentInput = z.object({
  name: text(120),
  rollNumber: z.string().trim().min(1).max(40),
  email: z.email().trim().toLowerCase().optional(),
  sectionId: Id.optional(),
  password: Password.optional(),
});
export type CreateStudentInput = z.infer<typeof CreateStudentInput>;

export const UpdateStudentInput = z.object({
  name: text(120).optional(),
  email: z.email().trim().toLowerCase().nullable().optional(),
  status: z.enum(['active', 'disabled']).optional(),
});
export type UpdateStudentInput = z.infer<typeof UpdateStudentInput>;

export const ImportStudentsInput = z.object({
  sectionId: Id.optional(),
  rows: z
    .array(
      z.object({
        name: text(120),
        rollNumber: z.string().trim().min(1).max(40),
        email: z.email().trim().toLowerCase().optional(),
      }),
    )
    .min(1)
    .max(2000),
});
export type ImportStudentsInput = z.infer<typeof ImportStudentsInput>;

export interface Student {
  id: Id;
  name: string;
  rollNumber: string;
  email: string | null;
  status: 'active' | 'disabled';
  sections: { id: Id; name: string }[];
  createdAt: IsoDate;
}

/** Returned once when the API generated a password for a newly created user. */
export interface CreatedWithPassword<T> {
  record: T;
  initialPassword: string | null;
}

export interface ImportStudentsResult {
  created: { id: Id; name: string; rollNumber: string; initialPassword: string }[];
  skipped: { rollNumber: string; reason: string }[];
}

export interface PasswordResetResult {
  initialPassword: string;
}

/* ----------------------------------------------------------------------------
 * Sections (class cohorts)
 * ------------------------------------------------------------------------- */

export const JOIN_CODE_PATTERN = /^[A-Z0-9]{6}$/;
export const JoinCode = z.string().trim().toUpperCase().regex(JOIN_CODE_PATTERN, 'Join codes are 6 characters');

export const SectionInput = z.object({
  name: text(120),
  grade: z.string().trim().max(20).optional(),
  subject: z.string().trim().max(120).optional(),
  roomId: Id.nullable().optional(),
  teacherIds: z.array(Id).max(20).optional(),
});
export type SectionInput = z.infer<typeof SectionInput>;

export const UpdateSectionInput = SectionInput.partial();
export type UpdateSectionInput = z.infer<typeof UpdateSectionInput>;

export const SetSectionStudentsInput = z.object({ studentIds: z.array(Id).max(2000) });
export type SetSectionStudentsInput = z.infer<typeof SetSectionStudentsInput>;

export interface Section {
  id: Id;
  name: string;
  grade: string | null;
  subject: string | null;
  room: { id: Id; name: string } | null;
  joinCode: string;
  joinCodeExpiresAt: IsoDate;
  teachers: { id: Id; name: string }[];
  studentCount: number;
  createdAt: IsoDate;
}

/* ----------------------------------------------------------------------------
 * Timetable
 * ------------------------------------------------------------------------- */

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export const Day = z.enum(DAYS);
export type Day = z.infer<typeof Day>;

const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export const TimetableSlotInput = z
  .object({
    day: Day,
    period: z.number().int().min(1).max(12),
    startTime: HHMM,
    endTime: HHMM,
    subject: text(120),
    teacherId: Id.nullable().optional(),
    roomId: Id.nullable().optional(),
  })
  .refine((s) => s.startTime < s.endTime, { message: 'startTime must be before endTime', path: ['endTime'] });
export type TimetableSlotInput = z.infer<typeof TimetableSlotInput>;

export const ReplaceTimetableInput = z.object({ slots: z.array(TimetableSlotInput).max(100) });
export type ReplaceTimetableInput = z.infer<typeof ReplaceTimetableInput>;

export interface TimetableSlot {
  id: Id;
  sectionId: Id;
  sectionName: string;
  day: Day;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: { id: Id; name: string } | null;
  room: { id: Id; name: string } | null;
}
