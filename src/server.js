require("dotenv").config();

const config = require("./config");

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

    if (config.dbSync) {
      await sequelize.sync();
    }

    const app = createApp();
    app.listen(config.port, () => {
      console.log(
        `BridgeCommander backend listening on port ${config.port} (${config.env})`
      );
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
