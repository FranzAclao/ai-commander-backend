const express = require("express");
const { listNotifications } = require("../controllers/notificationsController");

function createNotificationsRouter() {
  const router = express.Router();

  router.get("/api/notifications", listNotifications);

  return router;
}

module.exports = { createNotificationsRouter };
