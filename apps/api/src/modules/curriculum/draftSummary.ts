/**
 * AI draft of a unit's summary and learning objectives from its title, the course context and the
 * teacher's materials attached to that unit (or, failing that, to the course). Returned for the teacher
 * to edit — nothing is saved here.
 */
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_MODEL_SETTINGS, type SessionUser, type UnitDraft } from '@classpulse/shared';
import { db } from '../../db/client.js';
import { modelSettings, teacherMaterials } from '../../db/schema/index.js';
import { AppError } from '../../lib/errors.js';
import { isPipelineError } from '../../pipeline/errors.js';
import { arr, demoMode, generateStructured, obj, str } from '../resources/generators/common.js';
import { fitSources } from '../resources/grounding.js';
import { getSchoolUnit } from './service.js';

const MATERIAL_BUDGET = 30_000;

const DraftOut = z.object({
  summary: z.string().trim().min(1).max(4000),
  objectives: z.array(z.string().trim().min(1).max(300)).min(2).max(10),
});

export async function draftUnitSummary(user: SessionUser, unitId: string): Promise<UnitDraft> {
  const { unit, course } = await getSchoolUnit(user, unitId);
  if (demoMode()) {
    return { summary: `[Demo] What students learn in "${unit.title}".`, objectives: [`[Demo] Explain ${unit.title}`, '[Demo] Solve basic problems'] };
  }
  const [materials, settings] = await Promise.all([
    db
      .select({ title: teacherMaterials.title, text: teacherMaterials.textContent, unitId: teacherMaterials.unitId })
      .from(teacherMaterials)
      .where(
        and(
          eq(teacherMaterials.teacherId, user.id),
          or(eq(teacherMaterials.unitId, unit.id), and(eq(teacherMaterials.courseId, course.id), isNull(teacherMaterials.unitId))),
        ),
      )
      .orderBy(desc(teacherMaterials.createdAt))
      .limit(5),
    db.query.modelSettings.findFirst({ where: eq(modelSettings.institutionId, user.institutionId) }),
  ]);
  // Prefer materials attached to this unit; use course-level ones only when the unit has none.
  const own = materials.filter((m) => m.unitId === unit.id);
  const grounding = fitSources(
    (own.length ? own : materials).map((m) => ({ header: `## Teacher material: ${m.title}`, body: m.text })),
    MATERIAL_BUDGET,
  );

  const context = [
    `COURSE: ${course.title}`,
    course.level ? `Level: ${course.level}` : '',
    course.board ? `Board / university: ${course.board}` : '',
    course.subject ? `Subject: ${course.subject}` : '',
    course.description ? `Course description: ${course.description}` : '',
    `UNIT: ${unit.title}`,
    grounding ? `\nSOURCE MATERIAL:\n${grounding}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const result = await generateStructured({
      model: settings?.llmModel ?? DEFAULT_MODEL_SETTINGS.llmModel,
      messages: [
        {
          role: 'system',
          content:
            'You help teachers in India describe a unit of their syllabus. Write, in English, a concise summary (80–150 words) of what the unit covers ' +
            '(key concepts, skills, typical examples) pitched at the course level, and 3–6 measurable learning objectives ("Students will be able to …"). ' +
            (grounding
              ? 'Base it on the SOURCE MATERIAL; do not add topics it does not cover.'
              : 'Use the standard content of this unit for this course and level; do not invent unusual topics.') +
            ' Return JSON only.',
        },
        { role: 'user', content: context },
      ],
      schemaName: 'unit_summary',
      jsonSchema: obj({ summary: str, objectives: arr(str) }),
      zod: DraftOut,
      maxTokens: 1_500,
      invalidMessage: 'The AI returned an invalid summary. Please try again.',
      usage: { institutionId: user.institutionId, kind: 'resource' },
    });
    return result.value;
  } catch (err) {
    if (isPipelineError(err)) throw new AppError('UPSTREAM_FAILED', err.userMessage);
    throw err;
  }
}
