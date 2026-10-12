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
#   storage.tar.gz.age  the audio folder, encrypted as it streams out of the storage volume
# Nothing is ever written to disk unencrypted. restore.sh reads this and the older v1 format (one age stream
# around a tar of db.dump + storage.tar.gz).
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

log "Dumping PostgreSQL (encrypted while streaming)…"
pg_exec pg_dump -U classpulse -d classpulse -Fc --no-owner | age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/db.dump.age"

log "Archiving stored audio (encrypted while streaming)…"
storage_sh 'tar -C /data -czf - --exclude=storage/tmp storage' | age -r "$BACKUP_AGE_RECIPIENT" -o "$WORK/storage.tar.gz.age"

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
