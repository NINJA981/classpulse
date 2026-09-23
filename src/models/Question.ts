import mongoose, { Schema, Document } from 'mongoose';

export type QuestionType = 'mcq' | 'short' | 'truefalse';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionStatus = 'draft' | 'approved' | 'rejected';

export interface IQuestion extends Document {
  lessonId: mongoose.Types.ObjectId;
  sectionId?: mongoose.Types.ObjectId;
  type: QuestionType;
  stem: string;
  stemLocal?: string;
  options: string[];
  optionsLocal?: string[];
  correctIndex?: number;
  correctText?: string;
  correctTextLocal?: string;
  explanation: string;
  explanationLocal?: string;
  topicTag: string;
  difficulty: QuestionDifficulty;
  status: QuestionStatus;
  editedByTeacher: boolean;
  sourceCitation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    type: { type: String, enum: ['mcq', 'short', 'truefalse'], default: 'mcq' },
    stem: { type: String, required: true },
    stemLocal: { type: String },
    options: [{ type: String }],
    optionsLocal: [{ type: String }],
    correctIndex: { type: Number },
    correctText: { type: String },
    correctTextLocal: { type: String },
    explanation: { type: String, default: '' },
    explanationLocal: { type: String },
    topicTag: { type: String, default: 'General' },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'approved' },
    editedByTeacher: { type: Boolean, default: false },
    sourceCitation: { type: String }
  },
  { timestamps: true }
);

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema);

