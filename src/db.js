const { Sequelize } = require("sequelize");
const config = require("./config");

const logging = config.logSql ? console.log : false;

if (!config.databaseUrl) {
  throw new Error(
    "DATABASE_URL is required (PostgreSQL). Set it in your environment or .env file."
  );
}

const sequelize = new Sequelize(config.databaseUrl, {
  dialect: "postgres",
  logging,
});

module.exports = sequelize;
