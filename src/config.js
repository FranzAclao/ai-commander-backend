function readBool(value, defaultValue) {
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1";
}

const env = process.env.NODE_ENV || "development";
const port = Number(process.env.PORT || 3000);

const databaseUrl = process.env.DATABASE_URL || "";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

const dbSync = readBool(process.env.DB_SYNC, env !== "production");
const logSql = readBool(process.env.LOG_SQL, false);

module.exports = {
  env,
  port,
  databaseUrl,
  corsOrigin,
  dbSync,
  logSql,
};
