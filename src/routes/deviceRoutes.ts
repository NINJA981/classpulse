import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { Device } from '../models/Device.js';
import { Lesson } from '../models/Lesson.js';
import { enqueueLessonJob } from '../services/queueService.js';
import { storageService } from '../services/storageService.js';

export const deviceRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB per chunk
});

// Middleware to authenticate device calls via x-device-id and x-device-key
async function authenticateDevice(req: Request, res: Response, next: () => void) {
  const deviceId = req.headers['x-device-id'] as string;
  const apiKey = req.headers['x-device-key'] as string;

  if (!deviceId || !apiKey) {
    res.status(401).json({ error: 'Missing x-device-id or x-device-key headers' });
    return;
  }

  try {
    const device = await Device.findOne({ deviceId }).lean();
    if (!device || device.apiKey !== apiKey) {
      res.status(403).json({ error: 'Invalid device credentials' });
      return;
    }
    (req as any).device = device;
    next();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/device/register — Register/pair a Raspberry Pi 5 device
deviceRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId, name, classroomId, classroomName, firmwareVersion } = req.body;

    if (!deviceId || !classroomId) {
      res.status(400).json({ error: 'deviceId and classroomId are required' });
      return;
    }

    let device = await Device.findOne({ deviceId });
    if (!device) {
      const generatedApiKey = `cp_dev_${crypto.randomBytes(24).toString('hex')}`;
      device = await Device.create({
        deviceId,
        name: name || `Classroom Pi (${classroomId})`,
        classroomId,
        classroomName: classroomName || `Room ${classroomId}`,
        apiKey: generatedApiKey,
        status: 'online',
        firmwareVersion: firmwareVersion || '1.0.0',
        lastHeartbeat: new Date()
      });
      console.log(`[Device] Registered new Pi device: ${deviceId} for room ${classroomId}`);
    } else {
      device.status = 'online';
      device.lastHeartbeat = new Date();
      if (name) device.name = name;
      if (classroomName) device.classroomName = classroomName;
      await device.save();
    }

    res.status(200).json({
      success: true,
      deviceId: device.deviceId,
      apiKey: device.apiKey,
      classroomId: device.classroomId,
      classroomName: device.classroomName,
      status: device.status
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/device/heartbeat — Periodic telemetry ping from the Pi
deviceRouter.post('/heartbeat', authenticateDevice, async (req: Request, res: Response): Promise<void> => {
  try {
    const device = (req as any).device;
    const { systemStats, status, firmwareVersion } = req.body;

    await Device.updateOne(
      { deviceId: device.deviceId },
      {
        status: status || 'online',
        lastHeartbeat: new Date(),
        ipAddress: req.ip || req.socket.remoteAddress,
        ...(firmwareVersion ? { firmwareVersion } : {}),
        ...(systemStats ? { systemStats } : {})
      }
    );

    res.status(200).json({
      status: 'acknowledged',
      serverTime: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/device/session/start — Start an audio capture session from the classroom
deviceRouter.post('/session/start', authenticateDevice, async (req: Request, res: Response): Promise<void> => {
  try {
    const device = (req as any).device;
    const { title, subject, teacherId, teacherName, language } = req.body;

    const sessionId = `rec_${Date.now()}_${device.deviceId.slice(-4)}`;

    // Create draft Lesson in MongoDB
    const lesson = await Lesson.create({
      title: title || `Lecture ${new Date().toLocaleDateString('en-IN')}`,
      subject: subject || 'General Science',
      className: device.classroomName || `Room ${device.classroomId}`,
      teacherId: teacherId || 'teacher_rpi',
      language: language || 'en',
      status: 'draft',
      sourceType: 'audio'
    });

    await Device.updateOne(
      { deviceId: device.deviceId },
      { status: 'recording', currentSessionId: sessionId }
    );

    res.status(201).json({
      success: true,
      sessionId,
      lessonId: String(lesson._id),
      startedAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/device/session/chunk — Resilient chunked audio upload from Pi buffer
deviceRouter.post(
  '/session/chunk',
  authenticateDevice,
  upload.single('chunk'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { sessionId, chunkIndex } = req.body;
      const file = req.file;

      if (!sessionId || !file) {
        res.status(400).json({ error: 'sessionId and audio chunk are required' });
        return;
      }

      // Buffer chunk on server disk under session directory
      const sessionDir = path.join(process.cwd(), 'uploads', 'sessions', sessionId);
      await fs.promises.mkdir(sessionDir, { recursive: true });

      const chunkFilename = `chunk_${String(chunkIndex).padStart(5, '0')}.raw`;
      await fs.promises.writeFile(path.join(sessionDir, chunkFilename), file.buffer);

      res.status(200).json({
        success: true,
        sessionId,
        chunkIndex: parseInt(chunkIndex, 10),
        bytesReceived: file.buffer.length
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/device/session/finalize — Finish recording, stitch chunks, and enqueue AI processing
deviceRouter.post('/session/finalize', authenticateDevice, async (req: Request, res: Response): Promise<void> => {
  try {
    const device = (req as any).device;
    const { sessionId, lessonId, totalChunks, durationSec } = req.body;

    if (!sessionId || !lessonId) {
      res.status(400).json({ error: 'sessionId and lessonId are required' });
      return;
    }

    const sessionDir = path.join(process.cwd(), 'uploads', 'sessions', sessionId);
    const finalFilename = `lecture_${sessionId}.wav`;
    const finalFilePath = path.join(process.cwd(), 'uploads', finalFilename);

    // Merge audio chunks if chunk directory exists
    if (fs.existsSync(sessionDir)) {
      const chunkFiles = (await fs.promises.readdir(sessionDir))
        .filter((f) => f.startsWith('chunk_'))
        .sort();

      const writeStream = fs.createWriteStream(finalFilePath);
      for (const cFile of chunkFiles) {
        const chunkBuf = await fs.promises.readFile(path.join(sessionDir, cFile));
        writeStream.write(chunkBuf);
      }
      writeStream.end();
      // Clean up session chunk directory
      await fs.promises.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
    }

    // Update Lesson with file info
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      res.status(404).json({ error: 'Lesson record not found' });
      return;
    }

    const fileSize = fs.existsSync(finalFilePath) ? (await fs.promises.stat(finalFilePath)).size : 0;
    lesson.sourceFile = {
      path: `/uploads/${finalFilename}`,
      mimeType: 'audio/wav',
      sizeBytes: fileSize,
      durationSec: durationSec ? parseInt(durationSec, 10) : undefined
    };
    lesson.status = 'queued';
    await lesson.save();

    // Reset device state
    await Device.updateOne(
      { deviceId: device.deviceId },
      { status: 'online', currentSessionId: undefined }
    );

    // Enqueue background transcription and quiz generation via BullMQ
    const queueResult = await enqueueLessonJob(String(lesson._id));

    res.status(200).json({
      success: true,
      lessonId: String(lesson._id),
      audioPath: `/uploads/${finalFilename}`,
      queue: queueResult
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/device/list — List all registered devices (Admin/monitoring)
deviceRouter.get('/list', async (_req: Request, res: Response): Promise<void> => {
  try {
    const devices = await Device.find().sort({ lastHeartbeat: -1 }).lean();
    res.status(200).json({
      count: devices.length,
      devices: devices.map((d) => ({
        deviceId: d.deviceId,
        name: d.name,
        classroomId: d.classroomId,
        classroomName: d.classroomName,
        status: d.status,
        firmwareVersion: d.firmwareVersion,
        lastHeartbeat: d.lastHeartbeat,
        ipAddress: d.ipAddress,
        systemStats: d.systemStats
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default deviceRouter;
