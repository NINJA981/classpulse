import { GraduationCap, School, UserRound, type LucideIcon } from 'lucide-react';
import type { Role } from '@classiq/shared';

/**
 * One line per role describing what that person does in ClassIQ.
 * Shared by the sign-in chooser (/login) and the landing page's "three views" section so the copy can't drift.
 */
export const ROLE_CARDS: Record<Role, { icon: LucideIcon; description: string }> = {
  admin: { icon: School, description: 'Manage teachers, students, classes and devices.' },
  teacher: { icon: GraduationCap, description: 'Record lessons, review quizzes, exams and assignments.' },
  student: { icon: UserRound, description: 'Take quizzes, exams and hand in assignments.' },
};
