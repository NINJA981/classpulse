/**
 * Bootstrap a platform (super admin) account — the only way to create one:
 *
 *   npm run create-superadmin -- --email you@company.in --name "Your Name"
 *
 * Prints a one-time password that must be changed at first sign-in; the authenticator app is
 * enrolled on that first sign-in at /platform/login. Needs PLATFORM_ENCRYPTION_KEY to sign in.
 */
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { closeDb, db } from '../db/client.js';
import { platformAdmins } from '../db/schema/index.js';
import { generateInitialPassword, hashPassword } from '../lib/crypto.js';
import { secretBoxReady } from '../lib/secretBox.js';

const USAGE = 'Usage: npm run create-superadmin -- --email <email> --name <name>';

const Args = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(1).max(120),
});

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
    strict: true,
  });
  const parsed = Args.safeParse(values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    console.error(USAGE);
    return 1;
  }
  const args = parsed.data;

  const existing = await db.query.platformAdmins.findFirst({ where: eq(platformAdmins.email, args.email), columns: { id: true } });
  if (existing) {
    console.error(`A platform admin with email ${args.email} already exists. Nothing was changed.`);
    return 1;
  }

  const initialPassword = generateInitialPassword();
  await db.insert(platformAdmins).values({
    email: args.email,
    name: args.name,
    passwordHash: await hashPassword(initialPassword),
    mustChangePassword: true,
  });

  console.log(`Created platform admin ${args.email}.`);
  console.log(`Initial password (shown once — it must be changed at first sign-in): ${initialPassword}`);
  console.log('Sign in at /platform/login and scan the QR code with your authenticator app.');
  if (!secretBoxReady()) {
    console.warn('Warning: PLATFORM_ENCRYPTION_KEY is not set (openssl rand -base64 32); sign-in will be refused until it is.');
  }
  return 0;
}

let exitCode = 1;
try {
  exitCode = await main();
} catch (err) {
  console.error('create-superadmin failed:', err instanceof Error ? err.message : err);
} finally {
  await closeDb();
}
process.exit(exitCode);
