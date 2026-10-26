# Internal router image for the Coolify deployment (the Caddyfile is baked in; Coolify can't bind-mount repo files).
# Base image pinned by digest (multi-arch index: linux/amd64 + linux/arm64). Dependabot (docker) proposes bumps.
FROM caddy:2.11.7-alpine@sha256:eb4d35b7452d1ab6171fbdbe8d9275b2301dad6dad92115d91e19fb9b24d510f

# Run as an unprivileged user. It still listens on :80 (Coolify routes the domain to router port 80):
# Docker sets net.ipv4.ip_unprivileged_port_start=0 inside containers, so no capability is needed.
# The image's file capability on /usr/bin/caddy (cap_net_bind_service) is removed, because a file
# capability makes exec fail outright under `cap_drop: [ALL]` (see infra/docker-compose.coolify.yml).
RUN apk add --no-cache --virtual .setcap libcap-utils \
 && setcap -r /usr/bin/caddy \
 && apk del .setcap \
 && addgroup -S -g 10001 caddy \
 && adduser -S -D -H -u 10001 -G caddy -h /data -s /sbin/nologin caddy \
 && chown -R caddy:caddy /data /config

COPY infra/Caddyfile.coolify /etc/caddy/Caddyfile
USER caddy
