import type {
  LeaderboardEntry,
  LiveStateSnapshot,
  PlayerResultPayload,
  PublicQuestion,
  QuestionClosedPayload,
} from '@classpulse/shared';

export type LivePhase = 'connecting' | 'lobby' | 'question' | 'closed' | 'ended';

export interface LiveGameState {
  phase: LivePhase;
  title: string;
  questionCount: number;
  participantCount: number;
  /** serverTime - Date.now() at the last snapshot, in ms. */
  offset: number;
  question: PublicQuestion | null;
  /** Option currently selected locally (optimistic). */
  myAnswer: number | null;
  /** Option the server has acknowledged. */
  savedAnswer: number | null;
  closed: QuestionClosedPayload | null;
  result: PlayerResultPayload | null;
  leaderboard: LeaderboardEntry[];
  myScore: number;
  finalLeaderboard: LeaderboardEntry[] | null;
}

export type LiveAction =
  | { type: 'reset'; title: string }
  | { type: 'snapshot'; snap: LiveStateSnapshot; now: number }
  | { type: 'open'; question: PublicQuestion }
  | { type: 'select'; index: number }
  | { type: 'saved'; questionId: string; index: number }
  | { type: 'closed'; payload: QuestionClosedPayload }
  | { type: 'result'; payload: PlayerResultPayload }
  | { type: 'leaderboard'; entries: LeaderboardEntry[] }
  | { type: 'ended'; leaderboard: LeaderboardEntry[] };

export function initialLiveState(title = ''): LiveGameState {
  return {
    phase: 'connecting',
    title,
    questionCount: 0,
    participantCount: 0,
    offset: 0,
    question: null,
    myAnswer: null,
    savedAnswer: null,
    closed: null,
    result: null,
    leaderboard: [],
    myScore: 0,
    finalLeaderboard: null,
  };
}

function freshQuestion(s: LiveGameState, question: PublicQuestion, myAnswer: number | null): LiveGameState {
  return { ...s, phase: 'question', question, myAnswer, savedAnswer: myAnswer, closed: null, result: null };
}

export function liveReducer(s: LiveGameState, a: LiveAction): LiveGameState {
  switch (a.type) {
    case 'reset':
      return initialLiveState(a.title);

    case 'snapshot': {
      const snap = a.snap;
      const base: LiveGameState = {
        ...s,
        title: snap.title,
        questionCount: snap.questionCount,
        participantCount: snap.participantCount,
        offset: snap.serverTime - a.now,
        myScore: snap.myScore ?? s.myScore,
      };
      switch (snap.status) {
        case 'lobby':
          return { ...base, phase: 'lobby', question: null, myAnswer: null, savedAnswer: null, closed: null, result: null };
        case 'question_open': {
          if (!snap.question) return base;
          if (s.question?.questionId === snap.question.questionId && s.phase === 'question') {
            // Same question (e.g. a reconnect or a participant-count update): keep the
            // local selection, but trust the server for what is actually saved.
            return {
              ...base,
              question: snap.question,
              myAnswer: s.myAnswer ?? snap.myAnswer,
              savedAnswer: snap.myAnswer ?? s.savedAnswer,
            };
          }
          return freshQuestion(base, snap.question, snap.myAnswer);
        }
        case 'question_closed':
          // Missed the 'question:closed' event (e.g. reconnecting) -> show the "time's up" screen.
          if (s.phase === 'question' || s.phase === 'connecting' || s.phase === 'lobby') {
            const keep = s.closed && s.closed.index === snap.currentQuestionIndex ? s.closed : null;
            return { ...base, phase: 'closed', closed: keep };
          }
          return base;
        case 'ended':
          return { ...base, phase: 'ended' };
        default:
          return base;
      }
    }

    case 'open':
      if (s.question?.questionId === a.question.questionId && s.phase === 'question') return { ...s, question: a.question };
      return freshQuestion(s, a.question, null);

    case 'select':
      return { ...s, myAnswer: a.index };

    case 'saved':
      if (s.question?.questionId !== a.questionId) return s;
      return { ...s, savedAnswer: a.index };

    case 'closed':
      return { ...s, phase: s.phase === 'ended' ? 'ended' : 'closed', closed: a.payload };

    case 'result':
      return { ...s, result: a.payload, myScore: a.payload.totalScore };

    case 'leaderboard':
      return { ...s, leaderboard: a.entries };

    case 'ended':
      return { ...s, phase: 'ended', finalLeaderboard: a.leaderboard, leaderboard: a.leaderboard.length ? a.leaderboard : s.leaderboard };
  }
}
