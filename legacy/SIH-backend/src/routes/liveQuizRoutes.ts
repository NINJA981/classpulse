import { Router, Request, Response } from 'express';
import { createLiveSession, liveRooms } from '../sockets/quizSocket.js';

export const liveQuizRouter = Router();

// POST /api/live-quiz/create — initialize a live quiz session
liveQuizRouter.post('/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.body;
    if (!lessonId) {
      res.status(400).json({ error: 'lessonId is required' });
      return;
    }

    const room = await createLiveSession(String(lessonId));

    res.status(201).json({
      success: true,
      pin: room.pin,
      lessonId: room.lessonId,
      title: room.title,
      subject: room.subject,
      questionCount: room.questions.length,
      status: room.status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create live session' });
  }
});

import { QuizSession } from '../models/QuizSession.js';

// GET /api/live-quiz/:pin — get live quiz room info
liveQuizRouter.get('/:pin', async (req: Request, res: Response): Promise<void> => {
  const pin = String(req.params.pin);
  const room = liveRooms.get(pin);
  if (room) {
    res.status(200).json({
      pin: room.pin,
      lessonId: room.lessonId,
      title: room.title,
      subject: room.subject,
      status: room.status,
      questionCount: room.questions.length,
      activeQuestionIndex: room.activeQuestionIndex,
      participantsCount: room.participants.size
    });
    return;
  }

  // Fallback to persisted MongoDB QuizSession
  try {
    const dbSession = await QuizSession.findOne({ joinPin: pin }).lean();
    if (dbSession) {
      res.status(200).json({
        pin: dbSession.joinPin,
        lessonId: String(dbSession.lessonId || ''),
        title: dbSession.title,
        subject: '',
        status: dbSession.status,
        questionCount: dbSession.questionIds?.length || 0,
        activeQuestionIndex: dbSession.activeQuestionIndex || 0,
        participantsCount: dbSession.participants?.length || 0
      });
      return;
    }
  } catch (err: any) {
    console.warn('[LiveQuiz] DB fallback error:', err.message);
  }

  res.status(404).json({ error: 'Live room not found or expired.' });
});

// GET /api/live-quiz/:pin/leaderboard — get rankings
liveQuizRouter.get('/:pin/leaderboard', async (req: Request, res: Response): Promise<void> => {
  const pin = String(req.params.pin);
  const room = liveRooms.get(pin);
  if (room) {
    const leaderboard = Array.from(room.participants.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({
        rank: idx + 1,
        studentId: p.studentId,
        studentName: p.studentName,
        score: p.score,
        streak: p.streak
      }));

    res.status(200).json({
      pin,
      status: room.status,
      leaderboard
    });
    return;
  }

  // Fallback to persisted MongoDB QuizSession
  try {
    const dbSession = await QuizSession.findOne({ joinPin: pin }).lean();
    if (dbSession) {
      const leaderboard = (dbSession.participants || [])
        .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
        .map((p: any, idx: number) => ({
          rank: idx + 1,
          studentId: p.studentId,
          studentName: p.studentName,
          score: p.score || 0,
          streak: p.streak || 0
        }));

      res.status(200).json({
        pin,
        status: dbSession.status,
        leaderboard
      });
      return;
    }
  } catch (err: any) {
    console.warn('[LiveQuiz] DB fallback error:', err.message);
  }

  res.status(404).json({ error: 'Room not found' });
});

export default liveQuizRouter;
