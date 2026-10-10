/** Fixtures shared by the live-quiz REST and socket tests. */
import { db } from '../src/db/client.js';
import { lessons, questions } from '../src/db/schema/index.js';
import type { createWorld } from './helpers.js';

type World = Awaited<ReturnType<typeof createWorld>>;

/** Correct option for question i is `i % 4`. */
export const correctFor = (i: number) => i % 4;

export async function publishedLesson(
  world: World,
  opts: { questionCount?: number; status?: 'published' | 'ready_for_review'; approved?: boolean } = {},
) {
  const [lesson] = await db
    .insert(lessons)
    .values({
      institutionId: world.institution.id,
      teacherId: world.teacher.id,
      sectionId: world.section.id,
      title: 'Photosynthesis',
      subject: 'Biology',
      status: opts.status ?? 'published',
      publishedAt: new Date(),
    })
    .returning();
  const count = opts.questionCount ?? 3;
  const qs = [];
  for (let i = 0; i < count; i++) {
    const [q] = await db
      .insert(questions)
      .values({
        lessonId: lesson!.id,
        position: i,
        stem: `Question ${i + 1}?`,
        options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
        correctIndex: correctFor(i),
        explanation: `Because ${i}`,
        status: opts.approved === false ? 'draft' : 'approved',
      })
      .returning();
    qs.push(q!);
  }
  return { lesson: lesson!, questions: qs };
}
