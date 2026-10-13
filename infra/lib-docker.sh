# shellcheck shell=bash
# Shared by backup.sh and restore.sh: how to reach the stack's containers.
#  - Plain compose (default): docker compose -f infra/docker-compose.prod.yml --env-file "$ENV_FILE".
#  - Coolify: set COMPOSE_PROJECT to the resource UUID; containers and volumes are found by compose labels.
# Stored files live either in the storage_data volume (STORAGE_DRIVER=local) or in the Garage bucket
# (STORAGE_DRIVER=s3); storage_mode tells which, and s3_sh reaches the bucket.

# Throwaway helper that reads/writes the audio volume (Coolify mode). Pinned by tag + digest.
STORAGE_HELPER_IMAGE="${STORAGE_HELPER_IMAGE:-alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6}"
# Throwaway rclone that copies the Garage bucket (STORAGE_DRIVER=s3). Pinned by tag + digest (multi-arch).
RCLONE_IMAGE="${RCLONE_IMAGE:-rclone/rclone:1.75.1@sha256:45401ad7410db1d67ffdb58e19059ad20b0d8e0285a60e38bbec55cc1019c7a5}"

if [ -n "${COMPOSE_PROJECT:-}" ]; then
  container() {
    docker ps -aq --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" --filter "label=com.docker.compose.service=$1" | head -1
  }
  pg_exec() { docker exec -i "$(container postgres)" "$@"; }
  STORAGE_VOLUME="${STORAGE_VOLUME:-$(docker volume ls -q --filter "label=com.docker.compose.project=$COMPOSE_PROJECT" | grep -E 'storage[-_]data$' | head -1)}"
  : "${STORAGE_VOLUME:?could not find the storage volume for project $COMPOSE_PROJECT}"
  storage_sh() { docker run --rm -i -v "$STORAGE_VOLUME:/data/storage" "$STORAGE_HELPER_IMAGE" sh -c "$1"; }
  app_stop() { for s in "$@"; do docker stop "$(container "$s")" >/dev/null; done; }
  app_start() { for s in "$@"; do docker start "$(container "$s")" >/dev/null; done; }
else
  COMPOSE=(docker compose -f "$HERE/docker-compose.prod.yml" --env-file "$ENV_FILE")
  container() { "${COMPOSE[@]}" ps -aq "$1" 2>/dev/null | head -1; }
  pg_exec() { "${COMPOSE[@]}" exec -T postgres "$@"; }
  storage_sh() { "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh api -c "$1"; }
  app_stop() { "${COMPOSE[@]}" stop "$@"; }
  app_start() { "${COMPOSE[@]}" up -d "$@"; }
fi

# Value of one variable in the api container's environment (empty if unset or there is no api container).
# The container may be stopped; docker inspect still reads its configuration.
app_env() {
  local id
  id="$(container api)"
  [ -n "$id" ] || return 0
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$id" | sed -n "s/^$1=//p" | head -1
}

# local | s3: BACKUP_STORAGE_MODE if set (e.g. restoring onto a server whose api container doesn't exist yet),
# otherwise the api container's STORAGE_DRIVER.
storage_mode() {
  local mode="${BACKUP_STORAGE_MODE:-$(app_env STORAGE_DRIVER)}"
  case "${mode:-local}" in
    local | s3) echo "${mode:-local}" ;;
    *) echo "unknown storage mode '$mode' (expected local or s3)" >&2; return 1 ;;
  esac
}

# Bucket name and credentials for rclone, from the env file (Coolify: /etc/classpulse/backup.env, root-only,
# mode 600): RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID / RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY, or else S3_ACCESS_KEY_ID /
# S3_SECRET_ACCESS_KEY (plain compose: infra/.env already has them), and S3_BUCKET (default classpulse).
# Reading them from the api container instead (docker inspect) is an explicit opt-in:
# BACKUP_S3_CREDS_FROM_CONTAINER=1. They reach rclone as environment variables passed by name
# (`docker run -e NAME`), so they never appear on a command line or in the process list.
s3_prepare() {
  : "${RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID:=${S3_ACCESS_KEY_ID:-}}"
  : "${RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY:=${S3_SECRET_ACCESS_KEY:-}}"
  if [ "${BACKUP_S3_CREDS_FROM_CONTAINER:-0}" = 1 ]; then
    : "${S3_BUCKET:=$(app_env S3_BUCKET)}"
    : "${RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID:=$(app_env S3_ACCESS_KEY_ID)}"
    : "${RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY:=$(app_env S3_SECRET_ACCESS_KEY)}"
  fi
  S3_BUCKET="${S3_BUCKET:-classpulse}"
  if [ -z "$RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID" ] || [ -z "$RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY" ]; then
    echo "Storage is in Garage (s3 mode) but the env file has no S3 key: add RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID and"
    echo "RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY (the values of S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) to $ENV_FILE."
    return 1
  fi
  export S3_BUCKET RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY
  local cid
  cid="$(container storage)"
  if [ -z "$cid" ] || [ "$(docker inspect --format '{{.State.Running}}' "$cid")" != true ]; then
    echo "The Garage container (service storage) is not running."
    return 1
  fi
  # The stack network the storage service is on; rclone joins it and reaches only the S3 API (storage:3900).
  # Garage's admin API and RPC listen on its loopback, out of rclone's reach.
  STORAGE_NETWORK="$(docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$cid" | head -1)"
  [ -n "$STORAGE_NETWORK" ] || { echo "Could not find the storage service's network."; return 1; }
}

# Runs a shell command in a throwaway rclone container on the stack network, with remote `garage:` set up.
# Hardened: digest-pinned image, read-only root filesystem, every capability dropped, no-new-privileges.
# Writable: only /stage (an anonymous volume, deleted with the container) and a small /tmp. Stdin/stdout
# pass through.
s3_sh() {
  docker run --rm -i --network "$STORAGE_NETWORK" \
    --read-only -v /stage --tmpfs /tmp:size=64m \
    --cap-drop ALL --security-opt no-new-privileges:true \
    -e HOME=/tmp -e RCLONE_CACHE_DIR=/tmp/rclone \
    -e RCLONE_CONFIG_GARAGE_TYPE=s3 -e RCLONE_CONFIG_GARAGE_PROVIDER=Other \
    -e RCLONE_CONFIG_GARAGE_ENDPOINT=http://storage:3900 -e RCLONE_CONFIG_GARAGE_REGION=garage \
    -e RCLONE_CONFIG_GARAGE_FORCE_PATH_STYLE=true -e RCLONE_CONFIG_GARAGE_NO_CHECK_BUCKET=true \
    -e RCLONE_CONFIG_GARAGE_ACCESS_KEY_ID -e RCLONE_CONFIG_GARAGE_SECRET_ACCESS_KEY -e S3_BUCKET \
    --entrypoint sh "$RCLONE_IMAGE" -c "$1"
}
