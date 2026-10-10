'use client';
import { useQuery } from '@tanstack/react-query';
import type { Room, Section, Teacher } from '@classpulse/shared';
import { ApiError, api } from '@/lib/api';

/** Query keys for the admin console. Every key starts with 'admin'. */
export const adminKeys = {
  all: ['admin'] as const,
  overview: ['admin', 'overview'] as const,
  institution: ['admin', 'institution'] as const,
  rooms: ['admin', 'rooms'] as const,
  sections: ['admin', 'sections'] as const,
  sectionStudents: (id: string) => ['admin', 'sections', id, 'students'] as const,
  teachers: ['admin', 'teachers'] as const,
  students: ['admin', 'students'] as const,
  studentList: (params: { q: string; page: number; sectionId: string; pageSize?: number }) =>
    ['admin', 'students', params] as const,
  timetable: (sectionId: string) => ['admin', 'timetable', sectionId] as const,
  timetableAll: ['admin', 'timetable', 'all'] as const,
  devices: ['admin', 'devices'] as const,
  modelSettings: ['admin', 'settings', 'models'] as const,
};

export function useRooms() {
  return useQuery({ queryKey: adminKeys.rooms, queryFn: ({ signal }) => api.get<Room[]>('/admin/rooms', undefined, signal) });
}

export function useSections() {
  return useQuery({
    queryKey: adminKeys.sections,
    queryFn: ({ signal }) => api.get<Section[]>('/admin/sections', undefined, signal),
  });
}

export function useTeachers() {
  return useQuery({
    queryKey: adminKeys.teachers,
    queryFn: ({ signal }) => api.get<Teacher[]>('/admin/teachers', undefined, signal),
  });
}

/** Field-level validation messages from an API error (empty for other errors). */
export function fieldErrorsOf(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.fieldErrors : {};
}

/**
 * The error to show above a form: validation errors are shown next to their fields,
 * so only show the general message when no field matched.
 */
export function formLevelError(err: unknown, fields: string[]): unknown {
  if (!err) return null;
  const fe = fieldErrorsOf(err);
  return fields.some((f) => fe[f]) ? null : err;
}

/** Empty string → undefined (for optional create fields). */
export const optional = (v: string): string | undefined => (v.trim() === '' ? undefined : v.trim());
