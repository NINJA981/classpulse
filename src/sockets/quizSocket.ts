import { Server, Socket } from 'socket.io';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { QuizSession } from '../models/QuizSession.js';
import { quizSubmissions, StoredSubmission } from '../routes/studentQuizRoutes.js';

export interface LiveRoomQuestion {
  id: string;
  type: string;
  stem: string;
  stemLocal?: string;
  options: string[];
  optionsLocal?: string[];
  correctIndex: number;
  explanation: string;
  explanationLocal?: string;
  timeLimitSec: number;
}

export interface LiveParticipant {
  studentId: string;
  studentName: string;
  score: number;
  streak: number;
  answers: Array<{
    questionIndex: number;
    selectedOption: number;
    isCorrect: boolean;
    points: number;
    timeSpentSec: number;
  }>;
}

export interface LiveQuizRoom {
  pin: string;
  lessonId: string;
  title: string;
  subject: string;
  status: 'lobby' | 'in_progress' | 'ended';
  questions: LiveRoomQuestion[];
  activeQuestionIndex: number;
  questionStartedAt: number;
  participants: Map<string, LiveParticipant>;
  hostSocketId?: string;
}

export const liveRooms = new Map<string, LiveQuizRoom>();

/**
 * Creates a live quiz room for a published lesson.
 */
export async function createLiveSession(lessonId: string): Promise<LiveQuizRoom> {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) {
    throw new Error('Lesson not found');
  }

  const rawQuestions = await Question.find({ lessonId, status: 'approved' })
    .sort({ createdAt: 1 })
    .lean();

  if (rawQuestions.length === 0) {
    throw new Error('Lesson has no approved questions to launch live quiz.');
  }

  // Generate unique 6-digit PIN
  let pin = '';
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (liveRooms.has(pin));

  const questions: LiveRoomQuestion[] = rawQuestions.map((q) => ({
    id: String(q._id),
    type: q.type,
    stem: q.stem,
    stemLocal: q.stemLocal,
    options: q.options || [],
    optionsLocal: q.optionsLocal,
    correctIndex: q.correctIndex ?? 0,
    explanation: q.explanation || '',
    explanationLocal: q.explanationLocal,
    timeLimitSec: 20
  }));

  const room: LiveQuizRoom = {
    pin,
    lessonId: String(lesson._id),
    title: lesson.title,
    subject: lesson.subject,
    status: 'lobby',
    questions,
    activeQuestionIndex: 0,
    questionStartedAt: 0,
    participants: new Map()
  };

  liveRooms.set(pin, room);

  // Also persist in Mongo QuizSession
  try {
    await QuizSession.create({
      title: lesson.title,
      lessonId: lesson._id,
      questionIds: rawQuestions.map((q) => q._id),
      activeQuestionIndex: 0,
      status: 'lobby',
      joinPin: pin,
      participants: []
    });
  } catch (err) {
    console.warn('[LiveQuiz] Failed to persist Mongo QuizSession doc, in-memory active:', err);
  }

  return room;
}

export function setupQuizSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Connected: ${socket.id}`);

    // --- Host Joins Room ---
    socket.on('quiz:host_join', ({ pin }: { pin: string }) => {
      const room = liveRooms.get(pin);
      if (!room) {
        socket.emit('quiz:error', { message: 'Quiz session not found' });
        return;
      }
      room.hostSocketId = socket.id;
      socket.join(pin);
      socket.emit('quiz:host_joined_ack', {
        pin,
        title: room.title,
        status: room.status,
        questionCount: room.questions.length,
        participants: Array.from(room.participants.values())
      });
      console.log(`[Socket] Host joined room ${pin}`);
    });

    // --- Student Joins Room ---
    socket.on('quiz:join', ({ pin, studentName, studentId }: { pin: string; studentName: string; studentId?: string }) => {
      const room = liveRooms.get(pin);
      if (!room) {
        socket.emit('quiz:error', { message: 'Invalid PIN. Room does not exist.' });
        return;
      }

      const sId = studentId || socket.id;
      (socket as any).data = { ...(socket as any).data, studentId: sId };
      const sName = studentName?.trim() || `Player ${room.participants.size + 1}`;

      const participant: LiveParticipant = {
        studentId: sId,
        studentName: sName,
        score: 0,
        streak: 0,
        answers: []
      };

      room.participants.set(sId, participant);
      socket.join(pin);

      socket.emit('quiz:joined_success', {
        pin,
        title: room.title,
        subject: room.subject,
        studentId: sId,
        studentName: sName,
        status: room.status,
        questionCount: room.questions.length,
        activeQuestionIndex: room.activeQuestionIndex
      });

      const participantList = Array.from(room.participants.values()).map((p) => ({
        studentId: p.studentId,
        studentName: p.studentName,
        score: p.score
      }));

      io.to(pin).emit('quiz:player_joined', {
        studentId: sId,
        studentName: sName,
        participantsCount: room.participants.size,
        participants: participantList
      });

      console.log(`[Socket] Student ${sName} (${sId}) joined PIN ${pin}`);
    });

    // --- Host Starts Quiz ---
    socket.on('quiz:start', ({ pin }: { pin: string }) => {
      const room = liveRooms.get(pin);
      if (!room) return;

      room.status = 'in_progress';
      room.activeQuestionIndex = 0;
      room.questionStartedAt = Date.now();

      const q = room.questions[0];
      if (!q) return;

      // Broadcast question to students without correct answer
      io.to(pin).emit('quiz:question_started', {
        questionIndex: 0,
        totalQuestions: room.questions.length,
        stem: q.stem,
        stemLocal: q.stemLocal,
        options: q.options,
        optionsLocal: q.optionsLocal,
        timeLimitSec: q.timeLimitSec,
        startedAt: room.questionStartedAt
      });

      // Host receives with correctIndex for teaching HUD
      socket.emit('quiz:host_question_active', {
        questionIndex: 0,
        totalQuestions: room.questions.length,
        stem: q.stem,
        stemLocal: q.stemLocal,
        options: q.options,
        optionsLocal: q.optionsLocal,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        timeLimitSec: q.timeLimitSec,
        answersCount: 0,
        totalParticipants: room.participants.size
      });

      console.log(`[Socket] Live Quiz ${pin} started Question 1/${room.questions.length}`);
    });

    // --- Student Submits Answer ---
    socket.on('quiz:submit_answer', ({
      pin,
      studentId,
      questionIndex,
      selectedOption,
      timeRemainingSec
    }: {
      pin: string;
      studentId: string;
      questionIndex: number;
      selectedOption: number;
      timeRemainingSec?: number;
    }) => {
      const room = liveRooms.get(pin);
      if (!room || room.status !== 'in_progress') return;

      const q = room.questions[questionIndex];
      const participant = room.participants.get(studentId) || room.participants.get((socket as any).data?.studentId);
      if (!q || !participant) return;

      // Prevent duplicate answers for the same question
      if (participant.answers.some((a) => a.questionIndex === questionIndex)) {
        return;
      }

      const isCorrect = selectedOption === q.correctIndex;
      const timeLeft = Math.max(0, Math.min(20, timeRemainingSec ?? 10));
      // Kahoot speed bonus: 500 base + up to 500 for fast answering
      const speedScore = isCorrect ? Math.round(500 + (timeLeft / 20) * 500) : 0;
      const streakBonus = isCorrect && participant.streak >= 2 ? 100 : 0;
      const totalPoints = speedScore + streakBonus;

      participant.score += totalPoints;
      participant.streak = isCorrect ? participant.streak + 1 : 0;
      participant.answers.push({
        questionIndex,
        selectedOption,
        isCorrect,
        points: totalPoints,
        timeSpentSec: Math.max(1, Math.round(20 - timeLeft))
      });

      // Send grading immediately to the answering student
      socket.emit('quiz:answer_result', {
        isCorrect,
        pointsEarned: totalPoints,
        totalScore: participant.score,
        streak: participant.streak,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        explanationLocal: q.explanationLocal
      });

      // Notify host of live count
      const answeredCount = Array.from(room.participants.values()).filter((p) =>
        p.answers.some((a) => a.questionIndex === questionIndex)
      ).length;

      io.to(pin).emit('quiz:host_answer_update', {
        questionIndex,
        answeredCount,
        totalParticipants: room.participants.size,
        latestAnswer: {
          studentName: participant.studentName,
          isCorrect
        }
      });
    });

    // --- Host Requests Leaderboard / Next Question ---
    socket.on('quiz:show_leaderboard', ({ pin }: { pin: string }) => {
      const room = liveRooms.get(pin);
      if (!room) return;

      const leaderboard = Array.from(room.participants.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((p, idx) => ({
          rank: idx + 1,
          studentId: p.studentId,
          studentName: p.studentName,
          score: p.score,
          streak: p.streak
        }));

      io.to(pin).emit('quiz:leaderboard_snapshot', {
        questionIndex: room.activeQuestionIndex,
        leaderboard
      });
    });

    socket.on('quiz:next_question', ({ pin }: { pin: string }) => {
      const room = liveRooms.get(pin);
      if (!room || room.status !== 'in_progress') return;

      const nextIndex = room.activeQuestionIndex + 1;

      if (nextIndex < room.questions.length) {
        room.activeQuestionIndex = nextIndex;
        room.questionStartedAt = Date.now();
        const nextQ = room.questions[nextIndex];

        io.to(pin).emit('quiz:question_started', {
          questionIndex: nextIndex,
          totalQuestions: room.questions.length,
          stem: nextQ.stem,
          stemLocal: nextQ.stemLocal,
          options: nextQ.options,
          optionsLocal: nextQ.optionsLocal,
          timeLimitSec: nextQ.timeLimitSec,
          startedAt: room.questionStartedAt
        });

        io.to(pin).emit('quiz:host_question_active', {
          questionIndex: nextIndex,
          totalQuestions: room.questions.length,
          stem: nextQ.stem,
          stemLocal: nextQ.stemLocal,
          options: nextQ.options,
          optionsLocal: nextQ.optionsLocal,
          correctIndex: nextQ.correctIndex,
          explanation: nextQ.explanation,
          timeLimitSec: nextQ.timeLimitSec,
          answersCount: 0,
          totalParticipants: room.participants.size
        });
      } else {
        handleEndGame(room, pin);
      }
    });

    socket.on('quiz:end_game', ({ pin }: { pin: string }) => {
      const room = liveRooms.get(pin);
      if (!room || room.status === 'ended') return;
      handleEndGame(room, pin);
    });

    function handleEndGame(room: LiveQuizRoom, pin: string) {
      room.status = 'ended';

      const finalLeaderboard = Array.from(room.participants.values())
        .sort((a, b) => b.score - a.score)
        .map((p, idx) => ({
          rank: idx + 1,
          studentId: p.studentId,
          studentName: p.studentName,
          score: p.score,
          streak: p.streak
        }));

      const podium = finalLeaderboard.slice(0, 3);

      io.to(pin).emit('quiz:game_over', {
        podium,
        leaderboard: finalLeaderboard
      });

      // Persist each student's results into the unified submissions pool
      for (const p of room.participants.values()) {
        const correctCount = p.answers.filter((a) => a.isCorrect).length;
        const scorePct = room.questions.length > 0 ? Math.round((correctCount / room.questions.length) * 100) : 0;

        const submission: StoredSubmission = {
          id: `live_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          lessonId: room.lessonId,
          lessonTitle: room.title,
          studentName: `${p.studentName} (Live)`,
          correct: correctCount,
          total: room.questions.length,
          scorePct,
          submittedAt: new Date().toISOString(),
          results: room.questions.map((rq, qIdx) => {
            const studentAns = p.answers.find((a) => a.questionIndex === qIdx);
            return {
              questionId: rq.id,
              isCorrect: studentAns ? studentAns.isCorrect : false,
              correctIndex: rq.correctIndex,
              explanation: rq.explanation
            };
          })
        };

        const list = quizSubmissions.get(room.lessonId) || [];
        list.unshift(submission);
        quizSubmissions.set(room.lessonId, list);
      }

      console.log(`[Socket] Live Quiz ${pin} finished! Podium: ${podium.map((p) => p.studentName).join(', ')}`);
    }

    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}
