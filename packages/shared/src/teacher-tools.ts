import { z } from 'zod';
import { Id, Language, text, type IsoDate } from './common.js';
import { Difficulty } from './lessons.js';

/* ----------------------------------------------------------------------------
 * Teacher tools: open curriculum, materials, AI-generated teaching resources
 * (lesson plans, worksheets, question papers, presentations), sharing,
 * simulations and voice prompts. Works for any level (school or college).
 * ------------------------------------------------------------------------- */

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'] as const;
export const BloomLevel = z.enum(BLOOM_LEVELS);
export type BloomLevel = z.infer<typeof BloomLevel>;

/* ---------------------------------- curriculum ---------------------------------- */

export const CourseInput = z.object({
  title: text(200),
  level: z.string().trim().max(80).optional(),
  board: z.string().trim().max(80).optional(),
  subject: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  sectionId: Id.nullable().optional(),
});
export type CourseInput = z.infer<typeof CourseInput>;

export const UnitInput = z.object({
  title: text(300),
  summary: z.string().trim().max(8000).optional(),
  objectives: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});
export type UnitInput = z.infer<typeof UnitInput>;

/** New order of a course's units (every unit id of the course, first to last). */
export const ReorderUnitsInput = z.object({ unitIds: z.array(Id).min(1).max(500) });
export type ReorderUnitsInput = z.infer<typeof ReorderUnitsInput>;

/** AI-drafted unit summary + objectives (POST /api/curriculum/units/:id/draft-summary); saved only when the teacher saves the unit. */
export interface UnitDraft {
  summary: string;
  objectives: string[];
}

export interface Unit {
  id: Id;
  courseId: Id;
  position: number;
  title: string;
  summary: string | null;
  objectives: string[];
}

export interface Course {
  id: Id;
  title: string;
  level: string | null;
  board: string | null;
  subject: string | null;
  description: string | null;
  section: { id: Id; name: string } | null;
  catalogKey: string | null;
  unitCount: number;
  createdBy: { id: Id; name: string } | null;
  createdAt: IsoDate;
}

export interface CourseDetail extends Course {
  units: Unit[];
}

/** Built-in syllabus starter lists (e.g. NCERT); importing creates a course + units for the school. */
export interface CatalogEntry {
  key: string;
  title: string;
  level: string;
  board: string;
  subject: string;
  units: string[];
}

/* ---------------------------------- materials ---------------------------------- */

export const MaterialKind = z.enum(['pdf', 'text', 'docx']);
export type MaterialKind = z.infer<typeof MaterialKind>;
export const MATERIAL_MAX_MB = 20;

export interface Material {
  id: Id;
  title: string;
  kind: MaterialKind;
  course: { id: Id; title: string } | null;
  unit: { id: Id; title: string } | null;
  sizeBytes: number | null;
  /** Characters of extracted text available for grounding. */
  textLength: number;
  createdAt: IsoDate;
}

/** Rename a material or (re)attach it to a course / unit (null detaches). */
export const UpdateMaterialInput = z.object({
  title: text(200).optional(),
  courseId: Id.nullable().optional(),
  unitId: Id.nullable().optional(),
});
export type UpdateMaterialInput = z.infer<typeof UpdateMaterialInput>;

/* ---------------------------------- resources ---------------------------------- */

export const RESOURCE_TYPES = ['lesson_plan', 'worksheet', 'question_paper', 'presentation'] as const;
export const ResourceType = z.enum(RESOURCE_TYPES);
export type ResourceType = z.infer<typeof ResourceType>;

export const ResourceStatus = z.enum(['queued', 'generating', 'ready', 'failed']);
export type ResourceStatus = z.infer<typeof ResourceStatus>;

export const LessonPlanOptions = z.object({
  durationMin: z.number().int().min(10).max(600).default(45),
  periods: z.number().int().min(1).max(20).default(1),
  pedagogy: z.string().trim().max(200).optional(),
});
export const WorksheetOptions = z.object({
  itemCount: z.number().int().min(1).max(60).default(10),
  difficulty: z.enum(['easy', 'medium', 'hard', 'mixed']).default('mixed'),
  itemTypes: z.array(z.enum(['mcq', 'short', 'long', 'fill_blank', 'true_false', 'match'])).min(1).default(['mcq', 'short', 'fill_blank']),
  includeAnswerKey: z.boolean().default(true),
});
export const QuestionPaperOptions = z.object({
  examName: z.string().trim().max(120).default('Unit Test'),
  maxMarks: z.number().int().min(5).max(200).default(40),
  durationMin: z.number().int().min(10).max(300).default(90),
  /** Section spec, e.g. [{name:'A', type:'mcq', count:10, marksEach:1}, …]. Empty = let the AI propose a standard pattern. */
  sections: z
    .array(
      z.object({
        name: z.string().trim().max(40),
        type: z.enum(['mcq', 'very_short', 'short', 'long', 'case_based', 'assertion_reason']),
        count: z.number().int().min(1).max(50),
        marksEach: z.number().min(0.5).max(20),
        internalChoice: z.boolean().default(false),
      }),
    )
    .max(8)
    .default([]),
  /** Target share of marks per Bloom level (0–100); empty = balanced. */
  bloomMix: z.partialRecord(BloomLevel, z.number().min(0).max(100)).default({}),
  difficultyMix: z.object({ easy: z.number().min(0).max(100), medium: z.number().min(0).max(100), hard: z.number().min(0).max(100) }).default({ easy: 30, medium: 50, hard: 20 }),
});
export const PresentationOptions = z.object({
  slideCount: z.number().int().min(3).max(40).default(10),
  includeSpeakerNotes: z.boolean().default(true),
  theme: z.enum(['light', 'dark', 'classic']).default('light'),
});

export const ResourceOptions = z.discriminatedUnion('type', [
  z.object({ type: z.literal('lesson_plan'), ...LessonPlanOptions.shape }),
  z.object({ type: z.literal('worksheet'), ...WorksheetOptions.shape }),
  z.object({ type: z.literal('question_paper'), ...QuestionPaperOptions.shape }),
  z.object({ type: z.literal('presentation'), ...PresentationOptions.shape }),
]);
export type ResourceOptions = z.infer<typeof ResourceOptions>;

export const GenerateResourceInput = z.object({
  title: z.string().trim().max(200).optional(),
  courseId: Id.optional(),
  unitIds: z.array(Id).max(20).default([]),
  lessonIds: z.array(Id).max(10).default([]),
  materialIds: z.array(Id).max(10).default([]),
  /** The teacher's request in their own words (typed or from a voice prompt). */
  prompt: z.string().trim().max(4000).default(''),
  /** Output language; English technical terms are kept in English. */
  language: Language.default('en-IN'),
  options: ResourceOptions,
});
export type GenerateResourceInput = z.infer<typeof GenerateResourceInput>;

/* content shapes (validated with zod on the server; edited by teachers) */

export const LessonPlanContent = z.object({
  overview: z.string(),
  level: z.string(),
  durationMin: z.number(),
  objectives: z.array(z.string()),
  prerequisites: z.array(z.string()),
  materials: z.array(z.string()),
  sections: z.array(
    z.object({ title: z.string(), durationMin: z.number(), activity: z.string(), teacherNotes: z.string(), studentTask: z.string() }),
  ),
  assessment: z.array(z.string()),
  homework: z.string(),
  differentiation: z.object({ support: z.string(), extension: z.string() }),
});
export type LessonPlanContent = z.infer<typeof LessonPlanContent>;

const ItemType = z.enum(['mcq', 'short', 'long', 'fill_blank', 'true_false', 'match']);
export const WorksheetContent = z.object({
  instructions: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      items: z.array(
        z.object({
          number: z.number(),
          type: ItemType,
          prompt: z.string(),
          options: z.array(z.string()),
          answer: z.string(),
          marks: z.number(),
        }),
      ),
    }),
  ),
});
export type WorksheetContent = z.infer<typeof WorksheetContent>;

export const PaperQuestion = z.object({
  number: z.number(),
  type: z.enum(['mcq', 'very_short', 'short', 'long', 'case_based', 'assertion_reason']),
  text: z.string(),
  options: z.array(z.string()),
  /** For MCQ: index into options; otherwise -1. */
  correctIndex: z.number(),
  marks: z.number(),
  bloomLevel: BloomLevel,
  competency: z.string(),
  difficulty: Difficulty,
  unit: z.string(),
  answer: z.string(),
  markingScheme: z.string(),
  /** "OR" alternative shown with internal choice; null if none. */
  alternative: z.object({ text: z.string(), answer: z.string(), markingScheme: z.string() }).nullable(),
});
export type PaperQuestion = z.infer<typeof PaperQuestion>;

export const QuestionPaperContent = z.object({
  header: z.object({
    examName: z.string(),
    subject: z.string(),
    level: z.string(),
    durationMin: z.number(),
    maxMarks: z.number(),
    generalInstructions: z.array(z.string()),
  }),
  sections: z.array(z.object({ name: z.string(), instructions: z.string(), questions: z.array(PaperQuestion) })),
});
export type QuestionPaperContent = z.infer<typeof QuestionPaperContent>;

export const PresentationContent = z.object({
  theme: z.enum(['light', 'dark', 'classic']),
  slides: z.array(
    z.object({
      layout: z.enum(['title', 'bullets', 'two_column', 'quote', 'summary']),
      title: z.string(),
      subtitle: z.string(),
      bullets: z.array(z.string()),
      rightBullets: z.array(z.string()),
      speakerNotes: z.string(),
    }),
  ),
});
export type PresentationContent = z.infer<typeof PresentationContent>;

export type ResourceContent = LessonPlanContent | WorksheetContent | QuestionPaperContent | PresentationContent;

export interface ResourceSummary {
  id: Id;
  type: ResourceType;
  title: string;
  status: ResourceStatus;
  course: { id: Id; title: string } | null;
  teacher: { id: Id; name: string };
  shared: boolean;
  language: Language;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface ResourceDetail extends ResourceSummary {
  prompt: string;
  unitIds: Id[];
  lessonIds: Id[];
  materialIds: Id[];
  options: ResourceOptions;
  content: ResourceContent | null;
  failureReason: string | null;
  /** True when the signed-in teacher owns it (others can only view/copy shared ones). */
  mine: boolean;
}

export const UpdateResourceInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  /** Teacher edits of the generated content (validated against the resource type's schema). */
  content: z.unknown().optional(),
});
export type UpdateResourceInput = z.infer<typeof UpdateResourceInput>;

export const ListResourcesQuery = z.object({
  type: ResourceType.optional(),
  scope: z.enum(['mine', 'shared']).default('mine'),
  courseId: Id.optional(),
  q: z.string().trim().max(120).optional(),
});
export type ListResourcesQuery = z.infer<typeof ListResourcesQuery>;

/* ---------------------------------- simulations ---------------------------------- */

export interface Simulation {
  id: string;
  title: string;
  subject: string;
  topics: string[];
  /** Embeddable URL (iframe). */
  url: string;
  source: 'catalog' | 'school';
  description: string | null;
  /** School links only: added by the signed-in teacher (only they can remove it). */
  mine?: boolean;
}

export const SimulationLinkInput = z.object({
  title: text(200),
  url: z.url().max(1000),
  subject: z.string().trim().max(120).optional(),
  description: z.string().trim().max(1000).optional(),
});
export type SimulationLinkInput = z.infer<typeof SimulationLinkInput>;

/* ---------------------------------- voice prompts ---------------------------------- */

/** POST /api/resources/voice (multipart `audio`, ≤ 60 s) → transcribed prompt text. */
export interface VoicePromptResult {
  text: string;
  languageCode: string | null;
}

/* ---------------------------------- competency insights ---------------------------------- */

export interface CompetencyInsightRow {
  student: { id: Id; name: string; rollNumber: string | null };
  /** Accuracy % per Bloom level (null = no questions answered at that level). */
  byBloom: Partial<Record<BloomLevel, number | null>>;
  /** Accuracy % per topic/competency tag. */
  byTopic: Record<string, number | null>;
  overallPct: number | null;
}

export interface SectionInsights {
  section: { id: Id; name: string };
  byBloom: Partial<Record<BloomLevel, number | null>>;
  byTopic: { topic: string; accuracyPct: number | null; answered: number }[];
  students: CompetencyInsightRow[];
}

/* ---------------------------------- question paper → exam ---------------------------------- */

/**
 * POST /api/resources/:id/publish-exam — creates a DRAFT secure exam from the paper's objective questions
 * (MCQ and assertion–reason with 4 options); other question types are skipped. The teacher then reviews
 * the window and security settings in the exam editor (/teacher/exams/:examId) and publishes.
 */
export const PublishPaperExamInput = z
  .object({
    sectionId: Id,
    title: z.string().trim().min(1).max(200).optional(),
    instructions: z.string().trim().max(5000).optional(),
    opensAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    durationMin: z.number().int().min(1).max(600),
    /** Defaults to every MCQ (capped at the MCQ count). */
    questionsPerStudent: z.number().int().min(1).max(200).optional(),
  })
  .refine((v) => Date.parse(v.closesAt) > Date.parse(v.opensAt), { path: ['closesAt'], message: 'The exam must close after it opens' });
export type PublishPaperExamInput = z.infer<typeof PublishPaperExamInput>;

export interface PublishPaperExamResult {
  examId: Id;
  /** Objective questions copied into the exam. */
  mcqCount: number;
  /** Questions left out (written-answer types, or objective ones without 4 valid options). */
  skipped: number;
}
