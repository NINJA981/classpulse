import mongoose, { Schema, Document } from 'mongoose';

export interface ITimetableSlot {
  time: string;
  subject: string;
  teacher?: string;
  room?: string;
  topic?: string;
}

export interface ITimetable extends Document {
  sectionName: string;
  sectionId?: mongoose.Types.ObjectId;
  schedule: Record<string, ITimetableSlot[]>;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableSchema = new Schema<ITimetable>(
  {
    sectionName: { type: String, required: true, unique: true, index: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    schedule: { type: Schema.Types.Mixed, required: true, default: {} }
  },
  { timestamps: true }
);

export const Timetable = mongoose.model<ITimetable>('Timetable', TimetableSchema);
