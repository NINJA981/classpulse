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

**The pilot** sends from the GoDaddy mailbox `admin@benxsolutions.in` through `smtpout.secureserver.net:465` (SSL), with `MAIL_FROM` set to `ClassPulse <admin@benxsolutions.in>`. When the mailbox password changes, update `SMTP_PASS` and redeploy.

GoDaddy mailboxes cap outgoing mail at roughly 250–300 messages a day (it depends on the plan). A large student import with emailed invitations can exceed that; failed sends stay in the `email` queue and can be retried from the console's Health page. For higher volume, use a sending service such as Amazon SES or Brevo.

## Platform console

The super admin console runs at `/platform` on `PLATFORM_HOST` only.

- **Accounts:** created only with `create-superadmin`, inside the `api` container (`node dist/scripts/createSuperAdmin.js --email … --name …`, or `npm run create-superadmin:prod -- --email … --name …`). Locally: `npm run create-superadmin -- --email … --name …`.
- **Sign-in:** at `/platform/login` ("Super admin sign in"): password, then a 6-digit authenticator code (TOTP). The first sign-in enrols the authenticator, shows 10 single-use recovery codes, and requires a new password. Sessions last 2 hours. Each sign-in step is limited to 5 attempts per 15 minutes, keyed by IP and email for the password step and by IP alone for the code steps, so users behind the same address share the code-step limit. A locked-out user waits 15 minutes.
- **Lost authenticator:** a recovery code still signs in (each works once). Generating new codes (Settings → My account) needs a current authenticator code, and there is no way to re-enrol an enrolled account. To move to a new device, delete the account in the DB shell (`DELETE FROM platform_admins WHERE email = '…';`) and create it again with `create-superadmin`. Nothing else references that row.
- **Lost or changed `PLATFORM_ENCRYPTION_KEY`:** stored authenticator secrets can no longer be read. Create each super admin again as above so they enrol a new authenticator.
- **Deployments page (optional):** set `COOLIFY_API_URL`, `COOLIFY_API_TOKEN` and `COOLIFY_APP_UUID` on the API. Without these variables the page shows these setup steps instead. `docker-compose.prod.yml` does not pass them, so the page applies to Coolify deployments.
  - **URL:** use the server's private address, for example `http://10.0.0.112:8000/api/v1`, so the calls stay inside the server's network and keep working after public port 8000 is closed.
  - **Token:** create it in Coolify → Keys & Tokens with **read** and **deploy** permissions only. Coolify hides build logs from tokens without **read:sensitive**; the page then says the log is hidden, and it can be read in Coolify. Adding read:sensitive is optional. **Restart** is expected to work with deploy; if Coolify answers with a permission error, add **write**.
  - **Allow-list:** Coolify → Settings → "Allowed IPs for API access" must include the Docker network range (for example `10.0.0.0/16`), because the API container calls Coolify from an internal address such as `10.0.5.5`. Any other caller, such as an admin's machine deploying through the public HTTPS URL, also needs its IP on the list.

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
3. **Create the resource:** New resource → Private repository (GitHub App, or a read-only deploy key as the pilot uses) → this repo, branch `main` → build pack **Docker Compose**.
   - Base directory: `/`
   - Compose file: `/infra/docker-compose.coolify.yml`
4. **Domains:** give the `router` service both domains, comma-separated: `https://classpulse.example.org,https://ops.example.org`. No other service gets a domain.
5. **Environment variables:** enter them in the resource's **Production** section. Values under "Preview Deployments" are not used by the production containers (on the pilot, email stayed off until the SMTP values were moved). Redeploy after any change.

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
   | `COOLIFY_API_URL`, `COOLIFY_API_TOKEN`, `COOLIFY_APP_UUID` | optional, for the console's Deployments page: `http://<server-private-ip>:8000/api/v1`, a token with **read** and **deploy** permissions only, and the application UUID from its Coolify URL. Also allow the Docker network range in Coolify's API allow-list (see [Platform console](#platform-console)) |

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

**Updates.** Deploys are triggered manually: push to `main`, then press **Redeploy** in Coolify, use the console's Deployments → Redeploy, or call the Coolify API (`POST /api/v1/deploy`). Pushing alone does not deploy; no webhook is configured on the pilot. Each deploy recreates every container, so expect about 30–60 s of `503` while it runs, and deploy outside class hours. To roll back, use Coolify → Deployments → redeploy an earlier commit. Migrations only ever move forward, so roll back code only to commits that use the same schema.

**Backups.** Create `/etc/classpulse/backup.env` (root, mode 600) containing `COMPOSE_PROJECT=<resource-uuid>`, `BACKUP_DIR=/var/backups/classpulse` and `BACKUP_AGE_RECIPIENT=age1…`. Then schedule it nightly as root. The pilot server has no cron, so it uses a systemd timer (`classpulse-backup.timer`) that starts `classpulse-backup.service` at about 02:30 server time. The service runs:

```bash
ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/backup.sh
```

On a server with cron, a root cron job does the same:

```bash
30 2 * * * ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
```

`backup.sh` and `restore.sh` find the containers and the audio volume by their compose labels, so they keep working across redeploys. `/opt/classpulse` is a plain checkout of this repo, used only for these scripts.

The compose file mounts `/var/backups/classpulse` into the `api` service read-only at `/backups`, so the console's Health page can check backup age. Keep backups in that folder. The API container runs as the unprivileged `node` user, so `backup.sh` sets `BACKUP_DIR`, `daily/` and `weekly/` to mode 755 on every run. The archives stay owner-only and age-encrypted. Without this, the Health page reports "No daily backup found" even though backups exist. Pilot archives are currently about 270 MB each.

### Pilot domains

All three are live, with Let's Encrypt certificates issued automatically by Traefik:

| Address | Purpose |
|---|---|
| `https://classpulse.benxsolutions.in` | The school app (`PUBLIC_ORIGIN`). `/platform` answers `404` |
| `https://ops.benxsolutions.in` | The platform console (`PLATFORM_HOST`, `PLATFORM_ORIGIN`). `/` redirects to `/platform`; school pages answer `404` |
| `https://coolify.benxsolutions.in` | The Coolify dashboard, and its API at `https://coolify.benxsolutions.in/api/v1` for deploys from an admin's machine |

They are A records to `129.159.227.74` at GoDaddy, the DNS host for `benxsolutions.in`. The Coolify values that go with them:

- `router` domains: `https://classpulse.benxsolutions.in,https://ops.benxsolutions.in`
- `PUBLIC_ORIGIN=https://classpulse.benxsolutions.in`
- `PLATFORM_ORIGIN=https://ops.benxsolutions.in`
- `PLATFORM_HOST=ops.benxsolutions.in`
- `COOLIFY_API_URL=http://10.0.0.112:8000/api/v1` (the server's private address)

If a domain ever changes, update the router's domains, `PUBLIC_ORIGIN`, `PLATFORM_HOST` and `PLATFORM_ORIGIN` together, then redeploy. The earlier `classpulse.129.159.227.74.sslip.io` and `ops.129.159.227.74.sslip.io` addresses are retired and answer `503`.

### Pilot server hardening

- Done: Coolify registration is disabled. SSH is key-only (password authentication off).
- To do: enable 2FA on the Coolify account; change the passwords that were shared; delete the old root Coolify API token now that the least-privilege `classpulse-console` token works; close public port 8000 in the OCI security list. The dashboard is served on `https://coolify.benxsolutions.in`, deploys go through `https://coolify.benxsolutions.in/api/v1`, and the console uses the private `10.0.0.112:8000`, so none of them needs the public port.
- Optional: disable root login over SSH (a key still allows it today), and install fail2ban (not installed).
- If the admin machine's public IP changes, add the new one to Coolify's "Allowed IPs for API access", or its API deploys are refused.

## Local production check

```bash
cp infra/.env.example infra/.env.local-prod   # DOMAIN=localhost, any secrets
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.local-prod up -d --build
curl -kfsS https://localhost/api/health/ready   # Caddy uses its internal CA for localhost
```
