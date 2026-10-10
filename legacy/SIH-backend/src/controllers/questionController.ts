import { Request, Response } from 'express';
import { Question } from '../models/Question.js';

export async function getQuestions(req: Request, res: Response): Promise<void> {
  try {
    const { lessonId } = req.query;
    const filter = lessonId ? { lessonId } : {};
    const questions = await Question.find(filter);
    res.status(200).json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function createQuestion(req: Request, res: Response): Promise<void> {
  try {
    const newQuestion = await Question.create({
      ...req.body,
      editedByTeacher: true
    });
    res.status(201).json(newQuestion);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function updateQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await Question.findByIdAndUpdate(
      id,
      { ...req.body, editedByTeacher: true },
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.status(200).json({ ...updated.toObject(), id: String(updated._id), question: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deleted = await Question.findByIdAndDelete(id);
    if (!deleted) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.status(200).json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function approveQuestions(req: Request, res: Response): Promise<void> {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : (req.params.id ? [req.params.id] : []);
    if (!ids || ids.length === 0) {
      res.status(400).json({ error: 'Array of ids required.' });
      return;
    }
    const result = await Question.updateMany(
      { _id: { $in: ids } },
      { status: 'approved', editedByTeacher: true }
    );
    const questions = await Question.find({ _id: { $in: ids } });
    res.status(200).json({ success: true, approvedCount: result.modifiedCount || questions.length, questions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function rejectQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updated = await Question.findByIdAndUpdate(
      id,
      { status: 'rejected', editedByTeacher: true },
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.status(200).json({ ...updated.toObject(), id: String(updated._id), question: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
