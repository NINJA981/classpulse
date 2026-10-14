import type { ResourceType } from '@classiq/shared';
import type { ResourceGenerator } from './types.js';
import { generate as lessonPlan } from './lessonPlan.js';
import { generate as worksheet } from './worksheet.js';
import { generate as questionPaper } from './questionPaper.js';
import { generate as presentation } from './presentation.js';

const builtIn: Record<ResourceType, ResourceGenerator> = {
  lesson_plan: lessonPlan,
  worksheet,
  question_paper: questionPaper,
  presentation,
};

/** The registry the resource job dispatches through (looked up at call time, so tests can override entries). */
export const generators: Record<ResourceType, ResourceGenerator> = { ...builtIn };

/** Tests only: replace generators (e.g. with stubs); returns a function that restores the built-in ones. */
export function setGeneratorsForTests(overrides: Partial<Record<ResourceType, ResourceGenerator>>): () => void {
  Object.assign(generators, overrides);
  return () => {
    Object.assign(generators, builtIn);
  };
}
