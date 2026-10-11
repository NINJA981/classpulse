/**
 * Contract between the resources framework (queue, grounding, persistence) and the per-type generators.
 * Each generator turns the teacher's request + grounding text into validated structured content.
 */
import type { Language, ResourceContent, ResourceOptions, ResourceType } from '@classpulse/shared';

export interface GenerationContext {
  resourceId: string;
  institutionId: string;
  type: ResourceType;
  title: string;
  /** The teacher's request (typed or spoken). */
  prompt: string;
  language: Language;
  options: ResourceOptions;
  course: { title: string; level: string | null; board: string | null; subject: string | null } | null;
  units: { title: string; summary: string | null; objectives: string[] }[];
  /** Grounding: unit summaries + recorded lesson transcripts + teacher materials, already truncated. */
  groundingText: string;
  /** The school's quiz-writing model (model_settings.llmModel). */
  model: string;
}

export interface GenerationResult<T extends ResourceContent = ResourceContent> {
  content: T;
  meta?: Record<string, unknown>;
}

export type ResourceGenerator = (ctx: GenerationContext) => Promise<GenerationResult>;
