# Deployment (single VPS)

## Requirements

- A VPS with at least 2 vCPU, 4 GB RAM and 40 GB SSD, running Ubuntu 24.04 LTS.
- Docker Engine 27 or later with the compose plugin.
- `age`, for encrypting backups.
- A DNS A record pointing your domain (for example `app.school.org`) at the VPS.
- Ports 80 and 443 open to the internet. Keep everything else closed, apart from SSH restricted to your admin IPs.

## First deployment

```bash
sudo mkdir -p /opt/classpulse && sudo chown $USER /opt/classpulse
git clone <repo> /opt/classpulse && cd /opt/classpulse
cp infra/.env.example infra/.env
# Fill in DOMAIN, ACME_EMAIL, POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET (openssl rand -base64 48),
# SARVAM_API_KEY, OPENAI_API_KEY, BACKUP_AGE_RECIPIENT
chmod 600 infra/.env

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env ps
curl -fsS https://$DOMAIN/api/health/ready
```

The one-shot `migrate` service applies the database migrations before `api` and `worker` start.

### Create the first administrator

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env run --rm api \
  node dist/scripts/createAdmin.js --email principal@school.org --name "Principal" \
  --institution-name "Your School" --institution-code SCHOOL
```

The command prints a one-time password. The admin must change it at first login. All other accounts (teachers and students) are created from the admin console.

## Updating

```bash
cd /opt/classpulse && git pull
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
```

Migrations run automatically. Live quiz rooms survive an API restart because their state is stored in Postgres. In-flight generation jobs are retried by BullMQ.

## Backups

```bash
age-keygen -o ~/classpulse-backup.key   # keep this OFF the server (password manager / offline)
# put the printed public key into BACKUP_AGE_RECIPIENT in infra/.env
sudo crontab -e
# 30 2 * * * /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
```

- Each backup archive holds a `pg_dump -Fc` of the database and a tarball of the stored audio, encrypted with age.
- The script keeps 7 daily and 4 weekly archives. If `BACKUP_S3_URI` is set, it also copies each archive off-site.

**Restore drill.** Do this before the pilot and then once a month, on a staging VM:

```bash
./infra/restore.sh /var/backups/classpulse/daily/classpulse-<stamp>.tar.age ~/classpulse-backup.key
curl -fsS https://$DOMAIN/api/health/ready
```

## Operations

| Task | Command |
|---|---|
| Logs | `docker compose -f infra/docker-compose.prod.yml logs -f api worker` (JSON; rotated 5 × 20 MB) |
| Health | `GET /api/health/live` (process) and `GET /api/health/ready` (DB, Redis, storage) |
| DB shell | `docker compose … exec postgres psql -U classpulse classpulse` |
| Restart a service | `docker compose … restart api` |

Point an uptime monitor (for example UptimeRobot) at `https://$DOMAIN/api/health/ready`.

## Local production check

```bash
cp infra/.env.example infra/.env.local-prod   # DOMAIN=localhost, any secrets
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.local-prod up -d --build
curl -kfsS https://localhost/api/health/ready   # Caddy uses its internal CA for localhost
```
