#!/usr/bin/env bash
# ClassPulse backup: PostgreSQL (pg_dump custom format) + stored lecture audio, encrypted with `age` and
# rotated (7 daily + 4 weekly), optionally copied off-site.
#
#   sudo ./infra/backup.sh                # uses infra/.env next to this script
#   sudo ENV_FILE=/etc/classpulse/backup.env ./infra/backup.sh   # Coolify: env sets COMPOSE_PROJECT
# Cron (daily 02:30):
#   30 2 * * * /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
#
# Archive format (v2): classpulse-<stamp>.tar.age is a plain tar holding two age-encrypted members,
#   db.dump.age         pg_dump -Fc, encrypted as it streams out of the database container
#   storage.tar.gz.age  the stored files (audio, recordings, submissions, materials) as a tar of storage/<key>,
#                       encrypted as it streams out
# Where the stored files come from follows the API's STORAGE_DRIVER (or BACKUP_STORAGE_MODE):
#   local  the storage_data volume, streamed straight out of it.
#   s3     the Garage bucket: a throwaway rclone container copies it into a temporary Docker volume, which is
#          tarred, encrypted and deleted. That copy is the only unencrypted data written, and it sits on the
#          same disk as Garage's own (unencrypted) copy; allow free space for one more copy of the bucket.
#          rclone runs digest-pinned, read-only, with no capabilities, on the stack network (S3 API only).
# The member layout is the same in both modes, so either kind of archive restores into either mode.
# Nothing else is ever written to disk unencrypted. restore.sh reads this and the older v1 format (one age
# stream around a tar of db.dump + storage.tar.gz).
#
# Settings (ENV_FILE):
#   BACKUP_DIR            required. Local archive folder (the API mounts it read-only for its health check).
#   BACKUP_AGE_RECIPIENT  required. age public key; the private key stays OFF the server.
#   BACKUP_S3_URI         optional off-site copy, e.g. s3://classpulse-backups/prod (aws cli) or an rclone
#                         remote such as oci:classpulse-backups/prod (rclone).
#   BACKUP_S3_ENDPOINT    aws cli only: S3-compatible endpoint. OCI Object Storage:
#                         https://<namespace>.compat.objectstorage.<region>.oraclecloud.com
#                         (credentials: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY = an OCI "Customer Secret
#                         Key"; AWS_DEFAULT_REGION = the OCI region, e.g. ap-hyderabad-1)
#   BACKUP_S3_KEEP_DAYS   optional. Delete off-site copies older than this many days (0 or unset = never; use
#                         this or a bucket lifecycle rule, not both). A write-only credential can't delete:
#                         with one, leave this unset and rely on the bucket's retention/lifecycle policy.
#   BACKUP_STORAGE_MODE   optional: local | s3. Default: the api container's STORAGE_DRIVER.
#   RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID, RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY
#                         s3 mode: the application's Garage key (the values of S3_ACCESS_KEY_ID /
#                         S3_SECRET_ACCESS_KEY, which are also accepted under those names). Required in s3 mode.
#   S3_BUCKET             s3 mode, optional: default classpulse.
#   BACKUP_S3_CREDS_FROM_CONTAINER
#                         optional, off by default: 1 = take the key and bucket from the api container's
#                         environment (docker inspect) when the env file lacks them.
set -euo pipefail
# Every file this script creates (work files, archives, weekly copies) is owner-only.
umask 077

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
# shellcheck source=lib-docker.sh
source "$HERE/lib-docker.sh"
: "${BACKUP_DIR:?BACKUP_DIR must be set}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT must be set (age public key)}"
command -v age >/dev/null || { echo "age is not installed (apt install age)"; exit 1; }

log() { echo "[$(date -u +%FT%TZ)] $*"; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
NAME="classpulse-$STAMP.tar.age"
ARCHIVE="$BACKUP_DIR/daily/$NAME"
PARTIAL="$BACKUP_DIR/daily/.$NAME.partial"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/classpulse-backup.XXXXXX")"
trap 'rm -rf "$WORK"; rm -f "$PARTIAL"' EXIT

mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
# The folders are listable (755) because the API container (user `node`) checks the newest archive's age
# through a read-only mount. Listing reveals only names and times: each archive is 0600 and age-encrypted.
chmod 755 "$BACKUP_DIR" "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

# Settle where the stored files are (and the Garage key) before writing anything.
STORAGE_MODE="$(storage_mode)"
if [ "$STORAGE_MODE" = s3 ]; then s3_prepare; fi

log "Dumping PostgreSQL (encrypted while streaming)…"
pg_exec pg_dump -U classpulse -d classpulse -Fc --no-owner | age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/db.dump.age"

if [ "$STORAGE_MODE" = s3 ]; then
  log "Archiving stored files from Garage bucket $S3_BUCKET (encrypted while streaming)…"
  # tmp/ never holds anything worth keeping (the API keeps temporary files on local disk anyway).
  # shellcheck disable=SC2016 # expanded inside the rclone container
  s3_sh 'set -e; mkdir -p /stage/storage
    rclone copy "garage:$S3_BUCKET" /stage/storage --exclude "tmp/**" --transfers 4 -q
    tar -C /stage -czf - storage' | age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/storage.tar.gz.age"
else
  log "Archiving stored files from the storage volume (encrypted while streaming)…"
  storage_sh 'tar -C /data -czf - --exclude=storage/tmp storage' | age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/storage.tar.gz.age"
fi

# Bundle the two encrypted parts. Written under a temporary name and renamed only when complete, so the
# health check and rotation never see a half-written archive.
tar -C "$WORK" -cf "$PARTIAL" db.dump.age storage.tar.gz.age
chmod 600 "$PARTIAL"
mv "$PARTIAL" "$ARCHIVE"
log "Wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Weekly copy on Sundays (keeps mode 0600).
if [ "$(date -u +%u)" = "7" ]; then cp -p "$ARCHIVE" "$BACKUP_DIR/weekly/"; fi

# Rotation: keep the newest N archives in a folder. find (unlike an unmatched ls glob) succeeds on an
# empty folder, which matters under `set -o pipefail`.
rotate() {
  find "$1" -maxdepth 1 -name 'classpulse-*.tar.age' -printf '%T@ %p\n' | sort -rn | tail -n +"$(($2 + 1))" | cut -d' ' -f2- | xargs -r rm -f
}
rotate "$BACKUP_DIR/daily" 7
rotate "$BACKUP_DIR/weekly" 4

# --- Off-site copy -------------------------------------------------------------------------------------
if [ -n "${BACKUP_S3_URI:-}" ]; then
  REMOTE="${BACKUP_S3_URI%/}"
  KEEP_DAYS="${BACKUP_S3_KEEP_DAYS:-0}"
  case "$KEEP_DAYS" in '' | *[!0-9]*) echo "BACKUP_S3_KEEP_DAYS must be a whole number of days"; exit 1 ;; esac

  if [[ "$REMOTE" == s3://* ]]; then
    command -v aws >/dev/null || { echo "BACKUP_S3_URI is s3://… but the aws cli is not installed"; exit 1; }
    AWS=(aws)
    if [ -n "${BACKUP_S3_ENDPOINT:-}" ]; then AWS+=(--endpoint-url "$BACKUP_S3_ENDPOINT"); fi
    log "Copying off-site to $REMOTE/…"
    "${AWS[@]}" s3 cp "$ARCHIVE" "$REMOTE/$NAME" --only-show-errors
    if [ "$KEEP_DAYS" -gt 0 ]; then
      # Age comes from the timestamp in the object name (not the upload time), so re-uploads don't reset it.
      CUTOFF="$(date -u -d "-$KEEP_DAYS days" +%Y%m%dT%H%M%SZ)"
      "${AWS[@]}" s3 ls "$REMOTE/" | awk '{print $NF}' | { grep -E '^classpulse-[0-9]{8}T[0-9]{6}Z\.tar\.age$' || true; } |
        while read -r obj; do
          ts="${obj#classpulse-}"; ts="${ts%.tar.age}"
          if [[ "$ts" < "$CUTOFF" ]]; then
            log "Pruning off-site copy $obj (older than $KEEP_DAYS days)"
            "${AWS[@]}" s3 rm "$REMOTE/$obj" --only-show-errors
          fi
        done
    fi
  else
    command -v rclone >/dev/null || { echo "BACKUP_S3_URI is not s3://… and rclone is not installed"; exit 1; }
    log "Copying off-site to $REMOTE/ (rclone)…"
    rclone copyto "$ARCHIVE" "$REMOTE/$NAME"
    if [ "$KEEP_DAYS" -gt 0 ]; then
      log "Pruning off-site copies older than $KEEP_DAYS days"
      rclone delete "$REMOTE" --min-age "${KEEP_DAYS}d" --include 'classpulse-*.tar.age'
    fi
  fi
fi
log "Backup complete."
