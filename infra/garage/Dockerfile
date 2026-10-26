# Garage object storage (S3 API) for ClassIQ, with infra/garage/garage.toml baked in (Coolify can't
# bind-mount repo files; same pattern as infra/router.Dockerfile). Build context: the repo root.
# Base image pinned by digest (multi-arch index: linux/amd64 + linux/arm64 + arm + 386). Garage v2.4.1.
#
# The official image is FROM scratch: one static binary (/garage), no shell, no package manager. It would run
# as root; here it runs as uid 10001 instead. The data directories are created in a throwaway stage and copied
# in with that owner, and Docker copies them (with ownership) into the empty named volumes on first start, so
# Garage can write its volumes without any capability (compose sets cap_drop: [ALL]).
FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a AS dirs
RUN mkdir -p /out/var/lib/garage/meta /out/var/lib/garage/data \
 && chown -R 10001:10001 /out/var/lib/garage \
 && chmod 700 /out/var/lib/garage/meta /out/var/lib/garage/data

FROM dxflrs/garage:v2.4.1@sha256:9c96caa2612d3411acc5b0e6701fb238dbfba33e533a6d7d3d811a4b12d0d020
COPY --from=dirs --chown=10001:10001 /out/var/lib/garage /var/lib/garage
COPY infra/garage/garage.toml /etc/garage.toml
USER 10001:10001
# S3 API (all interfaces), RPC and admin API (loopback only; see garage.toml). Nothing is published in production.
EXPOSE 3900
# Healthy = the daemon answers on RPC (`garage status` talks to it with the RPC secret from the environment).
# Deliberately not /health: that is 503 until storage-init has assigned the cluster layout, and storage-init
# waits for this container first.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 CMD ["/garage", "status"]
CMD ["/garage", "server"]
