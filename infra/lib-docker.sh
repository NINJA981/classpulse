# shellcheck shell=bash
# Shared by backup.sh and restore.sh: how to reach the stack's containers.
#  - Plain compose (default): docker compose -f infra/docker-compose.prod.yml --env-file "$ENV_FILE".
#  - Coolify: set COMPOSE_PROJECT to the resource UUID; containers and volumes are found by compose labels.

# Throwaway helper that reads/writes the audio volume (Coolify mode). Pinned by tag + digest.
STORAGE_HELPER_IMAGE="${STORAGE_HELPER_IMAGE:-alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6}"

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
  pg_exec() { "${COMPOSE[@]}" exec -T postgres "$@"; }
  storage_sh() { "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh api -c "$1"; }
  app_stop() { "${COMPOSE[@]}" stop "$@"; }
  app_start() { "${COMPOSE[@]}" up -d "$@"; }
fi
