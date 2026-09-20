import mongoose, { Schema, Document } from 'mongoose';

export interface IDiagnosticResponse {
  questionId: string;
  selectedOption: number;
  confidenceRating: number;
  isCorrect: boolean;
}

export interface IDiagnosticTest extends Document {
  studentId: string;
  rollNumber?: string;
  subject: string;
  score: number;
  totalQuestions: number;
  responses: IDiagnosticResponse[];
  identifiedGaps: string[];
  completedAt: Date;
}

const DiagnosticResponseSchema = new Schema<IDiagnosticResponse>({
  questionId: { type: String, required: true },
  selectedOption: { type: Number, required: true },
  confidenceRating: { type: Number, min: 1, max: 5, default: 3 },
  isCorrect: { type: Boolean, required: true }
});

const DiagnosticTestSchema = new Schema<IDiagnosticTest>(
  {
    studentId: { type: String, required: true, index: true },
    rollNumber: { type: String },
    subject: { type: String, default: 'General Science & Mathematics' },
    score: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    responses: [DiagnosticResponseSchema],
    identifiedGaps: [{ type: String }],
    completedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const DiagnosticTest = mongoose.model<IDiagnosticTest>('DiagnosticTest', DiagnosticTestSchema);

