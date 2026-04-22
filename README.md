# InsightCopilot Backend

Node.js + Express + PostgreSQL backend for the InsightCopilot React/Vite frontend.

## Requirements

- Node.js LTS
- PostgreSQL

## Environment

Create a `.env` based on `.env.example`.

Required:

- `PORT=3000`
- `DATABASE_URL=postgres://...`

Optional:

- `DB_SYNC=true` (dev-only, uses `sequelize.sync({ alter: true })`)
- `CORS_ORIGIN=http://localhost:5173`
- Arbitrary `/api/query` questions (choose one):
  - OpenAI: `LLM_PROVIDER=openai` + `OPENAI_API_KEY=...` (+ optional `OPENAI_MODEL=...`)
  - Ollama (local): `LLM_PROVIDER=ollama` + `OLLAMA_MODEL=...` (+ optional `OLLAMA_BASE_URL=...`)
- LiveKit vars for voice features:
  - `LIVEKIT_URL`
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
  - `INSIGHTCOPILOT_AGENT_NAME` (or `LIVEKIT_AGENT_NAME`)

## Run

```bash
npm start
```

## Frontend Integration Checklist

See `docs/FRONTEND_API_INTEGRATION_CHECKLIST.md`.

## Seed Demo Data

```bash
npm run seed
```

## Migrations (optional but supported)

This repo includes Sequelize migrations under `migrations/`, configured via `.sequelizerc`.

Install the CLI:

```bash
npm install --save-dev sequelize-cli
```

Run migrations:

```bash
npx sequelize-cli db:migrate
```
