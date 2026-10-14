/** Student DTO queries shared by the admin students and sections modules. */
import { asc, sql, type SQL } from 'drizzle-orm';
import type { Student } from '@classiq/shared';
import type { DbOrTx } from '../../db/client.js';
import { enrollments, sections, users } from '../../db/schema/index.js';
import { inviteStatusSql } from '../auth/passwordTokens.js';

type Ref = { id: string; name: string };

const studentSectionsJson = sql<Ref[]>`coalesce((
  select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.name)
  from ${enrollments} e join ${sections} s on s.id = e.section_id
  where e.student_id = "users"."id"
), '[]'::json)`;

export async function findStudents(
  dbx: DbOrTx,
  where: SQL | undefined,
  page?: { limit: number; offset: number },
): Promise<Student[]> {
  const query = dbx
    .select({
      id: users.id,
      name: users.name,
      rollNumber: users.rollNumber,
      email: users.email,
      status: users.status,
      createdAt: users.createdAt,
      sections: studentSectionsJson,
      inviteStatus: inviteStatusSql,
    })
    .from(users)
    .where(where)
    .orderBy(asc(users.rollNumber), asc(users.name))
    .$dynamic();
  if (page) query.limit(page.limit).offset(page.offset);
  const rows = await query;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    rollNumber: r.rollNumber ?? '',
    email: r.email,
    status: r.status,
    sections: r.sections,
    inviteStatus: r.inviteStatus,
    createdAt: r.createdAt.toISOString(),
  }));
}
