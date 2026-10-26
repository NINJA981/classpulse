# storage-init: one-shot setup of the Garage node (layout, bucket, application key) through the admin API.
# See infra/garage/init.sh. Build context: the repo root. Base image pinned by digest (multi-arch index).
FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
RUN apk add --no-cache curl jq \
 && adduser -S -D -H -u 10002 -s /sbin/nologin storageinit
COPY --chmod=0555 infra/garage/init.sh /usr/local/bin/storage-init
USER storageinit
HEALTHCHECK --interval=5s --timeout=3s --retries=3 CMD ["test", "-f", "/tmp/storage-init.done"]
CMD ["/usr/local/bin/storage-init"]
