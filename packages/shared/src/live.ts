import { z } from 'zod';
import type { NotificationDto } from './notifications.js';
import { Id, type IsoDate } from './common.js';
import type { ErrorCode } from './errors.js';
import type { LessonProgress } from './lessons.js';
import type { RecordingSession } from './devices.js';

/* ============================================================================
 * Live quiz — REST
 *   POST /api/live-sessions                 (teacher) CreateLiveSessionInput -> LiveSessionInfo
 *   GET  /api/live-sessions/:id             (teacher owner) -> LiveSessionInfo
 *   GET  /api/live-sessions/:id/results     (teacher owner) -> LiveSessionResults
 *   GET  /api/live-sessions/pin/:pin        (student) -> LivePinLookup
 * ========================================================================= */

export const LIVE_PIN_PATTERN = /^\d{6}$/;
export const LivePin = z.string().trim().regex(LIVE_PIN_PATTERN, 'PIN must be 6 digits');

export const CreateLiveSessionInput = z.object({
  lessonId: Id,
  timeLimitSec: z.number().int().min(5).max(300).default(20),
});
export type CreateLiveSessionInput = z.infer<typeof CreateLiveSessionInput>;

export const LIVE_STATUSES = ['lobby', 'question_open', 'question_closed', 'ended'] as const;
export type LiveStatus = (typeof LIVE_STATUSES)[number];

export interface LiveSessionInfo {
  id: Id;
  pin: string;
  lessonId: Id;
  title: string;
  status: LiveStatus;
  questionCount: number;
  currentQuestionIndex: number | null;
  timeLimitSec: number;
  participantCount: number;
  createdAt: IsoDate;
  endedAt: IsoDate | null;
}

export interface LivePinLookup {
  sessionId: Id;
  title: string;
  status: LiveStatus;
}

export interface LeaderboardEntry {
  participantId: Id;
  studentId: Id;
  name: string;
  score: number;
  correct: number;
  rank: number;
}

export interface LiveSessionResults {
  session: LiveSessionInfo;
  leaderboard: LeaderboardEntry[];
  questions: { questionId: Id; position: number; stem: string; correctIndex: number; distribution: number[] }[];
}

/* ============================================================================
 * Live quiz — Socket.IO (namespace "/", authenticated via the session cookie)
 *
 * Identity always comes from the authenticated socket — payloads never carry a
 * studentId. The answer key is only ever sent to the host while a question is
 * open; students receive it in `question:closed` after the deadline.
 * ========================================================================= */

export type Ack<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string } };

export interface PublicQuestion {
  questionId: Id;
  index: number;
  total: number;
  stem: string;
  stemLocal: string | null;
  options: string[];
  optionsLocal: string[] | null;
  timeLimitSec: number;
  /** Server epoch ms when the question opened / closes. */
  openedAt: number;
  closesAt: number;
}

export interface HostQuestion extends PublicQuestion {
  correctIndex: number;
  explanation: string | null;
}

export interface LiveStateSnapshot {
  sessionId: Id;
  pin: string;
  title: string;
  status: LiveStatus;
  questionCount: number;
  currentQuestionIndex: number | null;
  participantCount: number;
  /** Present while a question is open (student-safe projection). */
  question: PublicQuestion | null;
  /** Student only: the option this student currently has selected for the open question. */
  myAnswer: number | null;
  /** Student only: running score. */
  myScore: number | null;
  serverTime: number;
}

export interface ParticipantInfo {
  participantId: Id;
  studentId: Id;
  name: string;
  connected: boolean;
  score: number;
}

export interface QuestionClosedPayload {
  questionId: Id;
  index: number;
  correctIndex: number;
  explanation: string | null;
  explanationLocal: string | null;
  distribution: number[];
  answeredCount: number;
}

export interface PlayerResultPayload {
  questionId: Id;
  selectedIndex: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
  totalScore: number;
  rank: number;
}

export const HostJoinPayload = z.object({ sessionId: Id });
export const PlayerJoinPayload = z.object({ pin: LivePin });
export const PlayerAnswerPayload = z.object({
  questionId: Id,
  optionIndex: z.number().int().min(0).max(3),
});
export type HostJoinPayload = z.infer<typeof HostJoinPayload>;
export type PlayerJoinPayload = z.infer<typeof PlayerJoinPayload>;
export type PlayerAnswerPayload = z.infer<typeof PlayerAnswerPayload>;

export interface ClientToServerEvents {
  /** Teacher (owner) joins as host. Multiple host sockets (e.g. projector view) are allowed. */
  'host:join': (payload: HostJoinPayload, ack: (res: Ack<LiveStateSnapshot>) => void) => void;
  'host:start': (ack: (res: Ack) => void) => void;
  /** Opens the next question (or the first after start). */
  'host:next': (ack: (res: Ack) => void) => void;
  /** Close the open question early. */
  'host:close_question': (ack: (res: Ack) => void) => void;
  'host:end': (ack: (res: Ack) => void) => void;
  'player:join': (payload: PlayerJoinPayload, ack: (res: Ack<LiveStateSnapshot>) => void) => void;
  /** May be sent repeatedly until the question closes; the last answer counts. */
  'player:answer': (
    payload: PlayerAnswerPayload,
    ack: (res: Ack<{ questionId: Id; optionIndex: number; revision: number }>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'live:state': (state: LiveStateSnapshot) => void;
  'live:participants': (participants: ParticipantInfo[]) => void; // hosts only
  'question:open': (question: PublicQuestion) => void; // players
  'question:host_open': (question: HostQuestion) => void; // hosts only
  'question:progress': (progress: { questionId: Id; answeredCount: number; participantCount: number }) => void; // hosts only
  'question:closed': (payload: QuestionClosedPayload) => void; // everyone, after deadline
  'player:result': (payload: PlayerResultPayload) => void; // individual player
  'live:leaderboard': (entries: LeaderboardEntry[]) => void; // everyone
  'live:ended': (payload: { leaderboard: LeaderboardEntry[] }) => void;
  /** Teacher-only notifications (joined automatically to their user room on connect). */
  'lesson:progress': (progress: LessonProgress) => void;
  'recording:update': (session: RecordingSession) => void;
  /** A background job this user started finished or failed (see notifications.ts). Sent to their user room. */
  'notification:new': (notification: NotificationDto) => void;
}

/** Scoring: correct answers earn BASE + up to SPEED_BONUS scaled by time remaining. */
export const LIVE_SCORING = { base: 500, speedBonus: 500 } as const;
