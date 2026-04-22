const express = require("express");
const {
  getKpis,
  getTrend,
  getRanking,
} = require("../controllers/resultController");

function createResultRouter() {
  const router = express.Router();

  router.get("/api/result/kpis", getKpis);
  router.get("/api/result/trend", getTrend);
  router.get("/api/result/ranking", getRanking);

  return router;
}

module.exports = { createResultRouter };
