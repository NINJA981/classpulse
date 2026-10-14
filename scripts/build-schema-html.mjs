#!/usr/bin/env node
/**
 * Builds docs/agents/database-schema.html: an interactive, self-contained map of the ClassIQ database.
 *
 * Reads the schema from a live Postgres (the dev database, after `npm run db:migrate`), so it always matches
 * the migrations. Table groups and descriptions come from the HANDBOOK's database section (§11).
 *
 *   node scripts/build-schema-html.mjs                 # uses `docker exec classpulse-dev-postgres-1 psql …`
 *   PSQL="psql postgres://…" node scripts/build-schema-html.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs/agents/database-schema.html');
const psql = process.env.PSQL ?? 'docker exec -i classpulse-dev-postgres-1 psql -U classpulse -d classpulse';

const SQL = String.raw`
select json_build_object(
 'tables', (select json_agg(t order by t->>'name') from (
   select json_build_object(
     'name', c.relname,
     'columns', (select json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
         'nullable', not a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid)) order by a.attnum)
       from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
     'pk', (select json_agg(a.attname order by array_position(con.conkey, a.attnum)) from pg_constraint con
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey) where con.conrelid = c.oid and con.contype = 'p'),
     'fks', (select json_agg(json_build_object(
         'cols', (select json_agg(a.attname order by array_position(con.conkey, a.attnum)) from pg_attribute a where a.attrelid = con.conrelid and a.attnum = any(con.conkey)),
         'ref', (select relname from pg_class where oid = con.confrelid),
         'refCols', (select json_agg(a.attname order by array_position(con.confkey, a.attnum)) from pg_attribute a where a.attrelid = con.confrelid and a.attnum = any(con.confkey)),
         'onDelete', case con.confdeltype when 'c' then 'cascade' when 'n' then 'set null' when 'r' then 'restrict' when 'd' then 'set default' else 'no action' end))
       from pg_constraint con where con.conrelid = c.oid and con.contype = 'f'),
     'uniques', (select json_agg((select json_agg(a.attname order by array_position(con.conkey, a.attnum)) from pg_attribute a where a.attrelid = con.conrelid and a.attnum = any(con.conkey)))
       from pg_constraint con where con.conrelid = c.oid and con.contype = 'u'),
     'checks', (select json_agg(pg_get_constraintdef(con.oid)) from pg_constraint con where con.conrelid = c.oid and con.contype = 'c'),
     'indexes', (select json_agg(json_build_object('name', i.relname, 'unique', ix.indisunique, 'def', pg_get_indexdef(ix.indexrelid)))
       from pg_index ix join pg_class i on i.oid = ix.indexrelid where ix.indrelid = c.oid and not ix.indisprimary)
   ) t
   from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and c.relname not like '\_\_%'
 ) s),
 'enums', (select json_object_agg(t.typname, (select json_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid))
   from pg_type t join pg_namespace n on n.oid = t.typnamespace where t.typtype = 'e' and n.nspname = 'public'),
 'migrations', (select coalesce(json_agg(hash), '[]'::json) from drizzle.__drizzle_migrations)
);`;

const meta = JSON.parse(execSync(`${psql} -tA`, { input: SQL, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));

// Groups and one-line descriptions from the HANDBOOK's database table (§11).
const handbook = readFileSync(join(root, 'docs/agents/HANDBOOK.md'), 'utf8');
const section = handbook.slice(handbook.indexOf('## 11. The database'), handbook.indexOf('## 12.'));
const groups = [];
const info = {};
let group = '';
for (const line of section.split('\n')) {
  const m = line.match(/^\|\s*([^|]*?)\s*\|\s*(`[^|]+`)\s*\|\s*(.+?)\s*\|\s*$/);
  if (!m) continue;
  if (m[1]) group = m[1];
  if (!groups.includes(group)) groups.push(group);
  for (const name of m[2].match(/`([a-z0-9_]+)`/g) ?? []) {
    info[name.replaceAll('`', '')] = { group, description: m[3].replace(/\*\*/g, '') };
  }
}
for (const t of meta.tables) {
  const i = info[t.name] ?? { group: 'Other', description: '' };
  if (!groups.includes(i.group)) groups.push(i.group);
  Object.assign(t, i);
}

const data = {
  generated: new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
  migrations: meta.migrations.length,
  groups,
  tables: meta.tables,
  enums: meta.enums ?? {},
};

const html = readFileSync(join(root, 'scripts/schema-viz.template.html'), 'utf8').replace(
  '/*__DATA__*/null',
  JSON.stringify(data).replace(/</g, '\\u003c'),
);
writeFileSync(out, html);
console.log(`Wrote ${out}: ${data.tables.length} tables, ${Object.keys(data.enums).length} enums.`);
