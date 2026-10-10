import { pgEnum } from 'drizzle-orm/pg-core';
import { DAYS, LESSON_STATUSES, LIVE_STATUSES, RECORDING_STATUSES } from '@classpulse/shared';

export const userRole = pgEnum('user_role', ['admin', 'teacher', 'student']);
export const recordStatus = pgEnum('record_status', ['active', 'disabled']);
export const dayOfWeek = pgEnum('day_of_week', DAYS);
export const lessonStatus = pgEnum('lesson_status', LESSON_STATUSES);
export const lessonSourceType = pgEnum('lesson_source_type', ['device', 'upload']);
export const questionStatus = pgEnum('question_status', ['draft', 'approved', 'rejected']);
export const difficulty = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const assignmentStatus = pgEnum('assignment_status', ['draft', 'published']);
export const liveStatus = pgEnum('live_status', LIVE_STATUSES);
export const guardianRelation = pgEnum('guardian_relation', ['mother', 'father', 'guardian', 'other']);
export const deviceStatus = pgEnum('device_status', ['online', 'offline', 'recording', 'error']);
export const deviceCommandType = pgEnum('device_command_type', ['start_recording', 'stop_recording']);
export const deviceCommandStatus = pgEnum('device_command_status', ['pending', 'delivered', 'acked', 'failed', 'expired']);
export const recordingStatus = pgEnum('recording_status', RECORDING_STATUSES);
