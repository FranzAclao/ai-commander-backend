const express = require("express");
const { getLivekitToken } = require("../controllers/livekitController");

function createLivekitRouter() {
  const router = express.Router();

  router.get("/api/livekit/token", getLivekitToken);

  return router;
}

module.exports = { createLivekitRouter };
