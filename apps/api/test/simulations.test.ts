/** /api/simulations: built-in catalog search, school links (allowlist, ownership, school isolation) and RBAC. */
import { describe, expect, it } from 'vitest';
import type { Simulation } from '@classiq/shared';
import { SIMULATION_CATALOG } from '../src/modules/resources/simulationCatalog.js';
import { simulationUrlProblem } from '../src/modules/resources/simulations.js';
import { anon, as, createInstitution, createUser, createWorld } from './helpers.js';

const link = {
  title: 'Unit circle explorer',
  url: 'https://www.geogebra.org/m/abc123',
  subject: 'Mathematics',
  description: 'Trig ratios',
};

describe('simulation catalog', () => {
  it('has unique ids and only PhET HTML5 URLs', () => {
    expect(SIMULATION_CATALOG.length).toBeGreaterThanOrEqual(40);
    expect(new Set(SIMULATION_CATALOG.map((s) => s.id)).size).toBe(SIMULATION_CATALOG.length);
    for (const s of SIMULATION_CATALOG) {
      expect(s.url).toMatch(
        /^https:\/\/phet\.colorado\.edu\/sims\/html\/([a-z0-9-]+)\/latest\/\1_all\.html$/,
      );
      expect(simulationUrlProblem(s.url)).toBeNull();
    }
  });

  it('searches by topic and filters by subject', async () => {
    const { teacher } = await createWorld();
    const ohm = await as(teacher).get('/api/simulations').query({ q: "ohm's law" });
    expect(ohm.status).toBe(200);
    expect((ohm.body as Simulation[]).map((s) => s.id)).toContain('phet:ohms-law');

    const acids = await as(teacher)
      .get('/api/simulations')
      .query({ q: 'acids and bases', subject: 'Chemistry' });
    expect((acids.body as Simulation[]).length).toBeGreaterThan(0);
    expect((acids.body as Simulation[]).every((s) => s.subject === 'Chemistry')).toBe(true);

    const bio = await as(teacher).get('/api/simulations').query({ subject: 'biology' });
    expect((bio.body as Simulation[]).map((s) => s.id)).toContain('phet:natural-selection');

    const none = await as(teacher).get('/api/simulations').query({ q: 'zzzz-no-such-topic' });
    expect(none.body).toEqual([]);
  });
});

describe('school simulation links', () => {
  it('adds a link, lists it first for the school, and lets only its creator delete it', async () => {
    const { teacher, otherTeacher } = await createWorld();
    const created = await as(teacher).post('/api/simulations/links').send(link);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      title: link.title,
      url: link.url,
      subject: 'Mathematics',
      source: 'school',
    });
    const id = (created.body as Simulation).id;

    const list = await as(otherTeacher).get('/api/simulations').query({ q: 'unit circle' });
    expect((list.body as Simulation[])[0]).toMatchObject({ id, source: 'school' });

    const forbidden = await as(otherTeacher).delete(`/api/simulations/links/${id}`);
    expect(forbidden.status).toBe(403);

    expect((await as(teacher).delete(`/api/simulations/links/${id}`)).status).toBe(204);
    expect((await as(teacher).delete(`/api/simulations/links/${id}`)).status).toBe(404);
    const after = await as(teacher).get('/api/simulations').query({ q: 'unit circle' });
    expect((after.body as Simulation[]).some((s) => s.id === id)).toBe(false);
  });

  it('enforces the https host allowlist and validates input', async () => {
    const { teacher } = await createWorld();
    const post = (body: object) => as(teacher).post('/api/simulations/links').send(body);
    expect((await post({ ...link, url: 'http://www.geogebra.org/m/abc' })).status).toBe(400);
    expect((await post({ ...link, url: 'https://evil.example.com/sim' })).status).toBe(400);
    expect((await post({ ...link, url: 'https://phet.colorado.edu.evil.com/x' })).status).toBe(400);
    expect((await post({ ...link, url: 'https://user:pw@www.desmos.com/calculator' })).status).toBe(400);
    expect((await post({ ...link, url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await post({ ...link, url: 'not a url' })).status).toBe(400);
    expect((await post({ ...link, title: '' })).status).toBe(400);
    for (const url of [
      'https://www.desmos.com/calculator/xyz',
      'https://ophysics.com/k1.html',
      'https://www.olabs.edu.in/?sub=1',
      'https://geogebra.org/m/q',
    ]) {
      expect((await post({ ...link, url })).status).toBe(201);
    }
  });

  it("does not show or delete another school's links", async () => {
    const { teacher } = await createWorld();
    const otherSchool = await createInstitution();
    const outsider = await createUser(otherSchool.id, 'teacher');
    const created = await as(teacher).post('/api/simulations/links').send(link);
    const id = (created.body as Simulation).id;

    const list = await as(outsider).get('/api/simulations');
    expect((list.body as Simulation[]).some((s) => s.id === id)).toBe(false);
    expect((list.body as Simulation[]).every((s) => s.source === 'catalog')).toBe(true);
    expect((await as(outsider).delete(`/api/simulations/links/${id}`)).status).toBe(404);
  });

  it('requires a signed-in teacher', async () => {
    const { admin, student } = await createWorld();
    expect((await anon().get('/api/simulations')).status).toBe(401);
    expect((await as(student).get('/api/simulations')).status).toBe(403);
    expect((await as(admin).get('/api/simulations')).status).toBe(403);
    expect((await as(student).post('/api/simulations/links').send(link)).status).toBe(403);
    expect((await anon().delete('/api/simulations/links/00000000-0000-0000-0000-000000000000')).status).toBe(
      401,
    );
  });

  it('rejects a malformed link id', async () => {
    const { teacher } = await createWorld();
    expect((await as(teacher).delete('/api/simulations/links/not-a-uuid')).status).toBe(400);
  });
});
