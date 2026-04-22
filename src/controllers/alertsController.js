const Joi = require("joi");
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

const querySchema = Joi.object({
  severity: Joi.string().valid("low", "medium", "high", "critical").optional(),
  q: Joi.string().min(1).max(200).optional(),
  limit: Joi.number().integer().min(1).max(200).default(50),
  offset: Joi.number().integer().min(0).default(0),
});

async function listAlerts(req, res, next) {
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
  a.id::text AS id,
  a.severity AS severity,
  a.source AS title,
  a.message AS detail,
  a.created_at AS created_at
FROM alerts a
WHERE (:severity::text IS NULL OR a.severity = :severity)
  AND (
    :q::text IS NULL OR
    a.source ILIKE :q OR
    a.message ILIKE :q
  )
ORDER BY a.created_at DESC
LIMIT :limit OFFSET :offset;
  `.trim();

  const qLike = value.q ? `%${value.q}%` : null;

  try {
    const rows = await sequelize.query(sql, {
      type: QueryTypes.SELECT,
      replacements: {
        severity: value.severity || null,
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

module.exports = { listAlerts };
