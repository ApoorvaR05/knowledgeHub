# Knowledge Hub

AI-powered knowledge management and context-aware learning hub for teams.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js / Express + TypeScript |
| Database | PostgreSQL 16 + pgvector |
| AI | OpenAI (text-embedding-ada-002 + GPT-4) |
| Auth | JWT (email + password, admin / user roles) |

---

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [Yarn](https://yarnpkg.com) ≥ 1.22 (classic workspaces)
- [Docker](https://www.docker.com) + Docker Compose (for Postgres locally)

---

## Local Setup

### 1. Clone & install

```bash
git clone <repo-url>
cd knowledge-hub
yarn install
```

### 2. Configure environment variables

```bash
cp .env.example .env
# Edit .env — fill in OPENAI_API_KEY and JWT_SECRET at minimum
cp client/.env.example client/.env   # sets VITE_API_URL=http://localhost:4000
```

### 3. Start PostgreSQL (Docker)

```bash
docker compose up postgres -d
# Wait for healthy: docker compose ps
```

### 4. Run database migrations

```bash
yarn workspace server migrate:up
```

### 5. Start development servers

```bash
# Terminal 1 — API server (port 4000)
yarn dev:server

# Terminal 2 — React app (port 5173)
yarn dev:client
```

Open [http://localhost:5173](http://localhost:5173).

---

## Running Everything with Docker Compose (Production-like)

```bash
docker compose up --build
```

- React app → [http://localhost:3000](http://localhost:3000)
- API → [http://localhost:4000](http://localhost:4000)
- Postgres → `localhost:5432`

---

## Project Structure

```
knowledge-hub/
├── client/          # React SPA (Vite)
│   └── src/
│       ├── api/     # Axios client + MSW mocks
│       ├── context/ # AuthContext
│       ├── pages/   # Route-level components
│       └── components/
├── server/          # Express API (TypeScript)
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── services/
│       ├── routes/
│       └── utils/
└── docker-compose.yml
```

---

## Critical Path Verification

After full setup, verify end-to-end:

1. Register an admin account → `POST /api/auth/register` with `role: admin`
2. Upload a document → Admin → Documents page
3. Wait for `status: ready` in the documents list
4. Open Chat → ask a question about the document
5. Confirm the answer streams back with source attribution

---

## Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions.
