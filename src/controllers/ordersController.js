const Joi = require("joi");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

const querySchema = Joi.object({
  status: Joi.string().valid("paid", "fulfilled", "pending", "refunded").optional(),
  q: Joi.string().min(1).max(200).optional(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

async function listOrders(req, res, next) {
  const { value, error } = querySchema.validate(req.query, {
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

  const sql = `
SELECT
  o.id::text AS id,
  o.customer_name AS customer,
  LOWER(o.channel) AS channel,
  s.name AS store,
  o.status AS status,
  o.placed_at AS placed_at,
  o.total_amount::double precision AS total,
  o.items_count::int AS items_count
FROM orders o
JOIN stores s ON s.id = o.store_id
WHERE (:status::text IS NULL OR o.status = :status)
  AND (
    :q::text IS NULL OR
    o.id::text ILIKE :q OR
    o.customer_name ILIKE :q OR
    o.channel ILIKE :q OR
    s.name ILIKE :q
  )
ORDER BY o.placed_at DESC
LIMIT :limit OFFSET :offset;
  `.trim();

  const qLike = value.q ? `%${value.q}%` : null;

  try {
    const rows = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: {
        status: value.status || null,
        q: qLike,
        limit: value.limit,
        offset: value.offset,
      },
    });

    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listOrders };
