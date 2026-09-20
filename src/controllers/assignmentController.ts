import { Request, Response } from 'express';
import { Assignment } from '../models/Assignment.js';

export async function getAssignments(req: Request, res: Response): Promise<void> {
  try {
    const { sectionId, lessonId } = req.query;
    const filter: any = {};
    if (sectionId) filter.sectionId = sectionId;
    if (lessonId) filter.lessonId = lessonId;

    const assignments = await Assignment.find(filter).sort({ createdAt: -1 });
    res.status(200).json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createAssignment(req: Request, res: Response): Promise<void> {
  try {
    const newAssignment = await Assignment.create(req.body);
    res.status(201).json(newAssignment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

