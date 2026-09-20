import mongoose, { Schema, Document } from 'mongoose';

export type LessonStatus =
  | 'draft'
  | 'queued'
  | 'transcribing'
  | 'generating'
  | 'validating'
  | 'ready_for_review'
  | 'published'
  | 'failed';

export interface ILesson extends Document {
  teacherId: string;
  title: string;
  subject: string;
  className: string;
  sectionId?: mongoose.Types.ObjectId;
  sourceType?: 'audio' | 'document';
  sourceFile?: {
    path: string;
    mimeType: string;
    sizeBytes: number;
    durationSec?: number;
  };
  status: LessonStatus;
  failureReason?: string;
  language: string;
  // Pipeline integration (lecture-pipeline sidecar)
  pipelineSessionId?: string;
  summary?: string;
  keyTakeaways?: string[];
  transcriptSegments?: number;
  timings?: {
    startedAt: Date;
    elapsedSec: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const LessonSchema = new Schema<ILesson>(
  {
    teacherId: { type: String, default: 'tch_001', index: true },
    title: { type: String, required: true },
    subject: { type: String, required: true },
    className: { type: String, required: true },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section' },
    sourceType: { type: String, enum: ['audio', 'document'] },
    sourceFile: {
      path: { type: String },
      mimeType: { type: String },
      sizeBytes: { type: Number },
      durationSec: { type: Number }
    },
    status: {
      type: String,
      enum: [
        'draft',
        'queued',
        'transcribing',
        'generating',
        'validating',
        'ready_for_review',
        'published',
        'failed'
      ],
      default: 'draft'
    },
    failureReason: { type: String },
    language: { type: String, default: 'en' },
    // Pipeline integration
    pipelineSessionId: { type: String, index: true, sparse: true },
    summary: { type: String },
    keyTakeaways: [{ type: String }],
    transcriptSegments: { type: Number },
    timings: {
      startedAt: { type: Date },
      elapsedSec: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export const Lesson = mongoose.model<ILesson>('Lesson', LessonSchema);

