# Deployment (single VPS)

## Requirements

- A VPS with at least 2 vCPU, 4 GB RAM and 40 GB SSD, running Ubuntu 24.04 LTS.
- Docker Engine 27 or later with the compose plugin.
- `age`, for encrypting backups.
- DNS A records pointing two names at the VPS:
  - the school address, `DOMAIN` (for example `app.school.org`);
  - the platform console address, `PLATFORM_HOST` (for example `ops.school.org`).
- Ports 80 and 443 open to the internet. Keep everything else closed, apart from SSH restricted to your admin IPs.

## First deployment

```bash
sudo mkdir -p /opt/classpulse && sudo chown $USER /opt/classpulse
git clone <repo> /opt/classpulse && cd /opt/classpulse
cp infra/.env.example infra/.env
# Fill in DOMAIN, PLATFORM_HOST, ACME_EMAIL, POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET (openssl rand -base64 48),
# PLATFORM_ENCRYPTION_KEY (openssl rand -base64 32), SARVAM_API_KEY and/or OPENAI_API_KEY, BACKUP_AGE_RECIPIENT,
# and optionally SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (see "Email" below).
# (Speech-to-text provider is chosen per school in Admin → AI settings: Sarvam or OpenAI Whisper.)
chmod 600 infra/.env

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env ps
curl -fsS https://$DOMAIN/api/health/ready
```

The one-shot `migrate` service applies the database migrations before `api` and `worker` start.

`PLATFORM_ENCRYPTION_KEY` is mandatory. Compose refuses to start the stack without it, and the API refuses to start in production unless it decodes to exactly 32 bytes. It encrypts the super admins' authenticator secrets. **Back it up** (password manager, off the server). If it is lost or changed, every super admin has to enrol their authenticator again (see [Platform console](#platform-console)).

Caddy serves two sites:
- `DOMAIN` serves the school app and answers `404` for `/platform` and `/api/platform`.
- `PLATFORM_HOST` serves only the console. `/` redirects to `/platform`, and anything else is `404`, apart from the console's own assets.

The compose file derives `PLATFORM_ORIGIN` from `PLATFORM_HOST`.

### Create the first super admin

```bash
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env run --rm api \
  node dist/scripts/createSuperAdmin.js --email you@company.org --name "Your Name"
```

The command prints a one-time password. Sign in at `https://$PLATFORM_HOST/platform/login`, scan the QR code with an authenticator app, save the 10 recovery codes, then choose a new password. Schools and their first admins are then created from the console (Schools → New school).

### Create a school admin from the command line (alternative)

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
- The `api` service mounts the host's backup folder read-only at `/backups` (`${BACKUP_DIR:-/var/backups/classpulse}:/backups:ro`). The console's Health page uses it to report the age of the latest backup, and raises an alert when it is older than 26 hours. The API reads the folder from its own `BACKUP_DIR` variable, which defaults to `/backups`.

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
| Console | `https://$PLATFORM_HOST/platform`: Health (components, queues, alerts, 30-day history), Logs (warnings, errors and notable requests, kept 14 days), Audit log (kept 365 days), Usage & costs |

Point an uptime monitor (for example UptimeRobot) at `https://$DOMAIN/api/health/ready`.

**Background jobs.** The `worker` runs three BullMQ queues: `lesson-generation` (transcription and quiz writing), `email` (invitations, resets and reminders; 5 attempts per message) and `resources` (teacher AI tools). It also runs the periodic tasks: audio retention, device sweep, exam sweep, assignment reminders, log and audit retention, and the 5-minute health snapshot. Failed jobs can be retried from the console's Health page.

## Email

Email is optional. It sends set-password invitations, password-reset links and assignment reminders. It is on only when `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` are all set. Without it, admins hand out one-time passwords and "Forgot password?" sends nothing.

| Option | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` / `SMTP_PASS` | `MAIL_FROM` |
|---|---|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com` | `465` | the sending address and an **App password** (needs 2-Step Verification) | an address that account may send as |
| GoDaddy mailbox | `smtpout.secureserver.net` | `465` | the mailbox address and its password | `ClassPulse <mailbox@your-domain>` |

Send from a domain whose SPF record allows the server you use. The `benxsolutions.in` SPF record allows only GoDaddy's servers. Sending as `@benxsolutions.in` through Gmail would fail SPF and land in spam, or be rejected. Use the GoDaddy mailbox for `@benxsolutions.in`, or send from a Gmail address through Gmail.

## Platform console

The super admin console runs at `/platform` on `PLATFORM_HOST` only.

- **Accounts:** created only with `create-superadmin`, inside the `api` container (`node dist/scripts/createSuperAdmin.js --email … --name …`, or `npm run create-superadmin:prod -- --email … --name …`). Locally: `npm run create-superadmin -- --email … --name …`.
- **Sign-in:** password, then a 6-digit authenticator code (TOTP). The first sign-in enrols the authenticator and shows 10 single-use recovery codes. Sessions last 2 hours. Sign-in is limited to 5 attempts per 15 minutes.
- **Lost authenticator:** a recovery code still signs in (each works once). Generating new codes (Settings → My account) needs a current authenticator code, and there is no way to re-enrol an enrolled account. To move to a new device, delete the account in the DB shell (`DELETE FROM platform_admins WHERE email = '…';`) and create it again with `create-superadmin`. Nothing else references that row.
- **Lost or changed `PLATFORM_ENCRYPTION_KEY`:** stored authenticator secrets can no longer be read. Create each super admin again as above so they enrol a new authenticator.
- **Deployments page (optional):** set `COOLIFY_API_URL` (for example `http://<server>:8000/api/v1`), `COOLIFY_API_TOKEN` and `COOLIFY_APP_UUID` on the API. Create the token in Coolify → Keys & Tokens with **read** and **deploy** permissions only. Without these variables the page shows these setup steps instead. `docker-compose.prod.yml` does not pass them, so the page applies to Coolify deployments.

## Deploying on Coolify

Coolify is the alternative to running compose by hand. The pilot runs this way (see [Pilot domains](#pilot-domains)).

Coolify's Traefik terminates TLS. It forwards the domains to the internal `router` service, which runs Caddy with `infra/Caddyfile.coolify` baked into its image. `router` sends `/api` and `/socket.io` to the API and everything else to the web app. On the `PLATFORM_HOST` address it serves only the console. On every other address it answers `404` for `/platform` and `/api/platform`. The API runs the migrations itself before it starts.

1. **DNS:** create A records for the school domain and the console domain, both pointing at the server.
2. **Proxy timeouts:** in Coolify → Servers → Proxy, add these to the Traefik command, then restart the proxy. Traefik's default 60 s read timeout would cut off long lecture uploads.
   ```
   - '--entrypoints.https.transport.respondingTimeouts.readTimeout=600s'
   - '--entrypoints.https.transport.respondingTimeouts.writeTimeout=600s'
   - '--entrypoints.https.transport.respondingTimeouts.idleTimeout=600s'
   ```
3. **Create the resource:** New resource → Private repository (GitHub App) → this repo, branch `main` → build pack **Docker Compose**.
   - Base directory: `/`
   - Compose file: `/infra/docker-compose.coolify.yml`
4. **Domains:** give the `router` service both domains, comma-separated: `https://classpulse.example.org,https://ops.example.org`. No other service gets a domain.
5. **Environment variables:**

   | Variable | Value |
   |---|---|
   | `PUBLIC_ORIGIN` | the same `https://` URL as the domain |
   | `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | `openssl rand -hex 24` |
   | `JWT_SECRET` | `openssl rand -base64 48` |
   | `SARVAM_API_KEY`, `OPENAI_API_KEY` | your provider keys |
   | `GENERATION_CONCURRENCY` | defaults to 1; raise it on servers with more than 2 vCPU |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional email (invitations, password resets, assignment reminders). Gmail/Workspace or a GoDaddy mailbox; see [Email](#email) for the values and the SPF caveat. Without them, admins hand out one-time passwords |
   | `PLATFORM_ENCRYPTION_KEY` | **required**: `openssl rand -base64 32`. The deploy fails without it. It encrypts super admins' authenticator secrets; back it up off the server |
   | `PLATFORM_HOST` | the console's host name, without `https://` (for example `ops.example.org`). Read by `router`. Until it is set, `/platform` is `404` everywhere |
   | `PLATFORM_ORIGIN` | the console's `https://` URL (for example `https://ops.example.org`). Read by the API for its origin checks |
   | `COOLIFY_API_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID` | optional, for the console's Deployments page: `http://<server>:8000/api/v1`, a token with **read** and **deploy** permissions only, and the application UUID from its Coolify URL |

6. **Deploy.** The first build on a 2-vCPU ARM server takes about 10–15 minutes. Add swap first if the server has less than 8 GB of RAM.
7. **First super admin:** run this on the server, then sign in at `https://<PLATFORM_HOST>/platform/login` and create schools from the console.
   ```bash
   API=$(sudo docker ps -qf label=com.docker.compose.service=api -f label=com.docker.compose.project=<resource-uuid>)
   sudo docker exec -it $API node dist/scripts/createSuperAdmin.js --email you@company.org --name "Your Name"
   ```
   A school admin can still be created from the command line instead:
   ```bash
   sudo docker exec -it $API node dist/scripts/createAdmin.js --email principal@school.org --name "Principal" \
     --institution-name "Your School" --institution-code SCHOOL
   ```

**Updates.** Push to `main`; the GitHub App webhook redeploys. To roll back, use Coolify → Deployments → redeploy an earlier commit. Migrations only ever move forward, so roll back code only to commits that use the same schema.

**Backups.** Create `/etc/classpulse/backup.env` (root, mode 600) containing `COMPOSE_PROJECT=<resource-uuid>`, `BACKUP_DIR=/var/backups/classpulse` and `BACKUP_AGE_RECIPIENT=age1…`. Then add a root cron job:

```bash
30 2 * * * ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
```

`backup.sh` and `restore.sh` find the containers and the audio volume by their compose labels, so they keep working across redeploys. `/opt/classpulse` is a plain checkout of this repo, used only for these scripts.

The compose file mounts `/var/backups/classpulse` into the `api` service read-only at `/backups`, so the console's Health page can check backup age. Keep backups in that folder.

### Pilot domains

| Address | Purpose |
|---|---|
| `classpulse.benxsolutions.in` | The school app (`PUBLIC_ORIGIN`) |
| `ops.benxsolutions.in` | The platform console (`PLATFORM_HOST`, `PLATFORM_ORIGIN`) |
| `coolify.benxsolutions.in` | The Coolify dashboard |

All three are planned as A records to `129.159.227.74` at GoDaddy, the DNS host for `benxsolutions.in`. Until they exist, the pilot uses `classpulse.129.159.227.74.sslip.io` and `ops.129.159.227.74.sslip.io`. When switching, update the router's domains, `PUBLIC_ORIGIN`, `PLATFORM_HOST` and `PLATFORM_ORIGIN` together, then redeploy.

## Local production check

```bash
cp infra/.env.example infra/.env.local-prod   # DOMAIN=localhost, any secrets
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.local-prod up -d --build
curl -kfsS https://localhost/api/health/ready   # Caddy uses its internal CA for localhost
```
