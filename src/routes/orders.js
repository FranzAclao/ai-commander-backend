const express = require("express");
const { listOrders } = require("../controllers/ordersController");

function createOrdersRouter() {
  const router = express.Router();

  router.get("/api/orders", listOrders);

  return router;
}

module.exports = { createOrdersRouter };
