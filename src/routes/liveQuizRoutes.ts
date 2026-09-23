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

// GET /api/live-quiz/:pin — get live quiz room info
liveQuizRouter.get('/:pin', (req: Request, res: Response): void => {
  const pin = String(req.params.pin);
  const room = liveRooms.get(pin);
  if (!room) {
    res.status(404).json({ error: 'Live room not found or expired.' });
    return;
  }

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
});

// GET /api/live-quiz/:pin/leaderboard — get rankings
liveQuizRouter.get('/:pin/leaderboard', (req: Request, res: Response): void => {
  const pin = String(req.params.pin);
  const room = liveRooms.get(pin);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

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
});

export default liveQuizRouter;
