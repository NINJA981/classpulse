import { asc, sql, type SQL } from 'drizzle-orm';
import type { Teacher } from '@classiq/shared';
import type { DbOrTx } from '../../db/client.js';
import { sections, sectionTeachers, users } from '../../db/schema/index.js';
import { inviteStatusSql } from '../auth/passwordTokens.js';

type Ref = { id: string; name: string };

const teacherSectionsJson = sql<Ref[]>`coalesce((
  select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.name)
  from ${sectionTeachers} st join ${sections} s on s.id = st.section_id
  where st.teacher_id = "users"."id"
), '[]'::json)`;

export async function findTeachers(dbx: DbOrTx, where: SQL | undefined): Promise<Teacher[]> {
  const rows = await dbx
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      department: users.department,
      status: users.status,
      createdAt: users.createdAt,
      sections: teacherSectionsJson,
      inviteStatus: inviteStatusSql,
    })
    .from(users)
    .where(where)
    .orderBy(asc(users.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? '',
    department: r.department,
    status: r.status,
    sections: r.sections,
    inviteStatus: r.inviteStatus,
    createdAt: r.createdAt.toISOString(),
  }));
}
