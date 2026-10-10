import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmissionResult {
  questionId: string;
  selectedOption?: number;
  isCorrect: boolean;
  correctIndex?: number;
  correctText?: string;
  explanation: string;
  explanationLocal?: string;
}

export interface IStudentSubmission extends Document {
  lessonId: mongoose.Types.ObjectId;
  lessonTitle: string;
  studentId?: string;
  studentName: string;
  rollNumber: string;
  correct: number;
  total: number;
  scorePct: number;
  idempotencyKey?: string;
  results: ISubmissionResult[];
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionResultSchema = new Schema<ISubmissionResult>(
  {
    questionId: { type: String, required: true },
    selectedOption: { type: Number },
    isCorrect: { type: Boolean, required: true },
    correctIndex: { type: Number },
    correctText: { type: String },
    explanation: { type: String, default: '' },
    explanationLocal: { type: String }
  },
  { _id: false }
);

const StudentSubmissionSchema = new Schema<IStudentSubmission>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    lessonTitle: { type: String, required: true },
    studentId: { type: String },
    studentName: { type: String, required: true },
    rollNumber: { type: String, required: true, index: true },
    correct: { type: Number, required: true },
    total: { type: Number, required: true },
    scorePct: { type: Number, required: true },
    idempotencyKey: { type: String, unique: true, sparse: true },
    results: [SubmissionResultSchema],
    submittedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Composite index for fast lookup of submissions per lesson and rollNumber
StudentSubmissionSchema.index({ lessonId: 1, submittedAt: -1 });
StudentSubmissionSchema.index({ lessonId: 1, rollNumber: 1 });

export const StudentSubmission = mongoose.model<IStudentSubmission>(
  'StudentSubmission',
  StudentSubmissionSchema
);
