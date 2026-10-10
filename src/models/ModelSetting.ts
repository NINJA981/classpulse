import mongoose, { Schema, Document } from 'mongoose';

export interface IModelSetting extends Document {
  key: string; // Singleton key: 'global_model_settings'
  asrProvider: string;
  asrModel: string;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  updatedAt: Date;
}

const ModelSettingSchema = new Schema<IModelSetting>(
  {
    key: { type: String, required: true, unique: true, default: 'global_model_settings' },
    asrProvider: { type: String, default: 'sarvam' },
    asrModel: { type: String, default: 'saaras:v3' },
    llmProvider: { type: String, default: 'openai' },
    llmModel: { type: String, default: 'gpt-4o-mini' },
    ttsProvider: { type: String, default: 'sarvam-bulbul-v3' }
  },
  { timestamps: true }
);

export const ModelSetting = mongoose.model<IModelSetting>('ModelSetting', ModelSettingSchema);
