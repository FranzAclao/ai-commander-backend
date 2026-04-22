const express = require("express");
const config = require("./config");
const { createHealthRouter } = require("./routes/health");
const { createMeRouter } = require("./routes/me");
const { createNotificationsRouter } = require("./routes/notifications");
const { createQueryRouter } = require("./routes/query");
const { createResultRouter } = require("./routes/result");
const { createOrdersRouter } = require("./routes/orders");
const { createAlertsRouter } = require("./routes/alerts");
const { createSavedQueriesRouter } = require("./routes/savedQueries");
const { createAccountRouter } = require("./routes/account");
const { createLivekitRouter } = require("./routes/livekit");
const { createAgentJoinRouter } = require("./routes/agentJoin");
const { createActivityRouter } = require("./routes/activity");

function createApp() {
  const app = express();
  app.set("etag", false);

  const allowedOrigins = String(config.corsOrigin || "*")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (!requestOrigin) {
      return next();
    }

    const allowAll = allowedOrigins.includes("*");
    const isAllowed = allowAll || allowedOrigins.includes(requestOrigin);

    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", allowAll ? "*" : requestOrigin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Conversation-Id"
    );
    res.setHeader("Access-Control-Expose-Headers", "X-Conversation-Id");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  });

  app.use((req, res, next) => {
    console.log(`[req] ${req.method} ${req.path}`);
    next();
  });

  app.use((req, res, next) => {
    if (req.path === "/health" || (req.path && req.path.startsWith("/api"))) {
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.use(express.json());

  app.use(createHealthRouter());
  app.use(createMeRouter());
  app.use(createNotificationsRouter());
  app.use(createQueryRouter());
  app.use(createResultRouter());
  app.use(createOrdersRouter());
  app.use(createAlertsRouter());
  app.use(createSavedQueriesRouter());
  app.use(createAccountRouter());
  app.use(createActivityRouter());
  app.use(createLivekitRouter());
  app.use(createAgentJoinRouter());

  app.use((req, res) => {
    if (req.path && req.path.startsWith("/api")) {
      return res
        .status(404)
        .json({ error: "Unknown API endpoint", path: req.originalUrl });
    }
    return res.status(404).json({ error: "not_found" });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}

module.exports = { createApp };
