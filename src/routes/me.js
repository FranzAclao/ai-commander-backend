const express = require("express");
const { getMe } = require("../controllers/meController");

function createMeRouter() {
  const router = express.Router();

  router.get("/api/me", getMe);

  return router;
}

module.exports = { createMeRouter };
