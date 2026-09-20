import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant {
  studentId: string;
  studentName: string;
  score: number;
  streak: number;
  answers: { questionIndex: number; selectedOption: number; isCorrect: boolean }[];
}

export interface IQuizSession extends Document {
  title: string;
  sectionId?: mongoose.Types.ObjectId;
  lessonId?: mongoose.Types.ObjectId;
  questionIds: mongoose.Types.ObjectId[];
  activeQuestionIndex: number;
  status: 'lobby' | 'in_progress' | 'ended';
  joinPin: string;
  participants: IParticipant[];
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema<IParticipant>({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  score: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  answers: [
    {
      questionIndex: { type: Number },
      selectedOption: { type: Number },
      isCorrect: { type: Boolean }
    }
  ]
});

const QuizSessionSchema = new Schema<IQuizSession>(
  {
    title: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson' },
    questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
    activeQuestionIndex: { type: Number, default: 0 },
    status: { type: String, enum: ['lobby', 'in_progress', 'ended'], default: 'lobby' },
    joinPin: { type: String, required: true, index: true },
    participants: [ParticipantSchema]
  },
  { timestamps: true }
);

export const QuizSession = mongoose.model<IQuizSession>('QuizSession', QuizSessionSchema);

