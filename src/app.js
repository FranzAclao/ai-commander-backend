const express = require("express");
const Joi = require("joi");
const { Incident } = require("./models");

function createApp() {
  const app = express();

  app.use(express.json());

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/incidents", async (req, res, next) => {
    try {
      const incidents = await Incident.findAll({
        order: [["createdAt", "DESC"]],
      });
      res.json({ incidents });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/incidents/:id", async (req, res, next) => {
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

  const agentQuerySchema = Joi.object({
    incidentId: Joi.string().guid({ version: "uuidv4" }).optional(),
    query: Joi.string().min(1).required(),
  });

  app.post("/api/agent/query", (req, res) => {
    const { value, error } = agentQuerySchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: "invalid_request",
        details: error.details.map((d) => d.message),
      });
    }

    return res.json({
      message: "Agent query received (stubbed in Batch 1).",
      received: value,
    });
  });

  app.use((req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}

module.exports = { createApp };
