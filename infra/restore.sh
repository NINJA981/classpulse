#!/usr/bin/env bash
# Restore a ClassPulse backup produced by backup.sh.
#   sudo ./infra/restore.sh /var/backups/classpulse/daily/classpulse-<stamp>.tar.age ~/.config/age/classpulse.key
# This REPLACES the current database and stored audio. The api/worker are stopped during restore.
set -euo pipefail

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

read -r -p "This will overwrite the live database and audio. Type RESTORE to continue: " answer
[ "$answer" = "RESTORE" ] || { echo "Aborted."; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
age -d -i "$IDENTITY" "$ARCHIVE" | tar -C "$WORK" -xf -

echo "Stopping application services…"
app_stop worker web api

echo "Restoring PostgreSQL…"
pg_exec pg_restore -U classpulse -d classpulse --clean --if-exists --no-owner < "$WORK/db.dump"

echo "Restoring stored audio…"
storage_sh 'rm -rf /data/storage/* && tar -C /data -xzf -' < "$WORK/storage.tar.gz"

echo "Starting application services…"
app_start api worker web
echo "Restore complete. Verify: curl -fsS https://\$DOMAIN/api/health/ready"
