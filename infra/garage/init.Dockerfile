# storage-init: one-shot setup of the Garage node (layout, bucket, application key) through the admin API.
# See infra/garage/init.sh. Build context: the repo root. Base image pinned by digest (multi-arch index).
FROM alpine:3.24.2@sha256:294b683cb724975bec92580e1e685676bd4b50bda910ddb8c51d4cabeaec77e6
RUN apk add --no-cache curl jq \
 && adduser -S -D -H -u 10002 -s /sbin/nologin storageinit
COPY --chmod=0555 infra/garage/init.sh /usr/local/bin/storage-init
USER storageinit
HEALTHCHECK --interval=5s --timeout=3s --retries=3 CMD ["test", "-f", "/tmp/storage-init.done"]
CMD ["/usr/local/bin/storage-init"]
