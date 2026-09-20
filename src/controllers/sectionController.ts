import { Request, Response } from 'express';
import { Section } from '../models/Section.js';
import { Institution } from '../models/Institution.js';

function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'CP-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getSections(req: Request, res: Response): Promise<void> {
  try {
    const sections = await Section.find().sort({ createdAt: -1 });
    res.status(200).json(sections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createSection(req: Request, res: Response): Promise<void> {
  try {
    const { name, courseName, teacherNames } = req.body;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 14 days validity

    const newSection = await Section.create({
      name,
      courseName: courseName || name,
      teacherNames: teacherNames || ['Prof. Rajesh Kumar'],
      joinCode: generateJoinCode(),
      joinCodeExpiresAt: expiresAt,
      enrolledCount: 0
    });

    res.status(201).json(newSection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function rotateCode(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const section = await Section.findById(id);
    if (!section) {
      res.status(404).json({ error: 'Section not found' });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    section.joinCode = generateJoinCode();
    section.joinCodeExpiresAt = expiresAt;
    await section.save();

    res.status(200).json({
      success: true,
      joinCode: section.joinCode,
      joinCodeExpiresAt: section.joinCodeExpiresAt
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function previewSection(req: Request, res: Response): Promise<void> {
  try {
    const code = (req.query.code as string || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'Section code is required.' });
      return;
    }

    const section = await Section.findOne({ joinCode: code });
    if (!section) {
      res.status(404).json({ error: 'Invalid join code. Section not found.' });
      return;
    }

    const isExpired = new Date() > new Date(section.joinCodeExpiresAt);
    const institution = await Institution.findOne();

    res.status(200).json({
      code: section.joinCode,
      courseTitle: section.courseName || section.name,
      teacherName: section.teacherNames.join(', ') || 'Faculty',
      institutionName: institution?.name || 'Apex Institute of Technology',
      isExpired
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function joinSection(req: Request, res: Response): Promise<void> {
  try {
    const { code, rollNumber } = req.body;
    const cleanCode = (code || '').trim().toUpperCase();

    if (!cleanCode || !rollNumber) {
      res.status(400).json({ error: 'Join code and roll number are required.' });
      return;
    }

    const section = await Section.findOne({ joinCode: cleanCode });
    if (!section) {
      res.status(404).json({ error: 'Section not found with provided code.' });
      return;
    }

    const alreadyEnrolled = section.enrolledRollNumbers?.includes(rollNumber.trim().toUpperCase());
    if (!alreadyEnrolled) {
      section.enrolledRollNumbers.push(rollNumber.trim().toUpperCase());
      section.enrolledCount = (section.enrolledCount || 0) + 1;
      await section.save();
    }

    const institution = await Institution.findOne();

    res.status(200).json({
      success: true,
      enrollmentId: `enr_${section._id}_${rollNumber}`,
      sectionCode: section.joinCode,
      courseTitle: section.courseName,
      rollNumber: rollNumber.trim().toUpperCase(),
      alreadyEnrolled,
      teacherName: section.teacherNames.join(', ') || 'Faculty',
      institutionName: institution?.name || 'Apex Institute of Technology'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

