const Joi = require("joi");
const crypto = require("crypto");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");
const {
  generateSelectSql,
  summarizeRows,
  getLlmProvider,
  answerQuestion,
  repairSelectSql,
} = require("../services/llm");
const { appendTurn, historyText, lastTurn } = require("../services/conversationStore");

const requestSchema = Joi.object({
  question: Joi.string().min(1).max(2000).required(),
  conversationId: Joi.string().min(1).max(128).optional(),
  conversation_id: Joi.string().min(1).max(128).optional(),
}).rename("conversation_id", "conversationId", {
  override: true,
  ignoreUndefined: true,
});

const KPI_QUESTION =
  "Return a single row of dashboard metrics for the last 30 days with columns: total_sales, day_sales, week_ratio, day_ratio, visits, day_visits, payments, conversion_rate, operation_effect.";
const TREND_QUESTION =
  "Show store sales trend for the last 4 years with columns: year, series_a, series_b, series_c.";
const RANKING_QUESTION =
  "Show sales ranking (top 7) for the last year with columns: store, sales.";

function salesTrend30dSql() {
  return `
WITH params AS (
  SELECT
    date_trunc('day', NOW()) - INTERVAL '29 days' AS from_at,
    date_trunc('day', NOW()) AS to_at
),
buckets AS (
  SELECT gs AS bucket_start
  FROM params,
  generate_series(params.from_at, params.to_at, interval '1 day') AS gs
),
agg AS (
  SELECT
    date_trunc('day', o.placed_at) AS bucket_start,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.channel = 'Web' AND o.status IN ('paid', 'fulfilled')), 0)::double precision AS series_a,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.channel = 'POS' AND o.status IN ('paid', 'fulfilled')), 0)::double precision AS series_b
  FROM orders o
  WHERE o.placed_at >= (SELECT from_at FROM params)
    AND o.placed_at < (SELECT to_at FROM params) + interval '1 day'
  GROUP BY 1
)
SELECT
  to_char(b.bucket_start, 'YYYY-MM-DD') AS label,
  COALESCE(a.series_a, 0)::double precision AS series_a,
  COALESCE(a.series_b, 0)::double precision AS series_b
FROM buckets b
LEFT JOIN agg a ON a.bucket_start = b.bucket_start
ORDER BY b.bucket_start ASC;
  `.trim();
}

function paymentsTrend30dSql() {
  return `
WITH params AS (
  SELECT
    date_trunc('day', NOW()) - INTERVAL '29 days' AS from_at,
    date_trunc('day', NOW()) AS to_at
),
buckets AS (
  SELECT gs AS bucket_start
  FROM params,
  generate_series(params.from_at, params.to_at, interval '1 day') AS gs
),
agg AS (
  SELECT
    date_trunc('day', p.paid_at) AS bucket_start,
    COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'succeeded'), 0)::double precision AS series_a,
    COALESCE(COUNT(*) FILTER (WHERE p.status = 'succeeded'), 0)::double precision AS series_b
  FROM payments p
  WHERE p.paid_at >= (SELECT from_at FROM params)
    AND p.paid_at < (SELECT to_at FROM params) + interval '1 day'
  GROUP BY 1
)
SELECT
  to_char(b.bucket_start, 'YYYY-MM-DD') AS label,
  COALESCE(a.series_a, 0)::double precision AS series_a,
  COALESCE(a.series_b, 0)::double precision AS series_b
FROM buckets b
LEFT JOIN agg a ON a.bucket_start = b.bucket_start
ORDER BY b.bucket_start ASC;
  `.trim();
}

function isVisualizationFollowupQuestion(question) {
  const q = String(question || "").trim().toLowerCase();
  if (!q) return false;

  const wantsVisual =
    q.includes("visualize") ||
    q.includes("chart") ||
    q.includes("graph") ||
    q.includes("plot") ||
    q.includes("trend");

  if (!wantsVisual) return false;

  // If the user already mentioned a metric/table in the follow-up, let the LLM handle it.
  const hasMetricCue =
    q.includes("sales") ||
    q.includes("payment") ||
    q.includes("order") ||
    q.includes("visit") ||
    q.includes("alert") ||
    q.includes("notification") ||
    q.includes("activity") ||
    q.includes("store");

  return !hasMetricCue && q.length <= 80;
}

function topicFromLastTurn(t) {
  const user = (t && t.user ? String(t.user) : "").toLowerCase();
  const sql = (t && t.sql ? String(t.sql) : "").toLowerCase();

  const hay = `${user}\n${sql}`;
  if (hay.includes("payments") || hay.includes("payment")) return "payments";
  if (hay.includes("orders") || hay.includes("total_sales") || hay.includes("sales"))
    return "sales";
  if (hay.includes("sessions") || hay.includes("visits")) return "visits";
  if (hay.includes("alerts")) return "alerts";
  if (hay.includes("notifications")) return "notifications";
  if (hay.includes("activity_events") || hay.includes("activity")) return "activity";

  return "";
}

function shouldUseSalesTrend30dPreset(question) {
  const q = String(question || "").trim().toLowerCase();
  if (!q) return false;

  const mentionsSales = /\bsales\b/.test(q);
  const mentions30Days =
    q.includes("last 30 days") ||
    q.includes("past 30 days") ||
    q.includes("previous 30 days") ||
    /\b30\s*day(s)?\b/.test(q);
  const wantsVisual =
    q.includes("visual") ||
    q.includes("visualize") ||
    q.includes("chart") ||
    q.includes("graph") ||
    q.includes("trend") ||
    q.includes("over time") ||
    q.includes("time series") ||
    q.includes("timeseries") ||
    q.includes("break down") ||
    q.includes("breakdown");

  const wantsStoreBreakdown = q.includes("by store") || q.includes("per store");

  return mentionsSales && mentions30Days && wantsVisual && !wantsStoreBreakdown;
}

function outputHintText(question) {
  const q = String(question || "").trim().toLowerCase();
  if (!q) return "";

  const wantsTrend =
    q.includes("trend") ||
    q.includes("over time") ||
    q.includes("timeseries") ||
    q.includes("time series") ||
    q.includes("visualize") ||
    q.includes("chart") ||
    q.includes("graph") ||
    /\b(daily|weekly|monthly|yearly)\b/i.test(q) ||
    /\bby\s+(day|week|month|year)\b/i.test(q);

  const wantsRanking =
    q.includes("ranking") || q.includes("rank ") || q.includes(" top ");

  const wantsKpis =
    q.includes("kpi") ||
    q.includes("dashboard") ||
    q.includes("metrics") ||
    q.includes("overview");

  const wantsLogs =
    q.includes("logs") ||
    q.includes("log ") ||
    q.includes("activity") ||
    q.includes("alerts") ||
    q.includes("notifications");

  if (wantsTrend) {
    return [
      "Preferred output shape (trend): return multiple rows with:",
      "- label (text): a date/period label like YYYY-MM-DD / YYYY-MM / YYYY",
      "- series_a (number): primary series",
      "- series_b (number): secondary series",
      "Order by the underlying time bucket ascending.",
    ].join("\n");
  }

  if (wantsRanking) {
    return [
      "Preferred output shape (ranking): return multiple rows with:",
      "- id (text)",
      "- store (text)",
      "- sales (number) OR visits (number)",
      "Order by the metric descending and include LIMIT (<= 200).",
    ].join("\n");
  }

  if (wantsKpis) {
    return [
      "Preferred output shape (KPIs): return a single row object with numeric columns using snake_case,",
      "e.g. total_sales, visits, conversion_rate, payments.",
    ].join("\n");
  }

  if (wantsLogs) {
    return [
      "Preferred output shape (logs): return multiple rows with:",
      "- at (timestamptz) OR created_at (timestamptz)",
      "- action/title (text)",
      "- detail/message (text)",
      "Order by timestamp descending and include LIMIT (<= 200).",
    ].join("\n");
  }

  return "";
}

function analyticsSchemaText() {
  return [
    "PostgreSQL schema (tables and columns):",
    "",
    "Business definitions (defaults when the user doesn't specify):",
    "- sales: SUM(orders.total_amount) for orders with status IN ('paid','fulfilled')",
    "- payments: SUM(payments.amount) for payments with status='succeeded'",
    "- visits: COUNT(*) of sessions rows",
    "- default time window: last 30 days for totals/trends if no date range is provided",
    "",
    "users:",
    "- id (text, primary key)",
    "- name (text)",
    "- email (text)",
    "- role (text)",
    "- workspace (text)",
    "- last_login_at (timestamptz)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "notifications:",
    "- id (text, primary key)",
    "- title (text)",
    "- unread (boolean)",
    "- user_id (text, foreign key -> users.id)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "stores:",
    "- id (uuid, primary key)",
    "- name (text)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "orders:",
    "- id (uuid, primary key)",
    "- store_id (uuid, foreign key -> stores.id)",
    "- placed_at (timestamptz)",
    "- customer_name (text)",
    "- channel (text)",
    "- status (text)",
    "- total_amount (numeric)",
    "- items_count (int)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "payments:",
    "- id (uuid, primary key)",
    "- order_id (uuid, foreign key -> orders.id)",
    "- paid_at (timestamptz)",
    "- status (text)",
    "- amount (numeric)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "sessions:",
    "- id (uuid, primary key)",
    "- started_at (timestamptz)",
    "- store_id (uuid)",
    "- channel (text)",
    "- user_id (text)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "alerts:",
    "- id (text, primary key)",
    "- created_at (timestamptz)",
    "- severity (text)",
    "- source (text)",
    "- message (text)",
    "",
    "activity_events:",
    "- id (text, primary key)",
    "- at (timestamptz)",
    "- action (text)",
    "- detail (text)",
    "",
    "saved_queries:",
    "- id (text, primary key)",
    "- name (text)",
    "- created_at (timestamptz)",
    "- last_run_at (timestamptz)",
    "- status (text)",
    "",
    "subscriptions:",
    "- id (text, primary key)",
    "- plan (text)",
    "- renewal_at (timestamptz)",
    "- seats (int)",
    "- seats_used (int)",
    "- monthly_query_limit (int)",
    "- user_id (text, foreign key -> users.id)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "usage_counters:",
    "- id (text, primary key)",
    "- period_month (text, format YYYY-MM)",
    "- monthly_queries_used (int)",
    "- subscription_id (text, foreign key -> subscriptions.id)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "data_sources:",
    "- id (text, primary key)",
    "- name (text)",
    "- type (text)",
    "- status (text)",
    "- subscription_id (text, foreign key -> subscriptions.id)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "invoices:",
    "- id (text, primary key)",
    "- issued_at (timestamptz)",
    "- amount_usd (numeric)",
    "- status (text)",
    "- subscription_id (text, foreign key -> subscriptions.id)",
    "- created_at (timestamptz)",
    "- updated_at (timestamptz)",
    "",
    "Relationship:",
    "- notifications.user_id = users.id",
    "- orders.store_id = stores.id",
    "- payments.order_id = orders.id",
    "- subscriptions.user_id = users.id",
    "- usage_counters.subscription_id = subscriptions.id",
    "- data_sources.subscription_id = subscriptions.id",
    "- invoices.subscription_id = subscriptions.id",
  ].join("\n");
}

function stripCodeFences(text) {
  if (!text) return "";

  const raw = String(text);
  const fencedSql = raw.match(/```sql\s*([\s\S]*?)```/i);
  const fencedAny = raw.match(/```\s*([\s\S]*?)```/);

  let candidate = fencedSql ? fencedSql[1] : fencedAny ? fencedAny[1] : raw;
  candidate = candidate.trim();

  candidate = candidate.replace(/^\s*sql\s*:\s*/i, "").trim();

  const idx = candidate.search(/\b(select|with)\b/i);
  if (idx > 0) {
    candidate = candidate.slice(idx).trim();
  }

  return candidate.replace(/```/g, "").trim();
}

function assertSafeReadOnlySelect(sql) {
  if (typeof sql !== "string") {
    throw new Error("sql_invalid_type");
  }

  let trimmed = sql.trim();
  if (!trimmed) {
    throw new Error("sql_empty");
  }

  // Disallow multiple statements, comments, and obvious injection primitives.
  // Allow a single trailing semicolon, but not multiple statements.
  trimmed = trimmed.replace(/;+\s*$/, "");
  if (!trimmed) {
    throw new Error("sql_empty");
  }
  if (trimmed.includes(";")) {
    throw new Error("sql_semicolons_not_allowed");
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes("--") || lower.includes("/*") || lower.includes("*/")) {
    throw new Error("sql_comments_not_allowed");
  }

  // Must be a SELECT (allow WITH ... SELECT ...).
  if (!(lower.startsWith("select") || lower.startsWith("with"))) {
    throw new Error("sql_not_select");
  }

  // Disallow SELECT INTO (creates a table in Postgres).
  if (/\bselect\s+into\b/i.test(trimmed)) {
    throw new Error("sql_select_into_not_allowed");
  }

  if (/\binformation_schema\b/i.test(trimmed)) {
    throw new Error("sql_forbidden_schema:information_schema");
  }
  if (/\bpg_catalog\b/i.test(trimmed) || /\bpg_stat\b/i.test(trimmed)) {
    throw new Error("sql_forbidden_schema:pg_catalog");
  }
  if (/\bpg_[a-z0-9_]+\b/i.test(trimmed)) {
    throw new Error("sql_forbidden_schema:pg_internal");
  }
  if (/\bpg_sleep\b/i.test(trimmed)) {
    throw new Error("sql_forbidden_function:pg_sleep");
  }

  const forbiddenKeywords = [
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "truncate",
    "grant",
    "revoke",
    "comment",
    "merge",
    "call",
    "execute",
    "do",
    "vacuum",
    "analyze",
    "refresh",
    "copy",
    "lock",
  ];

  for (const kw of forbiddenKeywords) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(trimmed)) {
      throw new Error(`sql_forbidden_keyword:${kw}`);
    }
  }

  return trimmed;
}

function enforceLimit(sql, maxRows) {
  const lower = sql.toLowerCase();
  const match = lower.match(/\blimit\s+(\d+)\b/);
  if (match) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > maxRows) {
      return sql.replace(/\blimit\s+\d+\b/i, `LIMIT ${maxRows}`);
    }
    return sql;
  }
  return `${sql} LIMIT ${maxRows}`;
}

function sqlTimeoutMs() {
  const raw = Number(process.env.SQL_TIMEOUT_MS || 5000);
  if (!Number.isFinite(raw)) return 5000;
  return Math.max(250, Math.min(raw, 30000));
}

async function runSelectWithTimeout(sql) {
  const timeoutMs = sqlTimeoutMs();

  return sequelize.transaction(async (t) => {
    await sequelize.query(`SET LOCAL statement_timeout TO ${timeoutMs}`, {
      transaction: t,
    });
    return sequelize.query(sql, { type: QueryTypes.SELECT, transaction: t });
  });
}

function kpiSql() {
  return `
WITH
  sales AS (
    SELECT
      COALESCE(SUM(total_amount) FILTER (WHERE placed_at >= NOW() - INTERVAL '30 days' AND status IN ('paid', 'fulfilled')), 0)::double precision AS total_sales,
      COALESCE(SUM(total_amount) FILTER (WHERE placed_at >= date_trunc('day', NOW()) AND status IN ('paid', 'fulfilled')), 0)::double precision AS day_sales,
      COALESCE(SUM(total_amount) FILTER (WHERE placed_at >= NOW() - INTERVAL '7 days' AND status IN ('paid', 'fulfilled')), 0)::double precision AS this_week_sales,
      COALESCE(SUM(total_amount) FILTER (WHERE placed_at >= NOW() - INTERVAL '14 days' AND placed_at < NOW() - INTERVAL '7 days' AND status IN ('paid', 'fulfilled')), 0)::double precision AS last_week_sales,
      COALESCE(SUM(total_amount) FILTER (WHERE placed_at >= date_trunc('day', NOW()) - INTERVAL '1 day' AND placed_at < date_trunc('day', NOW()) AND status IN ('paid', 'fulfilled')), 0)::double precision AS yesterday_sales
    FROM orders
  ),
  sessions_agg AS (
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '30 days'), 0)::double precision AS visits,
      COALESCE(COUNT(*) FILTER (WHERE started_at >= date_trunc('day', NOW())), 0)::double precision AS day_visits
    FROM sessions
  ),
  payments_agg AS (
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE status = 'succeeded' AND paid_at >= NOW() - INTERVAL '30 days'), 0)::double precision AS payments
    FROM payments
  ),
  orders_agg AS (
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE placed_at >= NOW() - INTERVAL '30 days'), 0)::double precision AS orders_total,
      COALESCE(COUNT(*) FILTER (WHERE placed_at >= NOW() - INTERVAL '30 days' AND status = 'fulfilled'), 0)::double precision AS orders_fulfilled
    FROM orders
  )
SELECT
  sales.total_sales,
  sales.day_sales,
  COALESCE((sales.this_week_sales - sales.last_week_sales) / NULLIF(sales.last_week_sales, 0), 0)::double precision AS week_ratio,
  COALESCE((sales.day_sales - sales.yesterday_sales) / NULLIF(sales.yesterday_sales, 0), 0)::double precision AS day_ratio,
  sessions_agg.visits,
  sessions_agg.day_visits,
  payments_agg.payments,
  COALESCE(payments_agg.payments / NULLIF(sessions_agg.visits, 0), 0)::double precision AS conversion_rate,
  COALESCE(orders_agg.orders_fulfilled / NULLIF(orders_agg.orders_total, 0), 0)::double precision AS operation_effect
FROM sales, sessions_agg, payments_agg, orders_agg;
  `.trim();
}

function trendSql() {
  return `
WITH years AS (
  SELECT
    date_trunc('year', NOW()) - INTERVAL '3 years' + (n || ' years')::interval AS year_start,
    to_char(date_trunc('year', NOW()) - INTERVAL '3 years' + (n || ' years')::interval, 'YYYY') AS year
  FROM generate_series(0, 3) AS n
),
agg AS (
  SELECT
    date_trunc('year', o.placed_at) AS year_start,
    COALESCE(SUM(CASE WHEN o.channel = 'Web' THEN o.total_amount ELSE 0 END), 0)::double precision AS series_a,
    COALESCE(SUM(CASE WHEN o.channel = 'POS' THEN o.total_amount ELSE 0 END), 0)::double precision AS series_b,
    COALESCE(SUM(CASE WHEN o.channel NOT IN ('Web', 'POS') THEN o.total_amount ELSE 0 END), 0)::double precision AS series_c
  FROM orders o
  WHERE o.placed_at >= date_trunc('year', NOW()) - INTERVAL '3 years'
    AND o.placed_at < date_trunc('year', NOW()) + INTERVAL '1 year'
    AND o.status IN ('paid', 'fulfilled')
  GROUP BY 1
)
SELECT
  y.year,
  COALESCE(a.series_a, 0)::double precision AS series_a,
  COALESCE(a.series_b, 0)::double precision AS series_b,
  COALESCE(a.series_c, 0)::double precision AS series_c
FROM years y
LEFT JOIN agg a ON a.year_start = y.year_start
ORDER BY y.year ASC;
  `.trim();
}

function rankingSql() {
  return `
SELECT
  s.name AS store,
  COALESCE(SUM(o.total_amount), 0)::double precision AS sales
FROM orders o
JOIN stores s ON s.id = o.store_id
WHERE o.placed_at >= NOW() - INTERVAL '365 days'
  AND o.status IN ('paid', 'fulfilled')
GROUP BY s.name
ORDER BY sales DESC, store ASC
LIMIT 7;
  `.trim();
}

function defaultSummaryForRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "No rows returned.";
  if (rows.length === 1) return "Returned 1 row.";
  return `Returned ${rows.length} rows.`;
}

function llmErrorStatus(err) {
  const status = Number(err && err.status);
  if (Number.isFinite(status) && status >= 400 && status < 600) return status;
  const code = err && (err.code || (err.error && err.error.code));
  if (code === "insufficient_quota") return 429;
  if (code === "rate_limit_exceeded") return 429;
  if (code === "invalid_api_key") return 401;
  if (code === "model_not_found") return 400;
  if (code === "openai_not_configured") return 500;

  if (code === "ollama_not_configured") return 500;
  if (code === "ollama_model_not_found") return 400;
  if (code === "ollama_timeout") return 504;
  if (code === "ollama_unreachable") return 502;
  return 502;
}

function llmErrorMessage(err) {
  const code = err && (err.code || (err.error && err.error.code));
  if (code === "insufficient_quota") {
    return "OpenAI quota/billing is unavailable for this API key. Add credits/enable billing or set a different OPENAI_API_KEY.";
  }
  if (code === "rate_limit_exceeded") {
    return "OpenAI rate limit exceeded. Try again shortly.";
  }
  if (code === "invalid_api_key") {
    return "OpenAI rejected the API key. Verify OPENAI_API_KEY.";
  }
  if (code === "model_not_found") {
    return "OpenAI model not found or not accessible. Verify OPENAI_MODEL.";
  }
  if (code === "openai_not_configured") {
    return "OpenAI is not configured. Set OPENAI_API_KEY or switch LLM_PROVIDER=ollama.";
  }
  if (code === "ollama_not_configured") {
    return "Ollama is not configured. Set OLLAMA_MODEL (and optionally OLLAMA_BASE_URL).";
  }
  if (code === "ollama_model_not_found") {
    return "Ollama model not found. Run `ollama pull <model>` and set OLLAMA_MODEL to an installed model.";
  }
  if (code === "ollama_timeout") {
    return "Ollama timed out generating a response. Try a smaller model or increase OLLAMA_TIMEOUT_MS.";
  }
  if (code === "ollama_unreachable") {
    return "Unable to reach Ollama. Ensure Ollama is running and OLLAMA_BASE_URL is correct.";
  }
  const msg = err && (err.message || (err.error && err.error.message));
  return msg ? String(msg) : "LLM request failed.";
}

function isSmallTalkQuestion(question) {
  const q = String(question || "").trim().toLowerCase();
  if (!q) return false;
  const smallTalkRe =
    /\b(hello|hi|hey|test|testing|can you hear me|you hear me|are you there|mic|microphone|thanks|thank you|ty|thx)\b/i;
  return q.length <= 80 && smallTalkRe.test(q);
}

function fastSmallTalkResponse(question) {
  const q = String(question || "").trim();
  const qLower = q.toLowerCase();
  if (!qLower) return "";

  if (/^(hi|hello|hey)\b/i.test(qLower)) {
    return "Hi! Ask me an analytics question (e.g., “total sales last 30 days”, “payments trend”, “top stores by sales”).";
  }

  if (/\b(can you hear me|you hear me|are you there)\b/i.test(qLower)) {
    return "Yep — I’m here. Ask me a question about your data (sales, payments, orders, visits, etc.).";
  }

  if (/\b(test|testing|mic|microphone)\b/i.test(qLower)) {
    return "I can hear you. Ask a dashboard/data question and I’ll pull results from the database.";
  }

  if (/^(thanks|thank\s+you|ty|thx)([.!?])?$/i.test(qLower)) {
    return "You’re welcome. Want a breakdown, a trend chart, or a ranking next?";
  }

  return "";
}

function hasAnalyticsCue(question) {
  const q = String(question || "").trim().toLowerCase();
  if (!q) return false;

  // Metric / entity words
  if (
    /\b(sales|revenue|orders?|payments?|visits?|sessions?|alerts?|notifications?|activity|kpi|metrics?)\b/i.test(
      q
    )
  ) {
    return true;
  }

  // Query intent words
  if (
    /\b(total|sum|count|average|avg|break\s*down|breakdown|group|by\s+\w+|top|ranking|rank|trend|over\s+time|time\s*series|timeseries|visuali[sz]e|chart|graph|plot)\b/i.test(
      q
    )
  ) {
    return true;
  }

  // Time windows
  if (/\b(last|past|previous)\s+\d+\s*(day|week|month|year)s?\b/i.test(q)) {
    return true;
  }
  if (/\b(today|yesterday|this\s+week|this\s+month|this\s+year)\b/i.test(q)) {
    return true;
  }

  return false;
}

function isAcknowledgementOnly(question) {
  const q = String(question || "").trim().toLowerCase();
  if (!q) return false;

  // Short acknowledgements that should not trigger SQL generation.
  const ackRe =
    /^(thanks|thank\s+you|ty|thx|ok|okay|kk|cool|nice|great|awesome|perfect|got\s+it|understood|makes\s+sense|sounds\s+good|all\s+good)([.!?])?$/i;

  return q.length <= 60 && ackRe.test(q);
}

function rememberConversationTurn(conversationId, question, payload) {
  if (!conversationId) return;
  const summary = payload && typeof payload.summary === "string" ? payload.summary : "";
  const sql = payload && typeof payload.sql === "string" ? payload.sql : "";
  const rowsCount =
    payload && Array.isArray(payload.rows) ? payload.rows.length : undefined;

  appendTurn(conversationId, {
    user: question,
    assistant: summary,
    sql,
    rowsCount,
  });
}

function fallbackConversationId(req) {
  // Dev-only fallback so follow-up questions like "visualize it" can work even if
  // the frontend doesn't send an explicit conversation id.
  if (process.env.NODE_ENV === "production") return "";

  const ip = String(req.ip || "").trim();
  const ua = String(req.get("user-agent") || "").trim();
  if (!ip && !ua) return "";

  const hash = crypto
    .createHash("sha256")
    .update(`${ip}|${ua}`)
    .digest("hex")
    .slice(0, 16);

  return `anon:${hash}`;
}

async function handleQuery(req, res, next) {
  const { value, error } = requestSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      error: "invalid_request",
      details: error.details.map((d) => d.message),
    });
  }

  const question = value.question.trim();
  const conversationIdRaw =
    typeof value.conversationId === "string" ? value.conversationId.trim() : "";
  const headerConversationId = String(req.get("x-conversation-id") || "").trim();
  const conversationId =
    conversationIdRaw || headerConversationId || fallbackConversationId(req);
  const history = conversationId ? historyText(conversationId) : "";
  const previousTurn = conversationId ? lastTurn(conversationId) : null;

  if (conversationId) {
    res.setHeader("X-Conversation-Id", conversationId);
  }

  try {
    if (question === KPI_QUESTION) {
      const sql = kpiSql();
      const rows = await runSelectWithTimeout(sql);
      const first = rows[0] || {};
      const summary = `KPI metrics computed for the last 30 days. Total sales=${first.total_sales}, today=${first.day_sales}, conversion_rate=${first.conversion_rate}.`;
      const payload = { sql, rows, summary, conversationId };
      rememberConversationTurn(conversationId, question, payload);
      return res.json(payload);
    }

    if (question === TREND_QUESTION) {
      const sql = trendSql();
      const rows = await runSelectWithTimeout(sql);
      const summary = "Store sales trend for the last 4 years.";
      const payload = { sql, rows, summary, conversationId };
      rememberConversationTurn(conversationId, question, payload);
      return res.json(payload);
    }

    if (question === RANKING_QUESTION) {
      const sql = rankingSql();
      const rows = await runSelectWithTimeout(sql);
      const top = rows[0] ? `${rows[0].store} (${rows[0].sales})` : "none";
      const summary = `Top store sales ranking for the last year (top=${top}).`;
      const payload = { sql, rows, summary, conversationId };
      rememberConversationTurn(conversationId, question, payload);
      return res.json(payload);
    }

    if (isSmallTalkQuestion(question)) {
      const summary =
        fastSmallTalkResponse(question) || (await answerQuestion({ question, history }));
      const payload = { sql: "", rows: [], summary, conversationId };
      rememberConversationTurn(conversationId, question, payload);
      return res.json(payload);
    }

    if (isAcknowledgementOnly(question) && !hasAnalyticsCue(question)) {
      const summary =
        fastSmallTalkResponse(question) ||
        (await answerQuestion({ question, history: "" }));
      const payload = { sql: "", rows: [], summary, conversationId };
      rememberConversationTurn(conversationId, question, payload);
      return res.json(payload);
    }

    if (conversationId && isVisualizationFollowupQuestion(question) && previousTurn) {
      const topic = topicFromLastTurn(previousTurn);
      if (topic === "payments") {
        const sql = paymentsTrend30dSql();
        const rows = await runSelectWithTimeout(sql);
        const summary =
          "Daily payments trend for the last 30 days (series_a=amount, series_b=count).";
        const payload = { sql, rows, summary, conversationId };
        rememberConversationTurn(conversationId, question, payload);
        return res.json(payload);
      }

      if (topic === "sales") {
        const sql = salesTrend30dSql();
        const rows = await runSelectWithTimeout(sql);
        const summary =
          "Daily sales trend for the last 30 days (series_a=Web, series_b=POS).";
        const payload = { sql, rows, summary, conversationId };
        rememberConversationTurn(conversationId, question, payload);
        return res.json(payload);
      }
    }

    if (shouldUseSalesTrend30dPreset(question)) {
      const sql = salesTrend30dSql();
      const rows = await runSelectWithTimeout(sql);
      const summary =
        "Daily sales trend for the last 30 days (series_a=Web, series_b=POS).";
      const payload = { sql, rows, summary, conversationId };
      rememberConversationTurn(conversationId, question, payload);
      return res.json(payload);
    }

    const provider = getLlmProvider();
    if (provider === "openai" && !process.env.OPENAI_API_KEY) {
      console.error("[llm] Missing OPENAI_API_KEY env var (provider=openai)");
      return res.status(500).json({
        error: "openai_not_configured",
        message: "OPENAI_API_KEY must be set (or switch LLM_PROVIDER=ollama)",
      });
    }

    const schema = analyticsSchemaText();
    const outputHint = outputHintText(question);

    let rawSql;
    try {
      rawSql = await generateSelectSql({ schema, question, outputHint, history });
    } catch (llmErr) {
      const message = llmErrorMessage(llmErr);
      const status = llmErrorStatus(llmErr);
      const code =
        llmErr && (llmErr.code || (llmErr.error && llmErr.error.code));
      console.error(
        "[llm] sql generation failed:",
        JSON.stringify({ status, code, message })
      );
      return res.status(status).json({
        error: "llm_failed",
        code: code || null,
        sql: "",
        rows: [],
        summary: message,
        conversationId,
      });
    }

    const cleanedSql = stripCodeFences(rawSql);
    let safeSql = enforceLimit(assertSafeReadOnlySelect(cleanedSql), 200);

    let rows;
    try {
      rows = await runSelectWithTimeout(safeSql);
    } catch (dbErr) {
      const dbMessage =
        (dbErr &&
          dbErr.parent &&
          (dbErr.parent.message || dbErr.parent.toString && dbErr.parent.toString())) ||
        (dbErr && dbErr.message) ||
        "Database query failed.";

      console.error("[db] query failed:", dbMessage);

      // One-shot repair attempt: ask the LLM to fix the SQL given the database error.
      try {
        const repairedRaw = await repairSelectSql({
          schema,
          question,
          sql: safeSql,
          dbError: dbMessage,
          outputHint,
          history,
        });

        const repairedClean = stripCodeFences(repairedRaw);
        safeSql = enforceLimit(assertSafeReadOnlySelect(repairedClean), 200);
        rows = await runSelectWithTimeout(safeSql);
      } catch (repairErr) {
        const summary = await answerQuestion({
          question: `The database rejected the generated SQL with this error: ${dbMessage}. Ask again with more details (e.g., “by store”, “last 30 days”), and I’ll try a different query.`,
          history,
        });
        const payload = { sql: safeSql, rows: [], summary, conversationId };
        rememberConversationTurn(conversationId, question, payload);
        return res.json(payload);
      }
    }

    let summary;
    try {
      summary = await summarizeRows({
        question,
        sql: safeSql,
        rows,
        history,
      });
    } catch (summaryError) {
      console.error("[llm] summary failed:", summaryError);
      summary = defaultSummaryForRows(rows);
    }

    const payload = {
      sql: safeSql,
      rows,
      summary,
      conversationId,
    };
    rememberConversationTurn(conversationId, question, payload);
    return res.json(payload);
  } catch (err) {
    const msg = String(err && err.message);
    if (msg.startsWith("sql_") || msg.startsWith("sql_forbidden_keyword:")) {
      // If the LLM produced invalid/unsafe SQL, fall back to a plain conversational answer
      // rather than failing the entire request. Never execute unsafe SQL.
      try {
        const summary = await answerQuestion({ question, history });
        const payload = { sql: "", rows: [], summary, conversationId };
        rememberConversationTurn(conversationId, question, payload);
        return res.json(payload);
      } catch (fallbackErr) {
        return res.status(400).json({
          error: "unsafe_sql",
          message: msg,
        });
      }
    }

    // If the LLM failed during a chat-only path (timeouts/unreachable/etc),
    // return a structured error instead of falling into the global 500 handler.
    const code = err && (err.code || (err.error && err.error.code));
    if (err && (err.name === "LlmError" || code)) {
      const status = llmErrorStatus(err);
      const summary = llmErrorMessage(err);
      return res.status(status).json({
        error: "llm_failed",
        code: code || null,
        sql: "",
        rows: [],
        summary,
        conversationId,
      });
    }

    return next(err);
  }
}

module.exports = { handleQuery };
