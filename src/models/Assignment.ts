import mongoose, { Schema, Document } from 'mongoose';

export interface IRubricCriterion {
  criterion: string;
  marks: number;
  descriptor: string;
}

export interface IAssignment extends Document {
  lessonId?: mongoose.Types.ObjectId;
  sectionId?: mongoose.Types.ObjectId;
  title: string;
  subject: string;
  prompt: string;
  estimatedMinutes: number;
  rubric: IRubricCriterion[];
  status: 'draft' | 'approved' | 'rejected' | 'published';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RubricCriterionSchema = new Schema<IRubricCriterion>({
  criterion: { type: String, required: true },
  marks: { type: Number, required: true },
  descriptor: { type: String, required: true }
});

const AssignmentSchema = new Schema<IAssignment>(
  {
    lessonId: { type: Schema.Types.ObjectId, ref: 'Lesson', index: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    title: { type: String, default: 'Class Assignment' },
    subject: { type: String, default: 'General' },
    prompt: { type: String, required: true },
    estimatedMinutes: { type: Number, default: 20 },
    rubric: [RubricCriterionSchema],
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected', 'published'],
      default: 'approved'
    },
    dueDate: { type: Date }
  },
  { timestamps: true }
);

export const Assignment = mongoose.model<IAssignment>('Assignment', AssignmentSchema);

