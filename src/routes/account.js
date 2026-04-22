const express = require("express");
const { getAccount } = require("../controllers/accountController");

function createAccountRouter() {
  const router = express.Router();

  router.get("/api/account", getAccount);

  return router;
}

module.exports = { createAccountRouter };
