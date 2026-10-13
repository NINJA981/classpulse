#!/bin/sh
# storage-init: idempotent one-time setup of the Garage node through its admin API (v2).
# Runs in infra/garage/init.Dockerfile (alpine + curl + jq) after the `storage` service starts. Safe to run
# on every deploy: each step checks the current state first and only changes what is missing.
#
#   1. wait for the admin API;
#   2. if the cluster layout has no node yet, give this node a role (zone GARAGE_ZONE, capacity
#      GARAGE_CAPACITY) and apply it; an existing layout is never touched;
#   3. wait for /health (quorum);
#   4. create the bucket S3_BUCKET (and any in S3_EXTRA_BUCKETS) if missing;
#   5. import the application key S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY if missing;
#   6. allow that key read + write (never owner) on those buckets only.
#
# Environment:
#   GARAGE_ADMIN_TOKEN    required, at least 32 characters (openssl rand -base64 32). Bearer token of the
#                         admin API.
#   GARAGE_RPC_SECRET     required, exactly 64 hex characters (openssl rand -hex 32). Only checked here, so a
#                         bad value fails with a clear message.
#   GARAGE_ADMIN_URL      default http://127.0.0.1:3903. The admin API listens on Garage's loopback only;
#                         this container shares Garage's network namespace (network_mode: "service:storage").
#   ALLOW_DEV_CREDENTIALS 1 = accept the fixed dev-only values from infra/docker-compose.dev.yml. Only the dev
#                         compose file sets it; everywhere else they are refused.
#   GARAGE_CAPACITY       default 50G. Capacity this node advertises in the layout (K/M/G/T = powers of 1000,
#                         KiB/MiB/GiB/TiB = powers of 1024). Used only when the layout is first created.
#   GARAGE_ZONE           default dc1
#   S3_BUCKET             default classpulse
#   S3_EXTRA_BUCKETS      optional, space-separated (dev: classpulse-test for the S3 test suite)
#   S3_ACCESS_KEY_ID      GK + 24 hex characters:  echo "GK$(openssl rand -hex 12)"
#   S3_SECRET_ACCESS_KEY  64 hex characters:       openssl rand -hex 32
#   STORAGE_DRIVER        local | s3. With `local` and no key configured, steps 4-6 are skipped (the API does
#                         not use Garage yet), so a stack without S3_* still starts.
#   INIT_THEN_WAIT        1 = after success, stay running (healthy) instead of exiting. Coolify reports an
#                         exited one-shot container as a problem, so the Coolify stack keeps this sidecar up.
#
# Secrets never reach argv or the log: the bearer token is read by curl from a 0600 header file, request
# bodies are built by jq from the environment into a 0600 file, and responses that can contain the secret
# key are never printed.
set -eu
umask 077

URL="${GARAGE_ADMIN_URL:-http://127.0.0.1:3903}"
URL="${URL%/}"
CAPACITY="${GARAGE_CAPACITY:-50G}"
ZONE="${GARAGE_ZONE:-dc1}"
BUCKETS="${S3_BUCKET:-classpulse} ${S3_EXTRA_BUCKETS:-}"
KEY_NAME="${S3_KEY_NAME:-classpulse-app}"
DRIVER="${STORAGE_DRIVER:-local}"

WORK="$(mktemp -d)"
HDR="$WORK/auth"
OUT="$WORK/response"
REQ="$WORK/request"
trap 'rm -rf "$WORK"' EXIT

log() { echo "[storage-init] $*"; }
die() { echo "[storage-init] ERROR: $*" >&2; exit 1; }

# --- 0. Secrets: present, strong enough, not the dev placeholders (never printed) -------------------------
[ -n "${GARAGE_ADMIN_TOKEN:-}" ] || die "GARAGE_ADMIN_TOKEN is empty (openssl rand -base64 32)"
[ "${#GARAGE_ADMIN_TOKEN}" -ge 32 ] || die "GARAGE_ADMIN_TOKEN is shorter than 32 characters (openssl rand -base64 32)"
[ -n "${GARAGE_RPC_SECRET:-}" ] || die "GARAGE_RPC_SECRET is empty (openssl rand -hex 32)"
echo "$GARAGE_RPC_SECRET" | grep -Eq '^[0-9a-fA-F]{64}$' ||
  die "GARAGE_RPC_SECRET must be exactly 64 hex characters (openssl rand -hex 32)"
if [ "${ALLOW_DEV_CREDENTIALS:-0}" != 1 ]; then
  case "$GARAGE_RPC_SECRET" in fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210)
    die "GARAGE_RPC_SECRET is the dev-only value from infra/docker-compose.dev.yml; generate a real one" ;;
  esac
  case "$GARAGE_ADMIN_TOKEN" in dev-only-*)
    die "GARAGE_ADMIN_TOKEN is the dev-only value from infra/docker-compose.dev.yml; generate a real one" ;;
  esac
  case "${S3_SECRET_ACCESS_KEY:-}" in 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef)
    die "S3_SECRET_ACCESS_KEY is the dev-only value from infra/docker-compose.dev.yml; generate a real one" ;;
  esac
fi
printf 'Authorization: Bearer %s\n' "$GARAGE_ADMIN_TOKEN" >"$HDR"

# `api GET PATH` or `api POST PATH` (body read from $REQ). Sets CODE; the response body is in $OUT.
# Never called inside a pipeline: ash runs each part of a pipeline in a subshell, which would lose CODE.
api() {
  if [ "$1" = POST ]; then
    CODE="$(curl -sS -o "$OUT" -w '%{http_code}' -X POST -H @"$HDR" -H 'Content-Type: application/json' \
      --data-binary @"$REQ" "$URL$2")" || CODE=000
  else
    CODE="$(curl -sS -o "$OUT" -w '%{http_code}' -H @"$HDR" "$URL$2" </dev/null)" || CODE=000
  fi
}
# Fail with the response's error message (safe to show: never called after a key read).
expect200() { [ "$CODE" = 200 ] || die "$1 failed (HTTP $CODE): $(jq -r '.message? // empty' "$OUT" 2>/dev/null | head -c 300)"; }

to_bytes() {
  v="$(echo "$1" | tr -d ' ')"
  case "$v" in
    *[Tt]i[Bb] | *[Tt]i) mul=1099511627776 ;; *[Gg]i[Bb] | *[Gg]i) mul=1073741824 ;;
    *[Mm]i[Bb] | *[Mm]i) mul=1048576 ;; *[Kk]i[Bb] | *[Kk]i) mul=1024 ;;
    *[Tt][Bb] | *[Tt]) mul=1000000000000 ;; *[Gg][Bb] | *[Gg]) mul=1000000000 ;;
    *[Mm][Bb] | *[Mm]) mul=1000000 ;; *[Kk][Bb] | *[Kk]) mul=1000 ;;
    *[Bb]) mul=1 ;; *) mul=1 ;;
  esac
  n="$(echo "$v" | sed 's/[^0-9].*$//')"
  [ -n "$n" ] || die "GARAGE_CAPACITY '$1' is not a size such as 50G or 200GiB"
  echo $((n * mul))
}

# --- 1. Admin API up --------------------------------------------------------------------------------------
log "Waiting for the Garage admin API at $URL…"
i=0
while :; do
  api GET /v2/GetClusterStatus
  [ "$CODE" = 200 ] && break
  if [ "$CODE" = 401 ] || [ "$CODE" = 403 ]; then
    die "the admin API rejected GARAGE_ADMIN_TOKEN (HTTP $CODE); storage and storage-init must get the same token"
  fi
  i=$((i + 1))
  [ "$i" -lt 60 ] || die "the admin API did not answer within 120 s (last HTTP $CODE)"
  sleep 2
done

# --- 2. Cluster layout ------------------------------------------------------------------------------------
api GET /v2/GetClusterLayout
expect200 GetClusterLayout
roles="$(jq '.roles | length' "$OUT")"
staged="$(jq '.stagedRoleChanges | length' "$OUT")"
version="$(jq '.version' "$OUT")"
if [ "$roles" -gt 0 ]; then
  log "Layout version $version already assigns $roles node(s); leaving it unchanged."
else
  if [ "$staged" -eq 0 ]; then
    api GET /v2/GetClusterStatus
    expect200 GetClusterStatus
    nodes="$(jq '.nodes | length' "$OUT")"
    [ "$nodes" -eq 1 ] || die "no layout yet and $nodes nodes are connected; assign roles by hand (garage layout assign)"
    node_id="$(jq -r '.nodes[0].id' "$OUT")"
    bytes="$(to_bytes "$CAPACITY")"
    log "Assigning node $(echo "$node_id" | cut -c1-16) to zone $ZONE with capacity $CAPACITY ($bytes bytes)…"
    jq -n --arg id "$node_id" --arg zone "$ZONE" --argjson cap "$bytes" \
      '{roles: [{id: $id, zone: $zone, capacity: $cap, tags: ["classpulse"]}]}' >"$REQ"
    api POST /v2/UpdateClusterLayout
    expect200 UpdateClusterLayout
  else
    log "Found $staged staged layout change(s) from an earlier run; applying them."
  fi
  jq -n --argjson v "$((version + 1))" '{version: $v}' >"$REQ"
  api POST /v2/ApplyClusterLayout
  expect200 ApplyClusterLayout
  log "Applied layout version $((version + 1))."
fi

# --- 3. Quorum --------------------------------------------------------------------------------------------
i=0
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$URL/health")" = 200 ]; do
  i=$((i + 1))
  [ "$i" -lt 30 ] || die "Garage /health is not 200 after 60 s"
  sleep 2
done
log "Garage is healthy."

finish() {
  if [ "${INIT_THEN_WAIT:-0}" = 1 ]; then
    : >/tmp/storage-init.done
    log "Done; staying up so the deployment shows this step as healthy."
    trap 'exit 0' TERM INT
    while :; do
      sleep 3600 &
      wait $! || true
    done
  fi
  log "Done."
  exit 0
}

# --- 4-6. Buckets, key, permissions -----------------------------------------------------------------------
if [ -z "${S3_ACCESS_KEY_ID:-}" ] || [ -z "${S3_SECRET_ACCESS_KEY:-}" ]; then
  if [ "$DRIVER" = s3 ]; then die "STORAGE_DRIVER=s3 but S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not set"; fi
  log "S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY not set and STORAGE_DRIVER=$DRIVER: skipping bucket and key setup."
  finish
fi
# shellcheck disable=SC2016 # the messages show a command to run, not to expand
echo "$S3_ACCESS_KEY_ID" | grep -Eq '^GK[0-9a-f]{24}$' ||
  die 'S3_ACCESS_KEY_ID must be GK followed by 24 lowercase hex characters: echo "GK$(openssl rand -hex 12)"'
echo "$S3_SECRET_ACCESS_KEY" | grep -Eq '^[0-9a-f]{64}$' ||
  die 'S3_SECRET_ACCESS_KEY must be 64 lowercase hex characters: openssl rand -hex 32'

bucket_ids=""
for b in $BUCKETS; do
  echo "$b" | grep -Eq '^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$' || die "bucket name '$b' is not a valid S3 bucket name"
  api GET "/v2/GetBucketInfo?globalAlias=$b"
  if [ "$CODE" = 200 ]; then
    log "Bucket $b exists."
  else
    jq -n --arg b "$b" '{globalAlias: $b}' >"$REQ"
    api POST /v2/CreateBucket
    expect200 "CreateBucket $b"
    log "Created bucket $b."
  fi
  bucket_ids="$bucket_ids $b=$(jq -r '.id' "$OUT")"
done

# The key's own secret is compared in memory, never printed.
api GET "/v2/GetKeyInfo?id=$S3_ACCESS_KEY_ID&showSecretKey=true"
if [ "$CODE" = 200 ]; then
  [ "$(jq -r '.secretAccessKey // empty' "$OUT")" = "$S3_SECRET_ACCESS_KEY" ] ||
    die "key $S3_ACCESS_KEY_ID exists in Garage with a different secret; to rotate, delete it first (DeleteKey) or use a new key id"
  log "Key $S3_ACCESS_KEY_ID exists."
else
  jq -n --arg name "$KEY_NAME" '{accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY, name: $name}' >"$REQ"
  api POST /v2/ImportKey
  [ "$CODE" = 200 ] || die "ImportKey failed (HTTP $CODE)"
  log "Imported key $S3_ACCESS_KEY_ID ($KEY_NAME)."
fi
: >"$OUT" # drop the request and response that held the secret
: >"$REQ"

for pair in $bucket_ids; do
  b="${pair%%=*}"
  id="${pair#*=}"
  jq -n --arg b "$id" '{bucketId: $b, accessKeyId: env.S3_ACCESS_KEY_ID, permissions: {read: true, write: true}}' >"$REQ"
  api POST /v2/AllowBucketKey
  expect200 "AllowBucketKey $b"
  # Least privilege: the application never needs to change bucket settings.
  jq -n --arg b "$id" '{bucketId: $b, accessKeyId: env.S3_ACCESS_KEY_ID, permissions: {owner: true}}' >"$REQ"
  api POST /v2/DenyBucketKey
  expect200 "DenyBucketKey $b"
  log "Key has read + write (not owner) on $b."
done

finish
