# syntax=docker/dockerfile:1.7
# ClassIQ web image (Next.js standalone). Build from the repository root:
#   docker build -f apps/web/Dockerfile -t classiq-web .

# Base image pinned by tag + digest (multi-arch index: linux/amd64 + linux/arm64); Dependabot (docker)
# proposes updates. Keep every stage on the same reference.
FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --no-audit --no-fund --include-workspace-root -w @classiq/shared -w @classiq/web
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @classiq/shared && npm run build -w @classiq/web

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
# The standalone output doesn't include public/ (icons, logo, sw.js, landing posters/video): server.js serves it
# from apps/web/public next to itself.
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
