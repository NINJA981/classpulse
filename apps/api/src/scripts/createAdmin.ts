/**
 * Bootstrap an admin account (works in production):
 *
 *   npm run create-admin -- --email admin@school.in --name "Priya Rao" \
 *     --institution-name "Sunrise Public School" --institution-code SUNRISE [--timezone Asia/Kolkata]
 *
 * Creates the institution if the code does not exist yet, then an admin with a
 * generated password that must be changed at first login. The password is printed once.
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { InstitutionInput } from '@classpulse/shared';
import { closeDb, db } from '../db/client.js';
import { institutions, users } from '../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../lib/crypto.js';

const USAGE =
  'Usage: npm run create-admin -- --email <email> --name <name> --institution-code <CODE> [--institution-name <name>] [--timezone <IANA tz>]';

const Args = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(1).max(120),
  institutionCode: InstitutionInput.shape.code,
  institutionName: z.string().trim().min(1).max(200).optional(),
  timezone: z.string().trim().min(1).max(64).default('Asia/Kolkata'),
});

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      'institution-name': { type: 'string' },
      'institution-code': { type: 'string' },
      timezone: { type: 'string' },
    },
    strict: true,
  });
  const parsed = Args.safeParse({
    email: values.email,
    name: values.name,
    institutionCode: values['institution-code'],
    institutionName: values['institution-name'],
    timezone: values.timezone,
  });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    console.error(USAGE);
    return 1;
  }
  const args = parsed.data;

  const existingUser = await db.query.users.findFirst({ where: eq(users.email, args.email), columns: { id: true } });
  if (existingUser) {
    console.error(`A user with email ${args.email} already exists. Nothing was changed.`);
    return 1;
  }

  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);

  const { institution, created } = await db.transaction(async (tx) => {
    const found = await tx.query.institutions.findFirst({ where: eq(institutions.code, args.institutionCode) });
    let inst = found;
    if (!inst) {
      if (!args.institutionName) throw new Error(`Institution ${args.institutionCode} does not exist; pass --institution-name to create it`);
      [inst] = await tx
        .insert(institutions)
        .values({ name: args.institutionName, code: args.institutionCode, timezone: args.timezone })
        .returning();
    }
    await tx.insert(users).values({
      institutionId: inst!.id,
      role: 'admin',
      name: args.name,
      email: args.email,
      passwordHash,
      mustChangePassword: true,
    });
    return { institution: inst!, created: !found };
  });

  console.log(
    created
      ? `Created institution "${institution.name}" (${institution.code}).`
      : `Using existing institution "${institution.name}" (${institution.code}).`,
  );
  console.log(`Created admin ${args.email}.`);
  console.log(`Initial password (shown once — it must be changed at first sign-in): ${initialPassword}`);
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  console.error('create-admin failed:', err instanceof Error ? err.message : err);
} finally {
  await closeDb();
}
process.exit(exitCode);
