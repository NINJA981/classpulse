# syntax=docker/dockerfile:1.7
# ClassPulse API + worker image. Build from the repository root:
#   docker build -f apps/api/Dockerfile -t classpulse-api .
# The same image runs the API (default CMD) and the worker (`node dist/worker.js`).

FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund -w @classpulse/shared -w @classpulse/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @classpulse/shared \
 && npm run build -w @classpulse/api \
 && cp -r apps/api/src/db/migrations apps/api/dist/db/migrations

FROM node:22-alpine AS prod-deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @classpulse/shared -w @classpulse/api \
 && rm -rf node_modules/ffmpeg-static node_modules/ffprobe-static/bin

FROM node:22-alpine AS runtime
RUN apk add --no-cache ffmpeg tini
ENV NODE_ENV=production \
    FFMPEG_PATH=/usr/bin/ffmpeg \
    FFPROBE_PATH=/usr/bin/ffprobe \
    STORAGE_DIR=/data/storage \
    PORT=5000
WORKDIR /app
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./node_modules/@classpulse/shared/package.json
COPY --from=build /repo/packages/shared/dist ./node_modules/@classpulse/shared/dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
RUN mkdir -p /data/storage && chown -R node:node /data
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:5000/api/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
