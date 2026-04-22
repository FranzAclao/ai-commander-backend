const express = require("express");
const { listActivity } = require("../controllers/activityController");

function createActivityRouter() {
  const router = express.Router();
  router.get("/api/activity", listActivity);
  return router;
}

module.exports = { createActivityRouter };

