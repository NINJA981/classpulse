#!/usr/bin/env bash
# Restore a ClassPulse backup produced by backup.sh.
#   sudo ./infra/restore.sh /var/backups/classpulse/daily/classpulse-<stamp>.tar.age ~/.config/age/classpulse.key
# This REPLACES the current database and stored files. The api/worker are stopped during restore.
# Reads both archive formats (see backup.sh); decrypted data is streamed straight into the containers and is
# never written to disk, except in s3 mode: there the files are unpacked into a temporary Docker volume and
# synced into the Garage bucket (`rclone sync`: objects not in the archive are deleted), then the volume is
# removed. The mode follows the api container's STORAGE_DRIVER, or BACKUP_STORAGE_MODE=local|s3 if set.
# s3 mode needs the storage service running (it is not stopped here) and the Garage key in the env file
# (RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID / RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY; see backup.sh).
set -euo pipefail
umask 077

ARCHIVE="${1:?usage: restore.sh <archive.tar.age> <age-identity-file>}"
IDENTITY="${2:?usage: restore.sh <archive.tar.age> <age-identity-file>}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
# shellcheck source=lib-docker.sh
source "$HERE/lib-docker.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# v1: one age stream around tar(db.dump, storage.tar.gz). v2: tar(db.dump.age, storage.tar.gz.age).
if [ "$(head -c 21 "$ARCHIVE" | tr -d '\0')" = "age-encryption.org/v1" ]; then
  FORMAT=v1
  db_stream() { age -d -i "$IDENTITY" "$ARCHIVE" | tar -xOf - db.dump; }
  storage_stream() { age -d -i "$IDENTITY" "$ARCHIVE" | tar -xOf - storage.tar.gz; }
else
  FORMAT=v2
  tar -C "$WORK" -xf "$ARCHIVE" db.dump.age storage.tar.gz.age # still encrypted
  db_stream() { age -d -i "$IDENTITY" "$WORK/db.dump.age"; }
  storage_stream() { age -d -i "$IDENTITY" "$WORK/storage.tar.gz.age"; }
fi

# Check the key and the archive's integrity before touching anything (age authenticates every chunk).
echo "Verifying $ARCHIVE ($FORMAT)…"
db_stream >/dev/null || { echo "The database dump does not decrypt cleanly (wrong key or damaged archive)."; exit 1; }
magic="$(db_stream | head -c 5 || true)" # head closes the pipe early; only the bytes matter here
[ "$magic" = "PGDMP" ] || { echo "The database dump is not a pg_dump custom-format archive."; exit 1; }
storage_stream | tar -tzf - >/dev/null || { echo "The audio archive does not decrypt cleanly."; exit 1; }

STORAGE_MODE="$(storage_mode)"
if [ "$STORAGE_MODE" = s3 ]; then
  s3_prepare
  echo "Stored files will be restored into Garage bucket $S3_BUCKET."
else
  echo "Stored files will be restored into the storage volume."
fi

read -r -p "This will overwrite the live database and stored files. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }

echo "Stopping application services…"
app_stop worker web api

echo "Restoring PostgreSQL…"
db_stream | pg_exec pg_restore -U classpulse -d classpulse --clean --if-exists --no-owner

echo "Restoring stored files…"
if [ "$STORAGE_MODE" = s3 ]; then
  # -o: files are owned by the helper, not the archive's uid (no CHOWN capability needed).
  # shellcheck disable=SC2016 # expanded inside the rclone container
  storage_stream | s3_sh 'set -e; tar -C /stage -xozf -; mkdir -p /stage/storage
    rclone sync /stage/storage "garage:$S3_BUCKET" --exclude "tmp/**" --transfers 4 -q'
else
  storage_stream | storage_sh 'rm -rf /data/storage/* && tar -C /data -xzf -'
fi

echo "Starting application services…"
app_start api worker web
echo "Restore complete. Verify: curl -fsS https://\$DOMAIN/api/health/ready"
