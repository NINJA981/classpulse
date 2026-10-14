/**
 * Simulations for teachers, mounted at /api/simulations (teacher role).
 *   GET    /?q=&subject=   built-in PhET catalog + the school's own links (search by title/subject/topic)
 *   POST   /links          add a school link (SimulationLinkInput); https only, allow-listed hosts
 *   DELETE /links/:id      remove a school link (only the teacher who added it)
 */
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { IdParams, SimulationLinkInput, type SessionUser, type Simulation } from '@classiq/shared';
import { db } from '../../db/client.js';
import { simulationLinks } from '../../db/schema/index.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { authenticate, currentUser, requireRole } from '../../middleware/auth.js';
import { parseBody, parseParams, parseQuery } from '../../middleware/validate.js';
import { matchesQuery, matchesSubject, searchCatalog } from './simulationCatalog.js';

/** Hosts whose pages may be embedded in class (exact host match). A per-school list can extend this later. */
export const SIMULATION_HOST_ALLOWLIST: readonly string[] = [
  'phet.colorado.edu',
  'www.geogebra.org',
  'geogebra.org',
  'www.desmos.com',
  'ophysics.com',
  'www.olabs.edu.in',
];

/** Returns the reason a URL cannot be added, or null when it is allowed. */
export function simulationUrlProblem(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Enter a valid web address';
  }
  if (url.protocol !== 'https:') return 'Only secure (https://) links can be added';
  if (url.username || url.password) return 'Links with a username or password are not allowed';
  if (url.port) return 'Links with a custom port are not allowed';
  if (!SIMULATION_HOST_ALLOWLIST.includes(url.hostname.toLowerCase())) {
    return `Links must be from one of: ${SIMULATION_HOST_ALLOWLIST.join(', ')}`;
  }
  return null;
}

const ListSimulationsQuery = z.object({
  q: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(120).optional(),
});

type LinkRow = typeof simulationLinks.$inferSelect;
const toSimulation = (r: LinkRow, userId: string): Simulation => ({
  id: r.id,
  title: r.title,
  subject: r.subject ?? 'Other',
  topics: [],
  url: r.url,
  source: 'school',
  description: r.description,
  mine: r.createdBy === userId,
});

async function listSimulations(user: SessionUser, q?: string, subject?: string): Promise<Simulation[]> {
  const rows = await db
    .select()
    .from(simulationLinks)
    .where(eq(simulationLinks.institutionId, user.institutionId))
    .orderBy(desc(simulationLinks.createdAt));
  const school = rows.map((r) => toSimulation(r, user.id)).filter((s) => matchesSubject(s, subject) && matchesQuery(s, q));
  return [...school, ...searchCatalog(q, subject)];
}

async function addLink(user: SessionUser, input: SimulationLinkInput): Promise<Simulation> {
  const problem = simulationUrlProblem(input.url);
  if (problem) throw badRequest(problem, [{ path: 'url', message: problem }]);
  const [row] = await db
    .insert(simulationLinks)
    .values({
      institutionId: user.institutionId,
      createdBy: user.id,
      title: input.title,
      url: new URL(input.url).toString(),
      subject: input.subject || null,
      description: input.description || null,
    })
    .returning();
  return toSimulation(row!, user.id);
}

async function deleteLink(user: SessionUser, id: string): Promise<void> {
  const [row] = await db
    .select({ createdBy: simulationLinks.createdBy })
    .from(simulationLinks)
    .where(and(eq(simulationLinks.id, id), eq(simulationLinks.institutionId, user.institutionId)));
  if (!row) throw notFound('Simulation link');
  if (row.createdBy !== user.id) throw forbidden('Only the teacher who added this link can remove it');
  await db.delete(simulationLinks).where(eq(simulationLinks.id, id));
}

export const simulationsRouter = Router();
simulationsRouter.use(authenticate(), requireRole('teacher'));

simulationsRouter.get('/', async (req, res) => {
  const { q, subject } = parseQuery(req, ListSimulationsQuery);
  res.json(await listSimulations(currentUser(req), q, subject));
});

simulationsRouter.post('/links', async (req, res) => {
  const input = parseBody(req, SimulationLinkInput);
  res.status(201).json(await addLink(currentUser(req), input));
});

simulationsRouter.delete('/links/:id', async (req, res) => {
  const { id } = parseParams(req, IdParams);
  await deleteLink(currentUser(req), id);
  res.status(204).end();
});
