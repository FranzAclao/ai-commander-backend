# Frontend API Integration Checklist (InsightCopilot Backend)

Use this handout to confirm the frontend is calling the right endpoints, sending the right payload/params, and correctly mapping responses (including DB-backed fields).

Scope: `ai-commander-backend` Express + Sequelize/Postgres API. This snapshot matches the current code as of **2026-04-17**.

## 0) Quick health + environment sanity

- Backend running: `GET /health` returns `{ ok: true }`.
- Backend port: default `3000` (from `PORT`).
- Backend prints a DB connection line on boot like:
  - `[db] connected host:port/dbname`
  - If the DB name/host is unexpected, you are looking at the wrong database.
- Backend logs each request:
  - `[req] METHOD /path`
  - If you don’t see the log line, the frontend is not reaching this server (wrong base URL, proxy misconfig, CORS/preflight failing, etc.).

## 1) DevTools Network inspection (must-do)

For any suspect API call:

- DevTools → **Network** → click the request
  - **Headers**
    - Confirm **Request URL** is your intended backend (e.g. `http://localhost:3000/...`).
    - Confirm **Status Code** is expected (see “Status code handling” below).
    - Confirm **Request Headers**:
      - `Content-Type: application/json` for JSON POSTs.
  - **Payload**
    - Confirm JSON body shape matches backend expectations (field names + nesting).
    - Confirm query params are in the URL, not the body (for GET endpoints).
  - **Preview** (parsed JSON) and **Response** (raw JSON)
    - Confirm top-level keys and types match what the UI code destructures.
    - If “Preview” looks weird, trust “Response” first (it’s the raw payload).

## 2) Response mapping checklist (common frontend mismatch)

Before destructuring, log the full response once:

- Fetch:
  - `const data = await res.json(); console.log('API data', data);`
- Axios:
  - `const res = await axios.get(...); console.log('API data', res.data);`

Then verify you’re reading the correct level:

- If backend returns an **array**, you should use `data` directly (not `data.rows`).
- If backend returns an **object**, confirm the property names (`rows`, `summary`, etc.).

Common mismatch examples:

- Backend returns `{ sql, rows, summary }`, but UI reads `data.result.rows`
- Backend returns `[...]`, but UI reads `data.rows`

## 3) Types (UUID / numeric / timestamps)

This backend generally normalizes DB types for frontend friendliness:

- UUIDs are returned as **strings** in many endpoints via SQL `::text` casts.
- Money/amount fields are often cast to **numbers** via `::double precision`.
- Timestamps become **ISO strings** in JSON (parse with `new Date(value)` when needed).

Frontend checks:

- Do not coerce UUID strings into numbers.
- Do not `Number()` IDs that might exceed JS safe integer range.
- If a field is a number-like string (e.g. `"123.45"`), format it as a decimal string or parse carefully.

## 4) Status code handling (200 empty vs real error)

Do not treat “no data” the same as “error”.

- `200` with `[]` (or `{}`) means request succeeded but there’s nothing to show.
- `400` means invalid payload/params (backend typically returns `{ error, details: [...] }`).
- `404` can mean:
  - Unknown endpoint: `{ error: "Unknown API endpoint" }`
  - Missing resource (e.g. `{ error: "user_not_found" }`)
- `500` means server error (backend returns `{ error: "internal_server_error" }`).
- `502/504` can happen if the LLM provider fails/timeouts (for `/api/query`).

Frontend best practice:

- Always branch on `res.ok` (fetch) / `error.response.status` (axios).
- On non-2xx, log the raw response body once (helps spot `{ error: "...", details: [...] }`).

## 5) Auth headers (only if your deployment adds auth)

As of this code snapshot, the backend does **not** enforce JWT/session auth on these routes.

If your frontend is seeing `401/403`, it’s likely coming from:

- A reverse proxy / gateway in front of this server
- A different backend service than this repo

DevTools → Network → Headers:

- Verify whether `Authorization: Bearer ...` is being attached by the frontend client.
- If using cookies, ensure `credentials: 'include'` (fetch) / `withCredentials: true` (axios) and that cookies are present.

## 6) API contract: active endpoints + shapes

These are the routes mounted in `src/app.js`.

- `GET /health`
  - **200** `{ ok: true }`

- `GET /api/me`
  - **200** `{ name, email, role, workspace, lastLoginAt }`
  - **404** `{ error: "user_not_found" }`

- `GET /api/notifications?limit=6`
  - **200** `[{ id, title, createdAt, unread }, ...]`
  - **400** `{ error: "invalid_query_params", details: [...] }`

- `POST /api/query`
  - **Payload** `{ question: string }`
  - **200** `{ sql: string, rows: any[], summary: string }`
  - **400** `{ error: "invalid_request", details: [...] }`
  - **400** `{ error: "unsafe_sql", message: "..." }` (if LLM produces unsafe SQL)
  - **4xx/5xx** `{ error: "llm_failed", code, sql: "", rows: [], summary }` (if LLM provider fails)

- `GET /api/result/kpis`
  - **200** `{ total_sales, day_sales, week_ratio, day_ratio, visits, day_visits, payments, conversion_rate, operation_effect }`

- `GET /api/result/trend?metric=sales&period=year&from=YYYY-MM-DD&to=YYYY-MM-DD`
  - **200** `[{ label, series_a, series_b }, ...]`
  - `metric`: `sales|visits`
  - `period`: `day|week|month|year`

- `GET /api/result/ranking?metric=sales&limit=7&from=YYYY-MM-DD&to=YYYY-MM-DD`
  - **200** `[{ id, store, sales }, ...]` or `[{ id, store, visits }, ...]`
  - `metric`: `sales|visits`

- `GET /api/orders?status=paid&q=...&limit=50&offset=0`
  - **200** `[{ id, customer, channel, store, status, placed_at, total, items_count }, ...]`

- `GET /api/alerts?severity=high&q=...&limit=50&offset=0`
  - **200** `[{ id, severity, title, detail, created_at }, ...]`

- `GET /api/saved-queries`
  - **200** `[{ id, name, sql, created_at, status }, ...]`

- `GET /api/account`
  - **200** `{ plan, renewal_at, seats, seats_used, monthly_query_limit, monthly_queries_used, data_sources, invoices }`
  - `data_sources`: `[{ id, name, type, status }, ...]`
  - `invoices`: `[{ id, period, issued_at, amount, status }, ...]`
  - **404** `{ error: "subscription_not_found" }`

- `GET /api/activity?q=...&limit=50&offset=0`
  - **200** `[{ id, at, action, detail }, ...]`

- `GET /api/livekit/token?roomName=...&identity=...`
  - **200** `{ token }`
  - **400** `{ error: "missing_required_query_params", message }`
  - **500** `{ error: "livekit_not_configured", message }`

- `POST /api/agent/join`
  - **Payload** `{ roomName: string }`
  - **200** `{ ok: true, roomName }`
  - **400** `{ error: "invalid_request", details: [...] }`
  - **500** `{ error: "agent_dispatch_failed" | "livekit_not_configured" | "agent_not_configured", message }`

Not mounted (exists in `src/routes/` but not registered in `src/app.js`):

- `POST /api/agent/query` (route exists in `src/routes/agent.js`)
- `/api/incidents...` (route exists in `src/routes/incidents.js`)

## 7) “DB data not showing” triage (fast path)

- Confirm the frontend is calling the correct host/port (Network → Request URL).
- Confirm the backend is connected to the expected DB (backend boot log).
- Confirm the endpoint returns a `200` (not `404/500`).
- Confirm response shape matches destructuring.
- If `200` but empty:
  - Confirm your DB actually has rows for the relevant table(s).
  - Check filters (`status`, `q`, `from/to`, `limit/offset`) aren’t filtering everything out.

