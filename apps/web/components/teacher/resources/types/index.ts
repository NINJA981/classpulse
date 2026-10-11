import type { ComponentType } from 'react';
import type { ResourceContent, ResourceDetail, ResourceType } from '@classpulse/shared';
import * as lessonPlan from './lesson-plan';
import * as worksheet from './worksheet';
import * as questionPaper from './question-paper';
import * as presentation from './presentation';

/**
 * Viewer contract (the resource page and the print page render every type through this):
 * - `resource.content` is the content to show — on the resource page it is the teacher's unsaved draft.
 * - `editable`: show inline editing controls and call `onChange(nextContent)` with the FULL updated content
 *   object; the page keeps the draft and its "Save edits" button PATCHes it (validated by the type's zod schema).
 * - `mode: 'print'`: the clean print layout (/teacher/resources/[id]/print): static text only, no inputs or
 *   buttons, use `print:` utilities such as `break-inside-avoid` / `break-before-page`.
 * - `showAnswers`: include answers / answer key / marking scheme (the print page lets the teacher turn it off
 *   to print a student copy). Defaults to true.
 */
export interface ViewerProps {
  resource: ResourceDetail;
  editable?: boolean;
  onChange?: (content: ResourceContent) => void;
  mode?: 'screen' | 'print';
  showAnswers?: boolean;
}

/** Generate-form options: `value` is the current options object of this type; call onChange with a FULL ResourceOptions object. */
export interface OptionsFieldsProps {
  value: unknown;
  onChange: (value: unknown) => void;
}

export interface ResourceTypeUi {
  Viewer: ComponentType<ViewerProps>;
  OptionsFields: ComponentType<OptionsFieldsProps>;
}

/** Per-type UI: Viewer (read/edit/print) and OptionsFields (generate form). */
export const resourceUi: Record<ResourceType, ResourceTypeUi> = {
  lesson_plan: lessonPlan,
  worksheet,
  question_paper: questionPaper,
  presentation,
};
