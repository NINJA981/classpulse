import type { Id, IsoDate } from './common.js';

export type MasteryBand = 'critical' | 'moderate' | 'mastered';

/** <50% critical, 50–74% moderate, >=75% mastered. */
export function masteryBand(accuracyPct: number): MasteryBand {
  if (accuracyPct < 50) return 'critical';
  if (accuracyPct < 75) return 'moderate';
  return 'mastered';
}

export interface QuestionAnalytics {
  questionId: Id;
  position: number;
  stem: string;
  topicTag: string | null;
  attempts: number;
  correct: number;
  accuracyPct: number;
  band: MasteryBand;
  /** Count of students choosing each option index. */
  optionDistribution: number[];
}

export interface LessonAnalytics {
  lessonId: Id;
  enrolledStudents: number;
  studentsAttempted: number;
  averageScorePct: number | null;
  questions: QuestionAnalytics[];
  students: { studentId: Id; name: string; rollNumber: string; scorePct: number; submittedAt: IsoDate }[];
  remedial: RemedialPlan | null;
}

export interface RemedialPlan {
  generatedAt: IsoDate;
  summary: string;
  actions: { topic: string; recommendation: string }[];
}

export interface AttemptSummary {
  id: Id;
  studentId: Id;
  studentName: string;
  rollNumber: string;
  correct: number;
  total: number;
  scorePct: number;
  submittedAt: IsoDate;
}

export interface AdminOverview {
  institution: { id: Id; name: string; code: string } | null;
  counts: {
    teachers: number;
    students: number;
    sections: number;
    rooms: number;
    lessons: number;
    publishedLessons: number;
    devicesOnline: number;
    devicesTotal: number;
  };
  lessonsByStatus: Record<string, number>;
  recentLessons: { id: Id; title: string; status: string; teacherName: string; createdAt: IsoDate }[];
  averageQuizScorePct: number | null;
}

export interface TeacherDashboard {
  sections: { id: Id; name: string; studentCount: number }[];
  todaySlots: { sectionName: string; subject: string; startTime: string; endTime: string; room: string | null }[];
  lessonsByStatus: Record<string, number>;
  recentLessons: { id: Id; title: string; status: string; createdAt: IsoDate }[];
  needsReview: number;
}
