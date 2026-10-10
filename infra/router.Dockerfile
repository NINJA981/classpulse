# Internal router image for the Coolify deployment (the Caddyfile is baked in; Coolify can't bind-mount repo files).
FROM caddy:2-alpine
COPY infra/Caddyfile.coolify /etc/caddy/Caddyfile
