# Deployment (single VPS)

## Requirements

- A VPS with at least 2 vCPU, 4 GB RAM and 40 GB SSD, running Ubuntu 24.04 LTS. Stored files (mostly lecture audio) live on this disk, in Garage's volume. Size the disk for them, plus room for one more copy during backups.
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
# GARAGE_RPC_SECRET, GARAGE_ADMIN_TOKEN, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (see "Object storage" below),
# and optionally SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM (see "Email" below).
# (Speech-to-text provider is chosen per school in Admin → AI settings: Sarvam or OpenAI Whisper.)
chmod 600 infra/.env

docker compose -f infra/docker-compose.prod.yml --env-file infra/.env up -d --build
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env ps
curl -fsS https://$DOMAIN/api/health/ready
```

The one-shot `migrate` service applies the database migrations before `api` and `worker` start. The one-shot `storage-init` service sets up Garage, the object store, before they start as well. On a new server, set `STORAGE_DRIVER=s3` from the start: there are no local files to migrate.

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

- Each backup `classpulse-<stamp>.tar.age` is a plain tar holding two age-encrypted parts:
  - `db.dump.age`: a `pg_dump -Fc`;
  - `storage.tar.gz.age`: stored audio, recordings, submissions and materials, as `storage/<key>`.

  Each part is encrypted as it streams out of its container. Archives are mode 0600; the folders stay 0755 so the API's health check can list them.
- **Where the stored files come from** follows the API's `STORAGE_DRIVER`. Override it with `BACKUP_STORAGE_MODE=local|s3`.
  - `local`: tarred straight out of the `storage_data` volume. No plaintext touches the disk.
  - `s3`: a throwaway `rclone` container joins the stack network and copies the bucket into a temporary Docker volume, which is tarred, encrypted, then deleted.
    - That copy is the only plaintext written, and it sits on the same disk that already holds Garage's own copy.
    - It needs free space for one more copy of the bucket.
    - The rclone container is digest-pinned and runs with a read-only root filesystem, every capability dropped and `no-new-privileges`. Only the staging volume and a small `/tmp` are writable. It can reach Garage's S3 API and nothing else of Garage.
    - The Garage key comes from the env file only, as `RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID` and `RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY` (`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` are accepted too, so a plain-compose `infra/.env` already works). It reaches rclone as environment variables, never on a command line. Without it, the script stops before writing anything. Reading the key from the `api` container instead is an explicit opt-in, `BACKUP_S3_CREDS_FROM_CONTAINER=1`, and is off by default.
  - The archive layout is the same in both modes, so a `local` archive restores into `s3` and back.
- **Garage on the same server is not a backup.** It holds one copy of each file, on the same disk as everything else. The nightly archive, copied off-site, is what protects the files.
- `restore.sh` reads this format and the older single-archive format. It checks the key and the archive before stopping anything.
  - In `s3` mode it unpacks the files into a temporary volume and runs `rclone sync` into the bucket. Objects that are not in the archive are deleted, just as a `local` restore empties the folder first.
  - The `storage` service must be running; the script stops only `api`, `worker` and `web`.
  - Restored objects get a new modification time.
- To decrypt by hand: `tar -xf classpulse-<stamp>.tar.age`, then `age -d -i ~/classpulse-backup.key db.dump.age > db.dump` (and the same for `storage.tar.gz.age`).
- The script keeps 7 daily and 4 weekly archives.
- **Off-site copy (recommended):**
  - Set `BACKUP_S3_URI` (for example `s3://classpulse-backups/pilot`, or an rclone remote), plus `BACKUP_S3_ENDPOINT` for OCI Object Storage's S3-compatible endpoint. Archives are already age-encrypted before they leave the server.
  - `BACKUP_S3_KEEP_DAYS` prunes remote copies older than that many days.
  - Use a write-only credential, and prefer a bucket lifecycle or retention rule.
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
| Health | `GET /api/health/live` (process) and `GET /api/health/ready` (DB, Redis, and storage: the `storage_data` folder or the Garage bucket, whichever `STORAGE_DRIVER` selects) |
| Object storage | `docker compose … exec storage /garage status`, `… /garage bucket info classpulse`, `… /garage stats` |
| DB shell | `docker compose … exec postgres psql -U classpulse classpulse` |
| Restart a service | `docker compose … restart api` |
| Console | `https://$PLATFORM_HOST/platform`: Health (components, queues, alerts, 30-day history), Logs (warnings, errors and notable requests, kept 14 days), Audit log (kept 365 days), Usage & costs |

Point an uptime monitor (for example UptimeRobot) at `https://$DOMAIN/api/health/ready`.

**Background jobs.** The `worker` runs three BullMQ queues: `lesson-generation` (transcription and quiz writing), `email` (invitations, resets and reminders; 5 attempts per message) and `resources` (teacher AI tools). It also runs the periodic tasks: audio retention, device sweep, exam sweep, assignment reminders, log and audit retention, and the 5-minute health snapshot. Failed jobs can be retried from the console's Health page.

## Object storage (Garage)

Stored files are lecture audio, Pi recording chunks, assignment submissions and teacher materials. They live in one of two places:
- the `storage_data` volume (`STORAGE_DRIVER=local`);
- an S3 bucket on [Garage](https://garagehq.deuxfleurs.fr) (`STORAGE_DRIVER=s3`), an open-source (AGPL) S3-compatible store. It is light enough for one ARM server, and can later replicate to a second site.

The API is Garage's only client. It still serves every file itself, with auth, the audit log, `Content-Disposition` and the sandbox CSP, so downloads work the same for users.

**Services** (in `docker-compose.prod.yml` and `docker-compose.coolify.yml`):
- **`storage`:** Garage v2.4.1, built from `infra/garage/Dockerfile` (image pinned by digest) with `infra/garage/garage.toml` baked in.
  - One node, one copy of each object (`replication_factor = 1`).
  - LMDB metadata with a snapshot every 6 h, and fsync on every write.
  - **No published ports** and no domain. The S3 API (`:3900`) is the only port other containers can reach. The admin API (`:3903`) and RPC (`:3901`) listen on the container's loopback, so `api`, `worker`, `web` and the router cannot connect to them at all.
  - Volumes `garage_meta` and `garage_data`.
  - Runs as uid 10001 on a read-only filesystem with every capability dropped.
  - Health check: `garage status` (the image has no shell).
- **`storage-init`:** runs `infra/garage/init.sh` in a small Alpine + curl + jq image, through the admin API. Every step is idempotent:
  1. if there is no layout yet, it gives this node a role (zone `dc1`, capacity `GARAGE_CAPACITY`);
  2. it creates the bucket;
  3. it imports the application key;
  4. it grants that key read and write, never owner, on that bucket only. The key cannot create buckets.

  - It shares Garage's network namespace (`network_mode: "service:storage"`) so it can reach the admin API on `127.0.0.1:3903`. Coolify supports this mode and then adds no networks to the service.
  - Before anything else it checks the secrets, and fails loudly with the reason if:
    - `GARAGE_ADMIN_TOKEN` is empty or shorter than 32 characters;
    - `GARAGE_RPC_SECRET` is not exactly 64 hex characters;
    - any secret is one of the fixed dev-only values from `infra/docker-compose.dev.yml`.
  - Secrets never reach a command line or the log.
  - On plain compose it is a one-shot: `api` and `worker` wait for it to exit 0. On Coolify it stays up as a 1 MB sidecar marked healthy, because Coolify reports an exited container as a failed service.
- **Secrets stay where they are needed.** `GARAGE_RPC_SECRET` and `GARAGE_ADMIN_TOKEN` go only to `storage` and `storage-init`, never to `api`, `worker` or `web`. Those three get only the application's S3 key.
- **`api`, `worker`:** get the `S3_*` variables. They also get `TMP_DIR=/data/tmp` on its own `tmp_data` volume, for uploads in progress, transcodes and S3 downloads; this is always local disk. `storage_data` stays mounted during the migration.

**Variables:**

| Variable | Value |
|---|---|
| `GARAGE_RPC_SECRET` | **required**: `openssl rand -hex 32` (exactly 32 bytes of hex). Compose refuses to start without it |
| `GARAGE_ADMIN_TOKEN` | **required**: `openssl rand -base64 32` (at least 32 characters). Only `storage-init` uses it |
| `S3_ACCESS_KEY_ID` | `echo "GK$(openssl rand -hex 12)"`. Garage's format is `GK` followed by 24 lowercase hex characters |
| `S3_SECRET_ACCESS_KEY` | `openssl rand -hex 32` (64 lowercase hex characters) |
| `STORAGE_DRIVER` | `local` (default) or `s3`. Leave it `local` until the files are migrated (below) |
| `S3_BUCKET` | default `classpulse` |
| `GARAGE_CAPACITY` | default `50G` (K/M/G/T are powers of 1000; KiB/MiB/GiB/TiB are powers of 1024). Applied only when the layout is first created. Keep it at or below the disk space Garage may use |
| `S3_ENDPOINT`, `S3_REGION` | fixed in the compose files: `http://storage:3900` and `garage` |

Keep all four secrets in the password manager.
- **Lost `GARAGE_RPC_SECRET` or `GARAGE_ADMIN_TOKEN`:** set a new one and redeploy. The data is unaffected.
- **Changed key secret:** the application key is checked on every deploy. If `S3_SECRET_ACCESS_KEY` changes but the key id doesn't, `storage-init` fails and says so.
- **Rotating the key:** set a new key id **and** secret together and redeploy; `storage-init` imports the new key and grants it access. Then remove the old one: `docker compose … exec storage /garage key delete --yes <old GK…>`.

With `STORAGE_DRIVER=local` and no `S3_*` set, `storage-init` sets up the node but skips the bucket and key, so the stack still starts. With `s3`, it fails without them.

**Resources.** Garage idles at about 25 MB. Its upload buffers are capped at 128 MiB and the container at 512 MB; `storage-init` is capped at 32 MB. Disk use is the stored files plus a little metadata, slightly reduced by zstd compression.

### Moving existing files to Garage (migrate, then switch)

This is for a server that already has files in `storage_data`; the pilot has about 270 MB. New servers start with `STORAGE_DRIVER=s3` and skip it.

1. **Configure, still on `local`.** Set `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` (on Coolify, in the **Production** environment section). Leave `STORAGE_DRIVER` unset or `local`, and deploy. Then check that `storage-init` succeeded:
   ```bash
   sudo docker logs $(sudo docker ps -aqf label=com.docker.compose.service=storage-init -f label=com.docker.compose.project=<resource-uuid>)
   # ends with: [storage-init] Key has read + write (not owner) on classpulse.  …  [storage-init] Done…
   ```
   On plain compose: `docker compose -f infra/docker-compose.prod.yml --env-file infra/.env logs storage-init`.

   Also add the key to the backup settings now (Coolify: `/etc/classpulse/backup.env`, see [Deploying on Coolify](#deploying-on-coolify)), so the first backup after the switch already has it.
2. **Copy.** Inside the API container, run a dry run first, then the real copy. Uploads keep going to the local folder in the meantime.
   ```bash
   API=$(sudo docker ps -qf label=com.docker.compose.service=api -f label=com.docker.compose.project=<resource-uuid>)
   sudo docker exec $API node dist/scripts/migrateStorage.js --dry-run
   sudo docker exec $API node dist/scripts/migrateStorage.js
   ```
   The script:
   - uploads every file under `STORAGE_DIR`, except `tmp/`, under the same key;
   - skips objects already there with the same size, so it can be re-run;
   - checks sizes and a sample of SHA-256 hashes;
   - checks that every file the database refers to exists.

   Its report must end clean before you go on.
3. **Switch.** Outside class hours, run the script once more to pick up files written since step 2. It does nothing if nothing changed. Then set `STORAGE_DRIVER=s3` and **Redeploy** (about 30–60 s of `503`).
4. **Verify.**
   - `curl -fsS https://$DOMAIN/api/health/ready` returns 200.
   - A lesson's audio plays, and seeking works (`206` range responses).
   - An assignment submission and a teacher material open.
   - A short test recording on a Pi finishes (finalizing reads the chunks back from the bucket).
   - Console → Health shows storage as OK.

   If anything is wrong, roll back (below).
5. **Clean up after a week.** Keep `storage_data` mounted and untouched for a week. Once a backup taken in `s3` mode has been restored in a drill, a later commit removes the volume from the compose files. Only after that, delete it on the server (`docker volume rm <project>_storage_data`).

### Rolling back to local storage

The switch is reversible for as long as `storage_data` exists, which is why it is kept, untouched, until the switch has been verified.

1. Set `STORAGE_DRIVER=local` (or remove it) and **Redeploy**. The API serves the local files again at once: the migration only copied them and deleted nothing.
2. Files uploaded **while on `s3`** exist only in the bucket. Copy them into the local volume, skipping files already there:
   ```bash
   sudo docker volume ls -q | grep -E 'storage[-_]data$'   # note this project's volume name
   sudo bash -c 'set -a; . /etc/classpulse/backup.env; set +a
     NET=<resource-uuid>            # plain compose: classpulse_internal
     VOL=<the volume name from above>
     docker run --rm --network "$NET" --user 1000:1000 --read-only --tmpfs /tmp --cap-drop ALL        --security-opt no-new-privileges:true -v "$VOL":/data/storage -e HOME=/tmp        -e RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID -e RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY        -e RCLONE_CONFIG_GARAGE_TYPE=s3 -e RCLONE_CONFIG_GARAGE_PROVIDER=Other        -e RCLONE_CONFIG_GARAGE_ENDPOINT=http://storage:3900 -e RCLONE_CONFIG_GARAGE_REGION=garage        -e RCLONE_CONFIG_GARAGE_FORCE_PATH_STYLE=true -e RCLONE_CONFIG_GARAGE_NO_CHECK_BUCKET=true        rclone/rclone:1.75.1@sha256:45401ad7410db1d67ffdb58e19059ad20b0d8e0285a60e38bbec55cc1019c7a5        copy garage:classpulse /data/storage --ignore-existing --exclude "tmp/**"'
   ```
   The key is passed to rclone by name only, so it never appears on a command line.
   `--user 1000:1000` makes the files belong to the API's `node` user, as the API's own files do. Files deleted while on `s3` (retention, deleted lessons) come back locally. The next retention run removes expired audio again; anything else is harmless.
3. Leave Garage and its volumes in place. A later switch to `s3` starts again at step 2 of the migration.

### Adding a second Garage node (later)

The single node has no redundancy beyond the nightly backup. To keep a second copy on another site:
1. Run Garage there with the same `GARAGE_RPC_SECRET`.
2. Give each node an `rpc_public_addr` the other can reach over a private link (WireGuard), and connect them (`garage node connect <id>@<addr>:3901`).
3. Set `replication_factor = 2` on both.
4. Assign the new node a role in a different zone and apply the layout (`garage layout assign`, then `garage layout apply`).

Garage then copies every object to both zones. `storage-init` never changes an existing layout, so this stays a manual, one-time step.

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
   | `GARAGE_RPC_SECRET`, `GARAGE_ADMIN_TOKEN` | **required**: `openssl rand -hex 32` and `openssl rand -base64 32`. The deploy fails without them. See [Object storage (Garage)](#object-storage-garage) |
   | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the application's Garage key: `echo "GK$(openssl rand -hex 12)"` and `openssl rand -hex 32` |
   | `STORAGE_DRIVER` | `local` until the files are migrated, then `s3`. New servers start on `s3` |
   | `GARAGE_CAPACITY`, `S3_BUCKET` | optional: `50G` and `classpulse` by default |
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

**Backups.** Create `/etc/classpulse/backup.env`, owned by root with mode 600:

```bash
COMPOSE_PROJECT=<resource-uuid>
BACKUP_DIR=/var/backups/classpulse
BACKUP_AGE_RECIPIENT=age1…
# Garage (needed once STORAGE_DRIVER=s3): the same values as S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY in Coolify.
RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID=GK…
RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY=…
# S3_BUCKET=classpulse                  # only if the bucket name was changed
# Off-site copy with the aws cli to OCI Object Storage (bucket classpulse-backups, region ap-hyderabad-1);
# the archives are age-encrypted before they leave the server. Use an OCI Customer Secret Key that can only write.
# BACKUP_S3_URI=s3://classpulse-backups/pilot
# BACKUP_S3_ENDPOINT=https://<namespace>.compat.objectstorage.ap-hyderabad-1.oraclecloud.com
# AWS_ACCESS_KEY_ID=…
# AWS_SECRET_ACCESS_KEY=…
# AWS_DEFAULT_REGION=ap-hyderabad-1
```

```bash
sudo install -m 600 -o root -g root /dev/null /etc/classpulse/backup.env   # then edit it as root
```

Then schedule it nightly as root. The pilot server has no cron, so it uses a systemd timer (`classpulse-backup.timer`) that starts `classpulse-backup.service` at about 02:30 server time. The service runs:

```bash
ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/backup.sh
```

On a server with cron, a root cron job does the same:

```bash
30 2 * * * ENV_FILE=/etc/classpulse/backup.env /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
```

`backup.sh` and `restore.sh` find the containers and the audio volume by their compose labels, so they keep working across redeploys. With `STORAGE_DRIVER=s3` they take the Garage key from `backup.env` (the `RCLONE_CONFIG_GARAGE_*` lines above) and stop with a clear message if it is missing. They read only `STORAGE_DRIVER` from the `api` container, to know which mode applies. `/opt/classpulse` is a plain checkout of this repo, used only for these scripts.

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
- Done (13 Oct 2026):
  - The old SIH prototype is stopped. Its pm2 apps were removed; the code remains in `/home/ubuntu/Project/SIH`.
  - The host firewall no longer opens ports 3000–5174.
  - fail2ban guards SSH (5 failures in 10 minutes → 1 hour ban).
- Root SSH login stays allowed **with a key only**, because Coolify manages the server through root SSH. Its key is in `/root/.ssh/authorized_keys`.
- If the admin machine's public IP changes, add the new one to Coolify's "Allowed IPs for API access", or its API deploys are refused.

## Local production check

```bash
cp infra/.env.example infra/.env.local-prod   # DOMAIN=localhost, any secrets
docker compose -f infra/docker-compose.prod.yml --env-file infra/.env.local-prod up -d --build
curl -kfsS https://localhost/api/health/ready   # Caddy uses its internal CA for localhost
```

## Security settings (added 13 Oct 2026)

The full audit is kept privately.

- **Edge.**
  - The router sends a Content-Security-Policy, `X-Frame-Options: DENY` and `Cross-Origin-Opener-Policy` on every page (not on `/api`, which has Helmet's own).
  - Pages may load only same-origin scripts, styles, fonts and connections. Frames are limited to the simulation hosts.
  - The router access log removes `X-Device-Key` and `X-Exam-Token` headers, and redacts password-link tokens.
- **Client IPs.**
  - `Caddyfile.coolify` trusts Coolify's Traefik (`trusted_proxies private_ranges`), and the API uses `TRUST_PROXY_HOPS=2`. Together they give the real visitor IP, which rate limits and the audit log depend on.
  - The console's Health page raises an alert if every request still arrives from a private address.
- **Requests.**
  - The API refuses cross-site state-changing requests, returning `403 Cross-site request blocked`.
  - It refuses non-JSON request bodies except file uploads.
  - It sends no CORS headers: the browser always talks to its own host.
- **Sessions.**
  - Session tokens are signed with per-purpose keys derived from `JWT_SECRET`.
  - Changing `JWT_SECRET` signs everyone out.
  - Production refuses the example secrets.
- **New environment variables (all optional):**

| Variable | Default | Purpose |
|---|---|---|
| `AUTH_IP_RATE_LIMIT` | 1500 | Sign-in attempts per IP per 15 min across all accounts (a backstop against password spraying). A whole school behind one NAT shares an IP, so keep it well above the number of students who sign in within 15 minutes. |
| `MAX_LESSON_AUDIO_SEC` | 14400 (4 h) | Longest lecture accepted (uploads and recordings) |
| `DEMO_REQUEST_TO` | the address in `MAIL_FROM` | Inbox for "Book a demo" requests from `/about`. Requests are only ever emailed here, never to the visitor |
| `DEMO_REQUEST_RATE_LIMIT` | 5 | "Book a demo" requests per IP per hour (50 emailed requests a day is a fixed cap across all visitors) |
| `DEFAULT_AI_AUDIO_MINUTES_PER_MONTH` | 3000 | Monthly transcription cap for schools without their own limit (0 = none) |
| `TRANSCRIPT_RETENTION_DAYS` | 365 | Transcripts older than this are cleared; quizzes stay |

- **Containers.**
  - Every service has a memory/CPU limit, `no-new-privileges` and `cap_drop: ALL`. Postgres and Redis get back only what they need.
  - The router runs as a non-root user on a read-only filesystem. So do `storage` (Garage, uid 10001) and `storage-init`.
  - Base images are pinned by digest; Dependabot proposes updates.
  - `REDIS_PASSWORD` must be hex (`openssl rand -hex 32`), because it goes into a URL and a config file.
