#!/usr/bin/env bash
# ClassPulse backup: PostgreSQL (pg_dump custom format) + stored lecture audio.
# Archives are encrypted with `age` and rotated (7 daily + 4 weekly).
#
#   sudo ./infra/backup.sh                # uses infra/.env next to this script
#   sudo ENV_FILE=/etc/classpulse/backup.env ./infra/backup.sh   # Coolify: env sets COMPOSE_PROJECT
# Cron (daily 02:30):
#   30 2 * * * /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env}"

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
# shellcheck source=lib-docker.sh
source "$HERE/lib-docker.sh"
: "${BACKUP_DIR:?BACKUP_DIR must be set}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT must be set (age public key)}"
command -v age >/dev/null || { echo "age is not installed (apt install age)"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

echo "[$(date -u +%FT%TZ)] Dumping PostgreSQL…"
pg_exec pg_dump -U classpulse -d classpulse -Fc --no-owner > "$WORK/db.dump"

echo "[$(date -u +%FT%TZ)] Archiving stored audio…"
storage_sh 'tar -C /data -czf - --exclude=storage/tmp storage' > "$WORK/storage.tar.gz"

ARCHIVE="$BACKUP_DIR/daily/classpulse-$STAMP.tar.age"
tar -C "$WORK" -cf - db.dump storage.tar.gz | age -r "$BACKUP_AGE_RECIPIENT" -o "$ARCHIVE"
echo "[$(date -u +%FT%TZ)] Wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Weekly copy on Sundays.
if [ "$(date -u +%u)" = "7" ]; then cp "$ARCHIVE" "$BACKUP_DIR/weekly/"; fi

# Rotation: keep the newest N archives in a folder. find (unlike an unmatched ls glob) succeeds on an
# empty folder, which matters under `set -o pipefail`.
rotate() {
  find "$1" -maxdepth 1 -name '*.tar.age' -printf '%T@ %p
' | sort -rn | tail -n +"$(($2 + 1))" | cut -d' ' -f2- | xargs -r rm -f
}
rotate "$BACKUP_DIR/daily" 7
rotate "$BACKUP_DIR/weekly" 4

if [ -n "${BACKUP_S3_URI:-}" ]; then
  echo "[$(date -u +%FT%TZ)] Copying off-site to $BACKUP_S3_URI…"
  aws s3 cp "$ARCHIVE" "$BACKUP_S3_URI/" --only-show-errors
fi
echo "[$(date -u +%FT%TZ)] Backup complete."
