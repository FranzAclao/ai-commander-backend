require("dotenv").config();

const config = require("./config");

function safeDbLabel(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    const dbName = (url.pathname || "").replace(/^\//, "") || "(unknown)";
    const port = url.port || "5432";
    return `${url.hostname}:${port}/${dbName}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function start() {
  try {
    if (!config.databaseUrl) {
      throw new Error(
        "DATABASE_URL is required (PostgreSQL). Set it in your environment or .env file."
      );
    }

    const { sequelize } = require("./models");
    const { createApp } = require("./app");

    await sequelize.authenticate();
    console.log(`[db] connected ${safeDbLabel(config.databaseUrl)}`);

    if (config.dbSync) {
      const syncOptions = config.env === "production" ? {} : { alter: true };
      await sequelize.sync(syncOptions);
      console.log(
        `[db] synced models${config.env === "production" ? "" : " (alter)"}`
      );
    }

    const app = createApp();
    app.listen(config.port, () => {
      console.log(
        `InsightCopilot backend listening on port ${config.port} (${config.env})`
      );

      // Dev-only: warm up the local Ollama model so the first chat doesn't feel "stuck".
      const prewarmDisabled =
        String(process.env.LLM_PREWARM || "").trim().toLowerCase() === "false" ||
        String(process.env.LLM_PREWARM || "").trim() === "0";
      if (config.env !== "production" && !prewarmDisabled) {
        try {
          const { prewarmLlm } = require("./services/llm");
          prewarmLlm()
            .then((result) => {
              if (result && result.ok) console.log("[llm] prewarm ok");
              else console.log("[llm] prewarm skipped/failed");
            })
            .catch(() => console.log("[llm] prewarm skipped/failed"));
        } catch {
          // ignore prewarm errors
        }
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
