const express = require("express");
const { listSavedQueries } = require("../controllers/savedQueriesController");

function createSavedQueriesRouter() {
  const router = express.Router();

  router.get("/api/saved-queries", listSavedQueries);

  return router;
}

module.exports = { createSavedQueriesRouter };
