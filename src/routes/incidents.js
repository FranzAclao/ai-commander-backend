const express = require("express");
const { Incident } = require("../models");

function createIncidentRouter() {
  const router = express.Router();

  router.get("/api/incidents", async (req, res, next) => {
    try {
      const incidents = await Incident.findAll({
        order: [["createdAt", "DESC"]],
      });
      res.json({ incidents });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/incidents/:id", async (req, res, next) => {
    try {
      const incident = await Incident.findByPk(req.params.id);
      if (!incident) {
        return res.status(404).json({ error: "incident_not_found" });
      }
      return res.json({ incident });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createIncidentRouter };

