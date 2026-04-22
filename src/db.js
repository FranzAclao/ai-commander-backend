const pg = require("pg");
const { Sequelize } = require("sequelize");
const config = require("./config");

const logging = config.logSql ? console.log : false;

if (!config.databaseUrl) {
  throw new Error(
    "DATABASE_URL is required (PostgreSQL). Set it in your environment or .env file."
  );
}

// Ensure analytics values come back as numbers (not strings) for common PG types.
// - 1700: numeric/decimal
// - 20: int8/bigint (e.g., COUNT(*))
pg.types.setTypeParser(1700, (val) => (val === null ? null : parseFloat(val)));
pg.types.setTypeParser(20, (val) => (val === null ? null : Number(val)));

const sequelize = new Sequelize(config.databaseUrl, {
  dialect: "postgres",
  logging,
});

module.exports = sequelize;
