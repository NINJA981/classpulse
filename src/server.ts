import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { connectDB } from './config/db.js';
import { setupQuizSockets } from './sockets/quizSocket.js';

import authRoutes from './routes/authRoutes.js';
import lessonRoutes from './routes/lessonRoutes.js';
import questionRoutes from './routes/questionRoutes.js';
import sectionRoutes from './routes/sectionRoutes.js';
import assignmentRoutes from './routes/assignmentRoutes.js';
import diagnosticRoutes from './routes/diagnosticRoutes.js';
import studentQuizRouter from './routes/studentQuizRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import liveQuizRouter from './routes/liveQuizRoutes.js';
import { pipelineHealth } from './services/pipelineClient.js';
import { pipelineRouter } from './routes/pipelineRoutes.js';
import { seedDatabase } from './scripts/seed.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:5171,http://localhost:5174')
  .split(',')
  .map(origin => origin.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.) or in allowed list
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in dev
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploads
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/student/quizzes', studentQuizRouter);
app.use('/api/student', studentRoutes);
app.use('/api/live-quiz', liveQuizRouter);
app.use('/v1', pipelineRouter);

// Health check endpoint (includes pipeline sidecar connectivity)
app.get('/api/health', async (req, res) => {
  const pipeline = await pipelineHealth();
  res.status(200).json({
    status: 'healthy',
    service: 'SIH-backend',
    database: 'MongoDB',
    pipeline,
    timestamp: new Date().toISOString()
  });
});

// Setup WebSockets
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
setupQuizSockets(io);

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectDB();
    await seedDatabase();

    server.listen(PORT, () => {
      console.log(`=========================================`);
      console.log(`🚀 ClassPulse Backend is LIVE`);
      console.log(`📡 URL: http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
      console.log(`=========================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

