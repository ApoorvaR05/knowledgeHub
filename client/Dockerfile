# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock* ./
# Install only client deps (no server workspace)
COPY client/package.json ./client/
RUN yarn install --frozen-lockfile

COPY client ./client

# Build args become Vite env vars at build time
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENABLE_MOCKS=false

WORKDIR /app/client
RUN yarn build

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/client/dist /usr/share/nginx/html

# React Router — serve index.html for any unknown path
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' \
    > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
