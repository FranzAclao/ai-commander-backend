const express = require("express");
const { handleQuery } = require("../controllers/queryController");

function createQueryRouter() {
  const router = express.Router();

  router.post("/api/query", handleQuery);

  return router;
}

module.exports = { createQueryRouter };

