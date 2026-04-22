const express = require("express");
const { postAgentJoin } = require("../controllers/agentJoinController");

function createAgentJoinRouter() {
  const router = express.Router();

  router.post("/api/agent/join", postAgentJoin);

  return router;
}

module.exports = { createAgentJoinRouter };

