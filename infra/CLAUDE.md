# infra

Compose stacks, Caddy routers, Garage (S3) setup and backup/restore. Full guide: `docs/agents/deployment.md` (read the section you need; its headings are listed in `docs/agents/CLAUDE.md`).

| File | Used by |
|---|---|
| `docker-compose.dev.yml` | Local dev: Postgres, Redis, Garage (`npm run dev:infra`; compose project `classpulse-dev`) |
| `docker-compose.coolify.yml` + `Caddyfile.coolify` | **Production** on Coolify (the router service holds both public hosts) |
| `docker-compose.prod.yml` + `Caddyfile` | Plain single-VPS alternative with automatic TLS |
| `backup.sh`, `restore.sh`, `lib-docker.sh` | Nightly encrypted backups (systemd timer on the server), restore drills |
| `garage/` | `storage-init`: bucket, key and layout on every deploy |

## Production safety

- Values written `${VAR:?…}` in the Coolify compose are required. A deploy fails if they're missing from Coolify's Production env, so add new required vars to Coolify before you merge.
- Never rename the DB user or names, volumes, the `classpulse` bucket, compose project names or `/var/backups/classpulse`. They hold live data.
- Never print secret values from the server or Coolify. Check key names only.
- Deploys are manual (Coolify Redeploy). Outside class hours the site is down for 30–60 s.
