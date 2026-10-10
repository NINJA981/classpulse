import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Section } from '../models/Section.js';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { Institution } from '../models/Institution.js';
import { Timetable } from '../models/Timetable.js';
import { ModelSetting } from '../models/ModelSetting.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

// Protect all admin endpoints with admin role check
router.use(authenticateToken as any);
router.use(requireRole(['admin']) as any);


let storedTimetables: Record<string, any> = {
  'Grade 10 - Section B': {
    Monday: [
      { time: '09:00 - 10:00 AM', subject: 'Biology & Genetics', teacher: 'Dr. Anitha', room: 'Science Lab 2' },
      { time: '10:00 - 11:00 AM', subject: 'Physics & Thermodynamics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' }
    ],
    Tuesday: [
      { time: '09:00 - 10:00 AM', subject: 'Biology & Genetics', teacher: 'Dr. Anitha', room: 'Room 304' },
      { time: '11:15 - 12:15 PM', subject: 'Physics & Thermodynamics', teacher: 'Prof. Rajesh Kumar', room: 'Room 201' }
    ],
    Wednesday: [
      { time: '10:00 - 11:00 AM', subject: 'Biology Lab', teacher: 'Dr. Anitha', room: 'Science Lab 2' }
    ],
    Thursday: [
      { time: '09:00 - 10:00 AM', subject: 'Physics & Thermodynamics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' }
    ],
    Friday: [
      { time: '09:00 - 10:00 AM', subject: 'Biology Revision & Live Quiz', teacher: 'Dr. Anitha', room: 'Science Lab 2' }
    ]
  },
  'Grade 10 - Section A': {
    Monday: [
      { time: '10:00 - 11:00 AM', subject: 'Physics & Thermodynamics', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' }
    ],
    Wednesday: [
      { time: '09:00 - 10:00 AM', subject: 'Physics & Thermodynamics', teacher: 'Prof. Rajesh Kumar', room: 'Room 105' }
    ],
    Friday: [
      { time: '11:15 - 12:15 PM', subject: 'Thermodynamics Lab', teacher: 'Prof. Rajesh Kumar', room: 'Physics Lab 1' }
    ]
  }
};
let storedModelSettings = {
  asrProvider: 'sarvam',
  asrModel: 'saaras:v3',
  llmProvider: 'openai',
  llmModel: 'gpt-4o-mini'
};

const MODEL_OPTIONS = {
  asr: [
    { provider: 'sarvam', model: 'saaras:v3', label: 'Sarvam Saaras v3 (Indic + English)', note: 'Multilingual batch & realtime STT' },
    { provider: 'sarvam', model: 'saaras:v4', label: 'Sarvam Saaras v4', note: 'Latest Indic speech model' },
    { provider: 'openai', model: 'whisper-1', label: 'OpenAI Whisper v1', note: 'General speech recognition' }
  ],
  llm: [
    { provider: 'openai', model: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini', note: 'Fast, low-latency quiz & remedial generation' },
    { provider: 'openai', model: 'gpt-4o', label: 'OpenAI GPT-4o', note: 'Deep reasoning & multilingual synthesis' },
    { provider: 'gemini', model: 'gemini-2.5-flash', label: 'Google Gemini 2.5 Flash', note: 'Long-context lecture analysis' }
  ]
};

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'CP-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// GET /api/admin/overview
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [
      teachers,
      students,
      sections,
      lessons,
      publishedLessons,
      questions,
      approvedQuestions,
      institution,
      recentLessonsRaw
    ] = await Promise.all([
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'student' }),
      Section.countDocuments(),
      Lesson.countDocuments(),
      Lesson.countDocuments({ status: 'published' }),
      Question.countDocuments(),
      Question.countDocuments({ status: 'approved' }),
      Institution.findOne().lean(),
      Lesson.find().sort({ createdAt: -1 }).limit(10).lean()
    ]);

    res.status(200).json({
      counts: {
        teachers,
        students,
        courses: sections,
        sections,
        lessons,
        publishedLessons,
        questions,
        approvedQuestions
      },
      lessonsByStatus: [
        { status: 'published', count: publishedLessons },
        { status: 'ready_for_review', count: Math.max(0, lessons - publishedLessons) }
      ],
      recentLessons: recentLessonsRaw.map((l) => ({
        ...l,
        id: String(l._id)
      })),
      institution: institution
        ? {
            id: String(institution._id),
            name: institution.name,
            code: institution.code,
            emailDomains: institution.emailDomains,
            timezone: institution.timezone,
            academicYear: institution.academicYear
          }
        : null
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/admin/sections
router.get('/sections', async (_req: Request, res: Response) => {
  try {
    const sections = await Section.find().sort({ createdAt: -1 }).lean();
    const teachers = await User.find({ role: 'teacher' }).lean();
    const items = sections.map((s) => {
      const matchedTeachers = teachers.filter((t) => (s.teacherNames || []).includes(t.name));
      return {
        id: String(s._id),
        _id: String(s._id),
        name: s.name,
        courseId: String(s._id),
        courseName: s.courseName,
        joinCode: s.joinCode,
        teacherIds: matchedTeachers.map((t) => String(t._id)),
        teacherNames: s.teacherNames || [],
        enrolledCount: s.enrolledCount || (s.enrolledRollNumbers?.length ?? 0)
      };
    });
    res.status(200).json({ items });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/admin/sections
router.post('/sections', async (req: Request, res: Response) => {
  try {
    const { name, courseName, teacherIds, teacherNames } = req.body;
    let resolvedTeacherNames: string[] = teacherNames || [];
    if (Array.isArray(teacherIds) && teacherIds.length > 0 && resolvedTeacherNames.length === 0) {
      const found = await User.find({ _id: { $in: teacherIds } }).lean();
      resolvedTeacherNames = found.map((t) => t.name);
    }
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const created = await Section.create({
      name: name || 'New Section',
      courseName: courseName || name || 'General Course',
      teacherNames: resolvedTeacherNames.length > 0 ? resolvedTeacherNames : ['Dr. Anitha'],
      joinCode: generateJoinCode(),
      joinCodeExpiresAt: expiresAt,
      enrolledCount: 0,
      enrolledRollNumbers: []
    });

    res.status(201).json({
      section: {
        id: String(created._id),
        name: created.name,
        courseName: created.courseName,
        joinCode: created.joinCode,
        teacherNames: created.teacherNames,
        enrolledCount: created.enrolledCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/admin/sections/:id
router.patch('/sections/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, teacherIds, teacherNames } = req.body;
    const update: Record<string, any> = {};
    if (name) update.name = name;
    if (Array.isArray(teacherNames)) {
      update.teacherNames = teacherNames;
    } else if (Array.isArray(teacherIds) && teacherIds.length > 0) {
      const found = await User.find({ _id: { $in: teacherIds } }).lean();
      update.teacherNames = found.map((t) => t.name);
    }

    const updated = await Section.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      res.status(404).json({ error: { message: 'Section not found' } });
      return;
    }
    res.status(200).json({
      section: {
        id: String(updated._id),
        name: updated.name,
        joinCode: updated.joinCode,
        teacherNames: updated.teacherNames,
        enrolledCount: updated.enrolledCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/admin/sections/:id
router.delete('/sections/:id', async (req: Request, res: Response) => {
  try {
    await Section.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/admin/teachers
router.get('/teachers', async (_req: Request, res: Response) => {
  try {
    const teachers = await User.find({ role: 'teacher' }).sort({ createdAt: -1 }).lean();
    const sections = await Section.find().lean();
    const items = teachers.map((t) => {
      const assigned = sections
        .filter((s) => (s.teacherNames || []).includes(t.name))
        .map((s) => s.name);
      return {
        id: String(t._id),
        name: t.name,
        email: t.email,
        department: t.department || 'Academic Faculty',
        assignedClasses: assigned.length > 0 ? assigned : ['Grade 10 - Section B'],
        createdAt: t.createdAt
      };
    });
    res.status(200).json({ items });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/admin/teachers
router.post('/teachers', async (req: Request, res: Response) => {
  try {
    const { name, email, department, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'teacher123', salt);
    const created = await User.create({
      name: name || 'Faculty Member',
      email: (email || `faculty.${Date.now()}@apex.edu`).toLowerCase(),
      passwordHash,
      role: 'teacher',
      department: department || 'Faculty'
    });
    res.status(201).json({
      teacher: {
        id: String(created._id),
        name: created.name,
        email: created.email,
        department: created.department,
        createdAt: created.createdAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/admin/teachers/:id
router.delete('/teachers/:id', async (req: Request, res: Response) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/admin/students
router.get('/students', async (_req: Request, res: Response) => {
  try {
    const students = await User.find({ role: 'student' }).sort({ createdAt: -1 }).lean();
    const sections = await Section.find().lean();
    const items = students.map((s) => {
      const enrolledSection = sections.find((sec) =>
        (sec.enrolledRollNumbers || []).includes(s.rollNumber || '')
      );
      return {
        id: String(s._id),
        name: s.name,
        email: s.email,
        rollNumber: s.rollNumber || '21CS001',
        className: enrolledSection?.name || 'Grade 10 - Section B',
        createdAt: s.createdAt
      };
    });
    res.status(200).json({ items });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/admin/students
router.post('/students', async (req: Request, res: Response) => {
  try {
    const { name, rollNumber, email, sectionId, password } = req.body;
    const cleanRoll = (rollNumber || `STU-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password || 'student123', salt);

    const created = await User.create({
      name: name || 'Student',
      email: (email || `${cleanRoll.toLowerCase()}@apex.edu`).toLowerCase(),
      rollNumber: cleanRoll,
      passwordHash,
      role: 'student'
    });

    if (sectionId) {
      const sec = await Section.findById(sectionId);
      if (sec && !sec.enrolledRollNumbers.includes(cleanRoll)) {
        sec.enrolledRollNumbers.push(cleanRoll);
        sec.enrolledCount = (sec.enrolledCount || 0) + 1;
        await sec.save();
      }
    }

    res.status(201).json({
      student: {
        id: String(created._id),
        name: created.name,
        email: created.email,
        rollNumber: created.rollNumber,
        createdAt: created.createdAt
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/admin/students/:id
router.delete('/students/:id', async (req: Request, res: Response) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/admin/courses
router.get('/courses', async (_req: Request, res: Response) => {
  try {
    const sections = await Section.find().lean();
    const items = sections.map((s) => ({
      id: String(s._id),
      code: s.joinCode,
      title: s.courseName || s.name,
      subject: s.courseName || 'Science'
    }));
    res.status(200).json({ items });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/admin/timetables & PUT /api/admin/timetables
router.get('/timetables', async (_req: Request, res: Response) => {
  try {
    const list = await Timetable.find().lean();
    if (list.length === 0) {
      // Seed default timetables if DB is fresh
      for (const [secName, sched] of Object.entries(storedTimetables)) {
        await Timetable.create({ sectionName: secName, schedule: sched }).catch(() => null);
      }
      res.status(200).json({ timetables: storedTimetables });
      return;
    }
    const map: Record<string, any> = {};
    for (const item of list) {
      map[item.sectionName] = item.schedule;
    }
    res.status(200).json({ timetables: map });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.put('/timetables', async (req: Request, res: Response) => {
  try {
    const timetablesObj = req.body?.timetables;
    if (timetablesObj && typeof timetablesObj === 'object') {
      for (const [secName, sched] of Object.entries(timetablesObj)) {
        await Timetable.findOneAndUpdate(
          { sectionName: secName },
          { schedule: sched },
          { upsert: true, new: true }
        );
      }
      storedTimetables = timetablesObj;
    }
    res.status(200).json({ timetables: req.body?.timetables || storedTimetables });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET & PATCH /api/admin/settings/models
router.get('/settings/models', async (_req: Request, res: Response) => {
  try {
    let setting: any = await ModelSetting.findOne({ key: 'global_model_settings' }).lean();
    if (!setting) {
      setting = await ModelSetting.create({
        key: 'global_model_settings',
        ...storedModelSettings
      });
    }
    res.status(200).json({
      settings: {
        asrProvider: setting.asrProvider,
        asrModel: setting.asrModel,
        llmProvider: setting.llmProvider,
        llmModel: setting.llmModel,
        ttsProvider: setting.ttsProvider || 'sarvam-bulbul-v3'
      },
      options: MODEL_OPTIONS
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

router.patch('/settings/models', async (req: Request, res: Response) => {
  try {
    const { asr, llm, tts } = req.body || {};
    const update: Record<string, any> = {};
    if (asr?.provider && asr?.model) {
      update.asrProvider = asr.provider;
      update.asrModel = asr.model;
      storedModelSettings.asrProvider = asr.provider;
      storedModelSettings.asrModel = asr.model;
    }
    if (llm?.provider && llm?.model) {
      update.llmProvider = llm.provider;
      update.llmModel = llm.model;
      storedModelSettings.llmProvider = llm.provider;
      storedModelSettings.llmModel = llm.model;
    }
    if (tts?.provider) {
      update.ttsProvider = tts.provider;
    }

    const updated = await ModelSetting.findOneAndUpdate(
      { key: 'global_model_settings' },
      update,
      { upsert: true, new: true }
    );

    res.status(200).json({
      settings: {
        asrProvider: updated.asrProvider,
        asrModel: updated.asrModel,
        llmProvider: updated.llmProvider,
        llmModel: updated.llmModel,
        ttsProvider: updated.ttsProvider || 'sarvam-bulbul-v3'
      },
      options: MODEL_OPTIONS
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
