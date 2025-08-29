# ---- Build Frontend ----
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Build Backend ----
FROM node:18-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
# Copy built frontend into backend's public directory
COPY --from=frontend-builder /app/frontend/dist ./public

# ---- Production Image ----
FROM node:18-alpine

WORKDIR /app

# Copy backend (with built frontend inside /public)
COPY --from=backend-builder /app/backend ./

# Install a process manager to run Node.js (e.g. pm2 or just use node)
RUN npm install -g pm2

# Expose backend port (adjust if needed)
EXPOSE 10000

# Healthcheck (optional, adjust endpoint as needed)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:10000/health || exit 1

# Start the backend (serves API and static frontend)
CMD ["pm2-runtime", "index.js"]