'use client';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type {
  HostQuestion,
  LeaderboardEntry,
  LiveStateSnapshot,
  LiveStatus,
  ParticipantInfo,
  PublicQuestion,
  QuestionClosedPayload,
} from '@classiq/shared';
import { connectSocket, emitWithAck, type ClassIQSocket } from '@/lib/socket';

/** The host sees the answer key; after a reconnect mid-question the snapshot only carries the public projection. */
export type HostViewQuestion = PublicQuestion & Partial<Pick<HostQuestion, 'correctIndex' | 'explanation'>>;

export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface LiveHostState {
  connection: Connection;
  joinError: string | null;
  snapshot: LiveStateSnapshot | null;
  status: LiveStatus;
  participants: ParticipantInfo[];
  participantCount: number;
  question: HostViewQuestion | null;
  answered: { questionId: string; answeredCount: number; participantCount: number } | null;
  closed: QuestionClosedPayload | null;
  leaderboard: LeaderboardEntry[];
  finalBoard: LeaderboardEntry[] | null;
  /** serverTime − Date.now() at the last snapshot, to correct client clock skew. */
  offsetMs: number;
}

type Action =
  | { type: 'connection'; value: Connection }
  | { type: 'joinError'; message: string }
  | { type: 'snapshot'; snapshot: LiveStateSnapshot }
  | { type: 'participants'; list: ParticipantInfo[] }
  | { type: 'hostOpen'; question: HostQuestion }
  | { type: 'progress'; value: { questionId: string; answeredCount: number; participantCount: number } }
  | { type: 'closed'; payload: QuestionClosedPayload }
  | { type: 'leaderboard'; entries: LeaderboardEntry[] }
  | { type: 'ended'; entries: LeaderboardEntry[] };

const initial: LiveHostState = {
  connection: 'connecting',
  joinError: null,
  snapshot: null,
  status: 'lobby',
  participants: [],
  participantCount: 0,
  question: null,
  answered: null,
  closed: null,
  leaderboard: [],
  finalBoard: null,
  offsetMs: 0,
};

function reducer(state: LiveHostState, action: Action): LiveHostState {
  switch (action.type) {
    case 'connection':
      return { ...state, connection: action.value };
    case 'joinError':
      return { ...state, joinError: action.message, connection: 'error' };
    case 'snapshot': {
      const s = action.snapshot;
      // Keep the richer host question (with the answer key) if the snapshot refers to the same one.
      const question =
        s.status === 'question_open' && s.question
          ? state.question?.questionId === s.question.questionId
            ? { ...state.question, ...s.question }
            : s.question
          : s.status === 'question_closed'
            ? state.question
            : null;
      return {
        ...state,
        joinError: null,
        snapshot: s,
        status: s.status,
        participantCount: s.participantCount,
        question,
        closed: s.status === 'question_closed' ? state.closed : null,
        offsetMs: s.serverTime - Date.now(),
      };
    }
    case 'participants':
      return { ...state, participants: action.list, participantCount: action.list.length };
    case 'hostOpen':
      return { ...state, status: 'question_open', question: action.question, closed: null, answered: null };
    case 'progress':
      return { ...state, answered: action.value, participantCount: action.value.participantCount };
    case 'closed':
      return { ...state, status: 'question_closed', closed: action.payload };
    case 'leaderboard':
      return { ...state, leaderboard: action.entries };
    case 'ended':
      return { ...state, status: 'ended', finalBoard: action.entries, leaderboard: action.entries, question: null };
  }
}

/**
 * Joins a live session as host over Socket.IO and tracks its state. Used by the
 * host console and by the read-only projector view (multiple host sockets are allowed).
 * Re-emits `host:join` on every (re)connect.
 */
export function useLiveHost(sessionId: string | null) {
  const [state, dispatch] = useReducer(reducer, initial);
  const socketRef = useRef<ClassIQSocket | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const socket = connectSocket();
    socketRef.current = socket;

    const join = () => {
      dispatch({ type: 'connection', value: 'connected' });
      emitWithAck<LiveStateSnapshot>(socket, (ack) => socket.emit('host:join', { sessionId }, ack))
        .then((snapshot) => dispatch({ type: 'snapshot', snapshot }))
        .catch((err: Error) => dispatch({ type: 'joinError', message: err.message }));
    };

    socket.on('connect', join);
    socket.on('disconnect', () => dispatch({ type: 'connection', value: 'reconnecting' }));
    socket.on('connect_error', () => dispatch({ type: 'connection', value: 'reconnecting' }));
    socket.on('live:state', (snapshot) => dispatch({ type: 'snapshot', snapshot }));
    socket.on('live:participants', (list) => dispatch({ type: 'participants', list }));
    socket.on('question:host_open', (question) => dispatch({ type: 'hostOpen', question }));
    socket.on('question:progress', (value) => dispatch({ type: 'progress', value }));
    socket.on('question:closed', (payload) => dispatch({ type: 'closed', payload }));
    socket.on('live:leaderboard', (entries) => dispatch({ type: 'leaderboard', entries }));
    socket.on('live:ended', ({ leaderboard }) => dispatch({ type: 'ended', entries: leaderboard }));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId]);

  const command = useCallback((event: 'host:start' | 'host:next' | 'host:close_question' | 'host:end') => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return Promise.reject(new Error('Not connected to the live session. Reconnecting…'));
    return emitWithAck<undefined>(socket, (ack) => socket.emit(event, ack));
  }, []);

  return { state, command };
}

/** Seconds left until `closesAt` (server epoch ms), corrected for clock skew. */
export function secondsLeft(closesAt: number, offsetMs: number, now: number): number {
  return Math.max(0, Math.ceil((closesAt - (now + offsetMs)) / 1000));
}
