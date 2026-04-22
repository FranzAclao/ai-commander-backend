const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

async function listSavedQueries(req, res, next) {
  const sql = `
SELECT
  id::text AS id,
  name,
  sql,
  created_at AS created_at,
  status
FROM saved_queries
ORDER BY created_at DESC;
  `.trim();

  try {
    const rows = await sequelize.query(sql, { type: QueryTypes.SELECT });
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listSavedQueries };
