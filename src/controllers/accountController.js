const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

async function getAccount(req, res, next) {
  try {
    const [subscription] = await sequelize.query(
      `
SELECT
  id::text AS id,
  plan,
  renewal_at AS renewal_at,
  seats,
  seats_used AS seats_used,
  monthly_query_limit AS monthly_query_limit
FROM subscriptions
ORDER BY created_at ASC
LIMIT 1;
      `.trim(),
      { type: QueryTypes.SELECT }
    );

    if (!subscription) {
      return res.status(404).json({ error: "subscription_not_found" });
    }

    const [usage] = await sequelize.query(
      `
SELECT
  COALESCE(uc.monthly_queries_used, 0)::int AS monthly_queries_used
FROM usage_counters uc
WHERE uc.subscription_id = :subscriptionId
  AND uc.period_month = to_char(date_trunc('month', NOW()), 'YYYY-MM')
ORDER BY uc.created_at DESC
LIMIT 1;
      `.trim(),
      {
        type: QueryTypes.SELECT,
        replacements: { subscriptionId: subscription.id },
      }
    );

    const data_sources = await sequelize.query(
      `
SELECT
  id::text AS id,
  name,
  type,
  status
FROM data_sources
WHERE subscription_id = :subscriptionId
ORDER BY created_at DESC;
      `.trim(),
      {
        type: QueryTypes.SELECT,
        replacements: { subscriptionId: subscription.id },
      }
    );

    const invoices = await sequelize.query(
      `
SELECT
  id::text AS id,
  to_char(date_trunc('month', issued_at), 'YYYY-MM') AS period,
  issued_at AS issued_at,
  amount_usd::double precision AS amount,
  status
FROM invoices
WHERE subscription_id = :subscriptionId
ORDER BY issued_at DESC;
      `.trim(),
      {
        type: QueryTypes.SELECT,
        replacements: { subscriptionId: subscription.id },
      }
    );

    return res.json({
      plan: subscription.plan,
      renewal_at: subscription.renewal_at,
      seats: subscription.seats,
      seats_used: subscription.seats_used,
      monthly_query_limit: subscription.monthly_query_limit,
      monthly_queries_used: (usage && usage.monthly_queries_used) || 0,
      data_sources,
      invoices,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAccount };
