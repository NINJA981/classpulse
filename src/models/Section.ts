import mongoose, { Schema, Document } from 'mongoose';

export interface ISection extends Document {
  name: string;
  courseName: string;
  institutionId?: mongoose.Types.ObjectId;
  teacherNames: string[];
  joinCode: string;
  joinCodeExpiresAt: Date;
  enrolledCount: number;
  enrolledRollNumbers: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    name: { type: String, required: true },
    courseName: { type: String, required: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution' },
    teacherNames: [{ type: String }],
    joinCode: { type: String, required: true, unique: true, index: true },
    joinCodeExpiresAt: { type: Date, required: true },
    enrolledCount: { type: Number, default: 0 },
    enrolledRollNumbers: [{ type: String }]
  },
  { timestamps: true }
);

export const Section = mongoose.model<ISection>('Section', SectionSchema);

