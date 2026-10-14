# ClassIQ

AI classroom platform: a Raspberry Pi records lectures → transcription (Sarvam) → bilingual quizzes, exams, assignments and teacher tools. Formerly ClassPulse. The remaining `classpulse` identifiers (domain, DB names, bucket, host paths, systemd units, salt, export ids, storage keys) are intentional; don't rename them (list in HANDBOOK §1.4).

## Where to start

Each area has its own short `CLAUDE.md`, loaded when you work there. Open the one for your task and nothing wider.

| Task | Start at |
|---|---|
| API route, service, DB, jobs, AI pipeline | `apps/api/CLAUDE.md` |
| Web pages, components, landing page, e2e | `apps/web/CLAUDE.md` |
| Shared DTOs and zod schemas | `packages/shared/CLAUDE.md` |
| Raspberry Pi recorder | `apps/classroom-agent/CLAUDE.md` |
| Docker, Caddy, Coolify, backups, production | `infra/CLAUDE.md` |
| Finding a fact in the docs | `docs/agents/CLAUDE.md` (a map with sizes; never read HANDBOOK whole) |
| Decks, PDFs, tours (`docs/humans`) | `docs/humans/CLAUDE.md` |
| Brand, legal, ops scripts, STT research, trailer | `workspace/README.md` (this machine only, git-ignored) |

## Commands

```bash
npm run dev:infra        # Postgres, Redis, Garage in Docker
npm run dev              # shared + api :5000 + worker + web :3000
npm run lint && npm run typecheck
npm test -w @classiq/api -- test/<file>.test.ts   # one file while iterating (the full suite takes ~8 min)
npm run test:agent       # Pi agent (pytest)
npm run test:e2e         # Playwright (needs `npm run dev`)
```

## Spending tokens well

- Search narrowly: give Grep a `path` and a `glob` or `type`, use `files_with_matches` first, then read only the hits. Read big files with `offset`/`limit`.
- The `.ignore` file and git ignores keep generated output, the lockfile, migration snapshots, `.agents/` and `workspace/` out of Grep and Glob. Don't pass `--no-ignore` or open those paths unless the task is about them.
- Don't open binaries (PDF, PPTX, MP4, audio), `node_modules`, `dist`, `.next` or `package-lock.json`. Look at a screenshot only when the task needs a visual check.
- Look facts up in `docs/agents/` before crawling the code. For a sweep across many files, use an Explore subagent and keep only its conclusion.
- Run the narrowest check that proves the change (one test file, one workspace typecheck). Run the full gates before a PR.

## Shared machine

- Several Claude sessions share this working tree and the dev stack. Before starting `npm run dev`, check whether :3000 and :5000 already answer, and never restart a dev server you didn't start. Give your API test run its own `TEST_DATABASE_URL` (e.g. `…/classpulse_test_<you>`) when another session may be testing.
- Don't commit someone else's uncommitted work. For a PR, branch from `origin/main` in a worktree under your scratchpad, not in `X:\Projects`.
- ClassIQ material that isn't code lives in `workspace/`. Never create new ClassIQ folders in `X:\Projects`.

## Git and deploy

- `main` is protected: branch, `gh pr create`, then `gh pr merge --squash --auto`. Unset `GITHUB_TOKEN` first so `gh` uses the keyring login. Push over HTTPS (SSH push is denied here).
- Never commit `docs/agents/security-audit-*.md` (private).
- Production is Coolify on an Oracle Cloud ARM server (`infra/docker-compose.coolify.yml`). Merging does not deploy; Redeploy is manual.
- Public copy says "classrooms" or "institutions", never only "schools".
- `.agents/` is a Google Antigravity toolkit, not Claude Code configuration. Ignore it.
