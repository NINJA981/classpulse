import mongoose, { Schema, Document } from 'mongoose';

export interface IInstitution extends Document {
  name: string;
  code: string;
  emailDomains: string[];
  timezone: string;
  academicYear: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const InstitutionSchema = new Schema<IInstitution>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true, index: true },
    emailDomains: [{ type: String }],
    timezone: { type: String, default: 'Asia/Kolkata (IST, UTC+05:30)' },
    academicYear: { type: String, default: '2026-2027' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' }
  },
  { timestamps: true }
);

export const Institution = mongoose.model<IInstitution>('Institution', InstitutionSchema);

