import mongoose, { Schema, Document } from 'mongoose';

export interface IDeviceSystemStats {
  cpuUsagePct?: number;
  memoryUsagePct?: number;
  diskFreeMb?: number;
  tempC?: number;
}

export interface IDevice extends Document {
  deviceId: string;
  name: string;
  classroomId: string;
  classroomName: string;
  apiKey: string;
  status: 'online' | 'offline' | 'recording';
  firmwareVersion: string;
  lastHeartbeat: Date;
  ipAddress?: string;
  currentSessionId?: string;
  systemStats?: IDeviceSystemStats;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<IDevice>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    classroomId: { type: String, required: true, index: true },
    classroomName: { type: String, required: true },
    apiKey: { type: String, required: true },
    status: {
      type: String,
      enum: ['online', 'offline', 'recording'],
      default: 'offline'
    },
    firmwareVersion: { type: String, default: '1.0.0' },
    lastHeartbeat: { type: Date, default: Date.now },
    ipAddress: { type: String },
    currentSessionId: { type: String },
    systemStats: {
      cpuUsagePct: { type: Number },
      memoryUsagePct: { type: Number },
      diskFreeMb: { type: Number },
      tempC: { type: Number }
    }
  },
  { timestamps: true }
);

export const Device = mongoose.model<IDevice>('Device', DeviceSchema);

