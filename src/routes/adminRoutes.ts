import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Section } from '../models/Section.js';
import { Lesson } from '../models/Lesson.js';
import { Question } from '../models/Question.js';
import { Institution } from '../models/Institution.js';

const router = Router();

let storedTimetables: Record<string, any> = {};
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
router.get('/timetables', (_req: Request, res: Response) => {
  res.status(200).json({ timetables: storedTimetables });
});

router.put('/timetables', (req: Request, res: Response) => {
  if (req.body?.timetables && typeof req.body.timetables === 'object') {
    storedTimetables = req.body.timetables;
  }
  res.status(200).json({ timetables: storedTimetables });
});

// GET & PATCH /api/admin/settings/models
router.get('/settings/models', (_req: Request, res: Response) => {
  res.status(200).json({
    settings: storedModelSettings,
    options: MODEL_OPTIONS
  });
});

router.patch('/settings/models', (req: Request, res: Response) => {
  const { asr, llm } = req.body || {};
  if (asr?.provider && asr?.model) {
    storedModelSettings.asrProvider = asr.provider;
    storedModelSettings.asrModel = asr.model;
  }
  if (llm?.provider && llm?.model) {
    storedModelSettings.llmProvider = llm.provider;
    storedModelSettings.llmModel = llm.model;
  }
  res.status(200).json({
    settings: storedModelSettings,
    options: MODEL_OPTIONS
  });
});

export default router;
