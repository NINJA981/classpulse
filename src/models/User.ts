import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'teacher' | 'student' | 'guardian';
  rollNumber?: string;
  institutionId?: mongoose.Types.ObjectId;
  department?: string;
  guardianPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: { 
      type: String, 
      enum: ['admin', 'teacher', 'student', 'guardian'], 
      required: true 
    },
    rollNumber: { type: String, sparse: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution' },
    department: { type: String },
    guardianPhone: { type: String }
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);

