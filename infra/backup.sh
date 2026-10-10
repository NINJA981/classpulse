#!/usr/bin/env bash
# ClassPulse backup: PostgreSQL (pg_dump custom format) + stored lecture audio.
# Archives are encrypted with `age` and rotated (7 daily + 4 weekly).
#
#   sudo ./infra/backup.sh                # uses infra/.env next to this script
# Cron (daily 02:30):
#   30 2 * * * /opt/classpulse/infra/backup.sh >> /var/log/classpulse-backup.log 2>&1
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/.env}"
COMPOSE=(docker compose -f "$HERE/docker-compose.prod.yml" --env-file "$ENV_FILE")

# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a
: "${BACKUP_DIR:?BACKUP_DIR must be set}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT must be set (age public key)}"
command -v age >/dev/null || { echo "age is not installed (apt install age)"; exit 1; }

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

echo "[$(date -u +%FT%TZ)] Dumping PostgreSQL…"
"${COMPOSE[@]}" exec -T postgres pg_dump -U classpulse -d classpulse -Fc --no-owner > "$WORK/db.dump"

echo "[$(date -u +%FT%TZ)] Archiving stored audio…"
"${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh api -c 'tar -C /data -czf - --exclude=storage/tmp storage' > "$WORK/storage.tar.gz"

ARCHIVE="$BACKUP_DIR/daily/classpulse-$STAMP.tar.age"
tar -C "$WORK" -cf - db.dump storage.tar.gz | age -r "$BACKUP_AGE_RECIPIENT" -o "$ARCHIVE"
echo "[$(date -u +%FT%TZ)] Wrote $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Weekly copy on Sundays.
if [ "$(date -u +%u)" = "7" ]; then cp "$ARCHIVE" "$BACKUP_DIR/weekly/"; fi

# Rotation.
ls -1t "$BACKUP_DIR"/daily/*.tar.age 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$BACKUP_DIR"/weekly/*.tar.age 2>/dev/null | tail -n +5 | xargs -r rm -f

if [ -n "${BACKUP_S3_URI:-}" ]; then
  echo "[$(date -u +%FT%TZ)] Copying off-site to $BACKUP_S3_URI…"
  aws s3 cp "$ARCHIVE" "$BACKUP_S3_URI/" --only-show-errors
fi
echo "[$(date -u +%FT%TZ)] Backup complete."
