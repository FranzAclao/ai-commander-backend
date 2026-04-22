const Joi = require("joi");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

const querySchema = Joi.object({
  q: Joi.string().min(1).max(200).optional(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

async function listActivity(req, res, next) {
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
  id::text AS id,
  at AS at,
  action,
  detail
FROM activity_events
WHERE (
  :q::text IS NULL OR
  action ILIKE :q OR
  detail ILIKE :q
)
ORDER BY at DESC
LIMIT :limit OFFSET :offset;
  `.trim();

  const qLike = value.q ? `%${value.q}%` : null;

  try {
    const rows = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: { q: qLike, limit: value.limit, offset: value.offset },
    });
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listActivity };

