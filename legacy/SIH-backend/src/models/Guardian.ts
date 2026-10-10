import mongoose, { Schema, Document } from 'mongoose';

export interface IGuardian extends Document {
  studentId: string;
  studentRollNumber?: string;
  name: string;
  relation: string;
  phone: string;
  email?: string;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GuardianSchema = new Schema<IGuardian>(
  {
    studentId: { type: String, required: true, index: true },
    studentRollNumber: { type: String, index: true },
    name: { type: String, required: true },
    relation: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    verified: { type: Boolean, default: false }
  },
  { timestamps: true }
);

GuardianSchema.index({ studentId: 1, phone: 1 }, { unique: true });

export const Guardian = mongoose.model<IGuardian>('Guardian', GuardianSchema);
