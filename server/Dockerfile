# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/
RUN npm install --workspace=server --ignore-scripts

COPY server ./server

WORKDIR /app/server
RUN npx tsc

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/
RUN npm install --workspace=server --omit=dev --ignore-scripts

COPY --from=builder /app/server/dist ./server/dist

WORKDIR /app/server
EXPOSE 4000
CMD ["node", "dist/index.js"]
