# ================================================
# Stage 1: Build Stage (Node.js Alpine)
# ================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy full application code and build static assets
COPY . .
RUN npm run build

# ================================================
# Stage 2: Production Stage (Nginx Alpine)
# ================================================
FROM nginx:alpine AS runner

# Remove default nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx configuration for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start Nginx web server in foreground
CMD ["nginx", "-g", "daemon off;"]
