# ================================================
# Stage 1: Build TypeScript backend
# ================================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ================================================
# Stage 2: Production Runner
# ================================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install FFmpeg for audio processing and curl for healthchecks
RUN apk add --no-cache ffmpeg curl

ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create persistent storage directories
RUN mkdir -p /app/uploads/sessions && chown -R node:node /app/uploads

USER node

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["node", "dist/server.js"]

