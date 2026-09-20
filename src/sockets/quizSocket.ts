import { Server, Socket } from 'socket.io';
import { QuizSession } from '../models/QuizSession.js';

export function setupQuizSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    socket.on('quiz:join', async ({ pin, studentName, studentId }) => {
      socket.join(pin);
      console.log(`[Socket] Student ${studentName} joined quiz room ${pin}`);

      io.to(pin).emit('quiz:player_joined', {
        studentId,
        studentName,
        timestamp: new Date()
      });
    });

    socket.on('quiz:start', async ({ pin }) => {
      console.log(`[Socket] Quiz ${pin} started by teacher`);
      io.to(pin).emit('quiz:started', { activeQuestionIndex: 0 });
    });

    socket.on('quiz:submit_answer', async ({ pin, studentId, studentName, score }) => {
      io.to(pin).emit('quiz:leaderboard_update', {
        studentId,
        studentName,
        score
      });
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}

