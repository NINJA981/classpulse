# syntax=docker/dockerfile:1.7
# ClassIQ API + worker image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t classiq-api .
# The same image runs the API (default CMD) and the worker (`node dist/worker.js`).

# Base image pinned by tag + digest (multi-arch index: linux/amd64 + linux/arm64); Dependabot (docker)
# proposes updates. Keep every stage on the same reference.
FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund --include-workspace-root -w @classiq/shared -w @classiq/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @classiq/shared \
 && npm run build -w @classiq/api \
 && cp -r apps/api/src/db/migrations apps/api/dist/db/migrations

FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @classiq/shared -w @classiq/api \
 && rm -rf node_modules/ffmpeg-static node_modules/ffprobe-static/bin

FROM node:22.23.3-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS runtime
RUN apk add --no-cache ffmpeg tini
ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    STORAGE_DIR=/data/storage \
    PORT=5000
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./node_modules/@classiq/shared/package.json
COPY --from=build /repo/packages/shared/dist ./node_modules/@classiq/shared/dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
# /data/tmp is TMP_DIR in the compose files (its own volume). Both exist here owned by `node`, so Docker
# initialises the empty named volumes with that owner.
RUN mkdir -p /data/storage /data/tmp && chown -R node:node /data
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
