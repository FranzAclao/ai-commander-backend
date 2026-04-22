const Joi = require("joi");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

const rankingQuerySchema = Joi.object({
  metric: Joi.string().valid("sales", "visits").default("sales"),
  limit: Joi.number().integer().min(1).max(50).default(7),
  from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const trendQuerySchema = Joi.object({
  metric: Joi.string().valid("sales", "visits").default("sales"),
  period: Joi.string().valid("day", "week", "month", "year").default("year"),
  from: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function defaultFromTo() {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 4);
  return { from, to };
}

function parseIsoDateOrNull(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function periodSpec(period) {
  if (period === "day") return { trunc: "day", step: "1 day", fmt: "YYYY-MM-DD" };
  if (period === "week") return { trunc: "week", step: "1 week", fmt: "IYYY-IW" };
  if (period === "month") return { trunc: "month", step: "1 month", fmt: "YYYY-MM" };
  return { trunc: "year", step: "1 year", fmt: "YYYY" };
}

async function getKpis(req, res, next) {
  const sql = `
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

  try {
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return res.json(rows[0] || {});
  } catch (error) {
    next(error);
  }
}

async function getTrend(req, res, next) {
  const { value, error } = trendQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      error: "invalid_query_params",
      details: error.details.map((d) => d.message),
    });
  }

  const defaults = defaultFromTo();
  const from = parseIsoDateOrNull(value.from) || defaults.from;
  const to = parseIsoDateOrNull(value.to) || defaults.to;

  const spec = periodSpec(value.period);

  const sql =
    value.metric === "visits"
      ? `
WITH params AS (
  SELECT date_trunc('${spec.trunc}', :from::timestamptz) AS from_at,
         date_trunc('${spec.trunc}', :to::timestamptz) AS to_at
),
buckets AS (
  SELECT gs AS bucket_start
  FROM params,
  generate_series(params.from_at, params.to_at, interval '${spec.step}') AS gs
),
agg AS (
  SELECT
    date_trunc('${spec.trunc}', s.started_at) AS bucket_start,
    COALESCE(COUNT(*) FILTER (WHERE s.channel = 'Web'), 0)::double precision AS series_a,
    COALESCE(COUNT(*) FILTER (WHERE s.channel = 'POS'), 0)::double precision AS series_b
  FROM sessions s
  WHERE s.started_at >= (SELECT from_at FROM params)
    AND s.started_at < (SELECT to_at FROM params) + interval '${spec.step}'
  GROUP BY 1
)
SELECT
  to_char(b.bucket_start, '${spec.fmt}') AS label,
  COALESCE(a.series_a, 0)::double precision AS series_a,
  COALESCE(a.series_b, 0)::double precision AS series_b
FROM buckets b
LEFT JOIN agg a ON a.bucket_start = b.bucket_start
ORDER BY b.bucket_start ASC;
        `.trim()
      : `
WITH params AS (
  SELECT date_trunc('${spec.trunc}', :from::timestamptz) AS from_at,
         date_trunc('${spec.trunc}', :to::timestamptz) AS to_at
),
buckets AS (
  SELECT gs AS bucket_start
  FROM params,
  generate_series(params.from_at, params.to_at, interval '${spec.step}') AS gs
),
agg AS (
  SELECT
    date_trunc('${spec.trunc}', o.placed_at) AS bucket_start,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.channel = 'Web' AND o.status IN ('paid', 'fulfilled')), 0)::double precision AS series_a,
    COALESCE(SUM(o.total_amount) FILTER (WHERE o.channel = 'POS' AND o.status IN ('paid', 'fulfilled')), 0)::double precision AS series_b
  FROM orders o
  WHERE o.placed_at >= (SELECT from_at FROM params)
    AND o.placed_at < (SELECT to_at FROM params) + interval '${spec.step}'
  GROUP BY 1
)
SELECT
  to_char(b.bucket_start, '${spec.fmt}') AS label,
  COALESCE(a.series_a, 0)::double precision AS series_a,
  COALESCE(a.series_b, 0)::double precision AS series_b
FROM buckets b
LEFT JOIN agg a ON a.bucket_start = b.bucket_start
ORDER BY b.bucket_start ASC;
        `.trim();

  try {
    const rows = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { from, to },
    });
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getRanking(req, res, next) {
  const { value, error } = rankingQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      error: "invalid_query_params",
      details: error.details.map((d) => d.message),
    });
  }

  const defaults = defaultFromTo();
  const from = parseIsoDateOrNull(value.from) || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const to = parseIsoDateOrNull(value.to) || defaults.to;

  const sql =
    value.metric === "visits"
      ? `
WITH ranked AS (
  SELECT
    st.id AS store_id,
    st.name AS store,
    COALESCE(COUNT(s.id), 0)::double precision AS visits
  FROM stores st
  LEFT JOIN sessions s ON s.store_id = st.id
    AND s.started_at >= :from::timestamptz
    AND s.started_at < :to::timestamptz + INTERVAL '1 day'
  GROUP BY st.id, st.name
)
SELECT
  store_id::text AS id,
  store,
  visits
FROM ranked
ORDER BY visits DESC, store ASC
LIMIT :limit;
        `.trim()
      : `
WITH ranked AS (
  SELECT
    s.id AS store_id,
    s.name AS store,
    COALESCE(SUM(o.total_amount), 0)::double precision AS sales
  FROM orders o
  JOIN stores s ON s.id = o.store_id
  WHERE o.placed_at >= :from::timestamptz
    AND o.placed_at < :to::timestamptz + INTERVAL '1 day'
    AND o.status IN ('paid', 'fulfilled')
  GROUP BY s.id, s.name
)
SELECT
  store_id::text AS id,
  store,
  sales
FROM ranked
ORDER BY sales DESC, store ASC
LIMIT :limit;
        `.trim();

  try {
    const rows = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { limit: value.limit, from, to },
    });
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { getKpis, getTrend, getRanking };
