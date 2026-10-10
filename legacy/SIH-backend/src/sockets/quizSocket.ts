import { Server, Socket } from 'socket.io';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { QuizSession } from '../models/QuizSession.js';
import { StudentSubmission } from '../models/StudentSubmission.js';
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

export interface LiveParticipantAnswer {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  points: number;
  timeSpentSec: number;
  submittedAt: number;
  revisions: Array<{
    previousOption: number;
    changedAt: number;
  }>;
}

export interface LiveParticipant {
  studentId: string;
  studentName: string;
  socketId: string;
  connected: boolean;
  score: number;
  streak: number;
  answers: LiveParticipantAnswer[];
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
  questionDeadline: number;
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
    questionDeadline: 0,
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
        participants: Array.from(room.participants.values()).map((p) => ({
          studentId: p.studentId,
          studentName: p.studentName,
          score: p.score,
          streak: p.streak,
          connected: p.connected
        }))
      });
      console.log(`[Socket] Host joined room ${pin}`);
    });

    // --- Student Joins / Reconnects to Room ---
    socket.on('quiz:join', ({ pin, studentName, studentId }: { pin: string; studentName: string; studentId?: string }) => {
      const room = liveRooms.get(pin);
      if (!room) {
        socket.emit('quiz:error', { message: 'Invalid PIN. Room does not exist.' });
        return;
      }

      const sId = studentId || socket.id;
      (socket as any).data = { ...(socket as any).data, studentId: sId, pin };

      let participant = room.participants.get(sId);
      let isReconnecting = false;

      if (participant) {
        // Reconnection flow: preserve state, score, answers, and streak
        isReconnecting = true;
        participant.socketId = socket.id;
        participant.connected = true;
        if (studentName?.trim()) {
          participant.studentName = studentName.trim();
        }
        console.log(`[Socket] Student ${participant.studentName} (${sId}) reconnected to PIN ${pin}`);
      } else {
        // New participant
        const sName = studentName?.trim() || `Player ${room.participants.size + 1}`;
        participant = {
          studentId: sId,
          studentName: sName,
          socketId: socket.id,
          connected: true,
          score: 0,
          streak: 0,
          answers: []
        };
        room.participants.set(sId, participant);
        console.log(`[Socket] Student ${sName} (${sId}) joined PIN ${pin}`);
      }

      socket.join(pin);

      const activeQ = room.questions[room.activeQuestionIndex];
      const existingAnswer = participant.answers.find((a) => a.questionIndex === room.activeQuestionIndex);

      socket.emit('quiz:joined_success', {
        pin,
        title: room.title,
        subject: room.subject,
        studentId: sId,
        studentName: participant.studentName,
        status: room.status,
        questionCount: room.questions.length,
        activeQuestionIndex: room.activeQuestionIndex,
        currentScore: participant.score,
        currentStreak: participant.streak,
        reconnected: isReconnecting,
        activeQuestion: room.status === 'in_progress' && activeQ ? {
          questionIndex: room.activeQuestionIndex,
          stem: activeQ.stem,
          stemLocal: activeQ.stemLocal,
          options: activeQ.options,
          optionsLocal: activeQ.optionsLocal,
          timeLimitSec: activeQ.timeLimitSec,
          startedAt: room.questionStartedAt,
          deadline: room.questionDeadline,
          hasAnswered: Boolean(existingAnswer),
          selectedOption: existingAnswer ? existingAnswer.selectedOption : null
        } : null
      });

      const participantList = Array.from(room.participants.values()).map((p) => ({
        studentId: p.studentId,
        studentName: p.studentName,
        score: p.score,
        connected: p.connected
      }));

      io.to(pin).emit('quiz:player_joined', {
        studentId: sId,
        studentName: participant.studentName,
        participantsCount: room.participants.size,
        participants: participantList
      });
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

      room.questionDeadline = room.questionStartedAt + q.timeLimitSec * 1000;

      // Broadcast question to students without leaking correct answer
      io.to(pin).emit('quiz:question_started', {
        questionIndex: 0,
        totalQuestions: room.questions.length,
        stem: q.stem,
        stemLocal: q.stemLocal,
        options: q.options,
        optionsLocal: q.optionsLocal,
        timeLimitSec: q.timeLimitSec,
        startedAt: room.questionStartedAt,
        deadline: room.questionDeadline
      });

      // Host receives HUD with correct answer and monitoring counts
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

    // --- Student Submits or Modifies Answer (Server-Side Validation & Auditing) ---
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
      if (!room || room.status !== 'in_progress') {
        socket.emit('quiz:error', { message: 'Quiz session is not currently accepting answers.' });
        return;
      }

      // Reject stale question submission
      if (room.activeQuestionIndex !== questionIndex) {
        socket.emit('quiz:error', { message: 'Question is no longer active. Submission rejected.' });
        return;
      }

      const q = room.questions[questionIndex];
      const participant = room.participants.get(studentId) || room.participants.get((socket as any).data?.studentId);
      if (!q || !participant) {
        socket.emit('quiz:error', { message: 'Participant or question not recognized.' });
        return;
      }

      // Check deadline with 2-second network latency buffer
      const now = Date.now();
      const networkGraceMs = 2000;
      if (room.questionDeadline > 0 && now > room.questionDeadline + networkGraceMs) {
        socket.emit('quiz:error', { message: 'Deadline has passed for this question.' });
        return;
      }

      // Server-side validation of selected option bounds
      if (typeof selectedOption !== 'number' || selectedOption < 0 || selectedOption >= q.options.length) {
        socket.emit('quiz:error', { message: 'Invalid option selected.' });
        return;
      }

      const isCorrect = selectedOption === q.correctIndex;
      const timeLeft = typeof timeRemainingSec === 'number'
        ? Math.max(0, Math.min(q.timeLimitSec, timeRemainingSec))
        : Math.max(0, Math.round((room.questionDeadline - now) / 1000));

      const speedScore = isCorrect ? Math.round(500 + (timeLeft / q.timeLimitSec) * 500) : 0;
      const streakBonus = isCorrect && participant.streak >= 2 ? 100 : 0;
      const totalPoints = speedScore + streakBonus;

      const existingIdx = participant.answers.findIndex((a) => a.questionIndex === questionIndex);

      if (existingIdx !== -1) {
        // Answer modification before deadline: preserve auditable revision history
        const prevAnswer = participant.answers[existingIdx];
        participant.score = Math.max(0, participant.score - prevAnswer.points) + totalPoints;
        participant.streak = isCorrect ? (prevAnswer.isCorrect ? participant.streak : participant.streak + 1) : 0;

        const revisions = prevAnswer.revisions || [];
        revisions.push({
          previousOption: prevAnswer.selectedOption,
          changedAt: prevAnswer.submittedAt
        });

        participant.answers[existingIdx] = {
          questionIndex,
          selectedOption,
          isCorrect,
          points: totalPoints,
          timeSpentSec: Math.max(1, q.timeLimitSec - timeLeft),
          submittedAt: now,
          revisions
        };

        console.log(`[Socket] Student ${participant.studentName} updated Q${questionIndex + 1} to option ${selectedOption} (Rev #${revisions.length})`);
      } else {
        // First answer submission
        participant.score += totalPoints;
        participant.streak = isCorrect ? participant.streak + 1 : 0;
        participant.answers.push({
          questionIndex,
          selectedOption,
          isCorrect,
          points: totalPoints,
          timeSpentSec: Math.max(1, q.timeLimitSec - timeLeft),
          submittedAt: now,
          revisions: []
        });
        console.log(`[Socket] Student ${participant.studentName} answered Q${questionIndex + 1}: option ${selectedOption}`);
      }

      // Confirm submission receipt
      socket.emit('quiz:answer_acknowledged', {
        questionIndex,
        selectedOption,
        totalScore: participant.score,
        canChangeUntil: room.questionDeadline
      });

      // Provide instant feedback to student
      socket.emit('quiz:answer_result', {
        isCorrect,
        pointsEarned: totalPoints,
        totalScore: participant.score,
        streak: participant.streak,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        explanationLocal: q.explanationLocal
      });

      // Notify host of live progress
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

    // --- Host Requests Leaderboard ---
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

    // --- Host Advances Question ---
    socket.on('quiz:next_question', ({ pin }: { pin: string }) => {
      const room = liveRooms.get(pin);
      if (!room || room.status !== 'in_progress') return;

      const nextIndex = room.activeQuestionIndex + 1;

      if (nextIndex < room.questions.length) {
        room.activeQuestionIndex = nextIndex;
        room.questionStartedAt = Date.now();
        const nextQ = room.questions[nextIndex];
        room.questionDeadline = room.questionStartedAt + nextQ.timeLimitSec * 1000;

        io.to(pin).emit('quiz:question_started', {
          questionIndex: nextIndex,
          totalQuestions: room.questions.length,
          stem: nextQ.stem,
          stemLocal: nextQ.stemLocal,
          options: nextQ.options,
          optionsLocal: nextQ.optionsLocal,
          timeLimitSec: nextQ.timeLimitSec,
          startedAt: room.questionStartedAt,
          deadline: room.questionDeadline
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

    async function handleEndGame(room: LiveQuizRoom, pin: string) {
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

      // Persist all participant scores into the unified StudentSubmission database
      for (const p of room.participants.values()) {
        const correctCount = p.answers.filter((a) => a.isCorrect).length;
        const scorePct = room.questions.length > 0 ? Math.round((correctCount / room.questions.length) * 100) : 0;

        const results = room.questions.map((rq, qIdx) => {
          const studentAns = p.answers.find((a) => a.questionIndex === qIdx);
          return {
            questionId: rq.id,
            selectedOption: studentAns?.selectedOption,
            isCorrect: studentAns ? studentAns.isCorrect : false,
            correctIndex: rq.correctIndex,
            explanation: rq.explanation,
            explanationLocal: rq.explanationLocal
          };
        });

        // 1. Write to database
        try {
          await StudentSubmission.create({
            lessonId: room.lessonId,
            lessonTitle: room.title,
            studentName: `${p.studentName} (Live)`,
            rollNumber: `LIVE-${p.studentId.slice(-4).toUpperCase()}`,
            correct: correctCount,
            total: room.questions.length,
            scorePct,
            results,
            submittedAt: new Date()
          });
        } catch (dbErr) {
          console.warn('[LiveQuiz] Failed to persist StudentSubmission to Mongo:', dbErr);
        }

        // 2. Keep memory cache for instant lookup
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

      // Update QuizSession in Mongo
      try {
        await QuizSession.findOneAndUpdate(
          { joinPin: pin },
          {
            status: 'ended',
            activeQuestionIndex: room.questions.length - 1,
            participants: Array.from(room.participants.values()).map((p) => ({
              studentId: p.studentId,
              studentName: p.studentName,
              score: p.score,
              streak: p.streak,
              answers: p.answers.map((a) => ({
                questionIndex: a.questionIndex,
                selectedOption: a.selectedOption,
                isCorrect: a.isCorrect
              }))
            }))
          }
        );
      } catch (err) {
        console.warn('[LiveQuiz] Failed to update QuizSession in Mongo:', err);
      }

      console.log(`[Socket] Live Quiz ${pin} finished! Podium: ${podium.map((p) => p.studentName).join(', ')}`);
    }

    socket.on('disconnect', () => {
      const pin = (socket as any).data?.pin;
      const studentId = (socket as any).data?.studentId;
      if (pin && studentId) {
        const room = liveRooms.get(pin);
        if (room) {
          const participant = room.participants.get(studentId);
          if (participant) {
            participant.connected = false;
            console.log(`[Socket] Student ${participant.studentName} temporarily disconnected from PIN ${pin}`);
          }
        }
      }
      console.log(`[Socket] Disconnected: ${socket.id}`);
    });
  });
}
