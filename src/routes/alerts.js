const express = require("express");
const { listAlerts } = require("../controllers/alertsController");

function createAlertsRouter() {
  const router = express.Router();

  router.get("/api/alerts", listAlerts);

  return router;
}

module.exports = { createAlertsRouter };
