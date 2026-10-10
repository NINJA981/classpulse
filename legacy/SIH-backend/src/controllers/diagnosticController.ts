import { Request, Response } from 'express';
import { DiagnosticTest } from '../models/DiagnosticTest.js';

export async function submitDiagnostic(req: Request, res: Response): Promise<void> {
  try {
    const { studentId, rollNumber, subject, responses, identifiedGaps } = req.body;

    const totalQuestions = responses?.length || 0;
    const score = responses?.filter((r: any) => r.isCorrect).length || 0;

    const record = await DiagnosticTest.create({
      studentId: studentId || 'stu_001',
      rollNumber,
      subject: subject || 'General Science & Mathematics',
      score,
      totalQuestions,
      responses,
      identifiedGaps: identifiedGaps || []
    });

    res.status(201).json({
      success: true,
      diagnosticId: record._id,
      score,
      totalQuestions,
      identifiedGaps: record.identifiedGaps
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

export async function getDiagnosticResults(req: Request, res: Response): Promise<void> {
  try {
    const { studentId } = req.params;
    const record = await DiagnosticTest.findOne({ studentId }).sort({ completedAt: -1 });
    if (!record) {
      res.status(404).json({ error: 'No diagnostic record found for this student.' });
      return;
    }
    res.status(200).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

