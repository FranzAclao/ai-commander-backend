const express = require("express");
const Joi = require("joi");
const { Incident } = require("../models");

const agentQuerySchema = Joi.object({
  incidentId: Joi.string().guid({ version: "uuidv4" }).optional(),
  query: Joi.string().min(1).required(),
});

function pickIncidentSummary(incident) {
  if (!incident) return null;
  return {
    id: incident.id,
    title: incident.title,
    status: incident.status,
    severity: incident.severity,
  };
}

function buildDeploymentInfo(incidentSummary) {
  const deployedAt = new Date(Date.now() - 9 * 60 * 1000).toISOString(); // ~9m ago

  return {
    service: "auth-service",
    environment: "production",
    status: "completed",
    deployedAt,
    version: "2026.04.13-rc.3",
    previousVersion: "2026.04.12-rc.9",
    changeSummary: "Updated auth middleware + token validation path.",
    suspectedImpact: incidentSummary
      ? `May be related to incident: "${incidentSummary.title}".`
      : "May be related to current authentication failures.",
  };
}

function buildLogsInfo() {
  const now = Date.now();
  const ts = (msAgo) => new Date(now - msAgo).toISOString();

  return {
    service: "auth-service",
    environment: "production",
    lines: [
      `${ts(8 * 60 * 1000)} ERROR jwt.verify failed: invalid signature`,
      `${ts(8 * 60 * 1000 - 800)} WARN  request_id=7c2d /login 500 duration=42ms`,
      `${ts(7 * 60 * 1000)} WARN  upstream=users-api status=401 duration=18ms`,
      `${ts(6 * 60 * 1000)} ERROR token issuer mismatch expected=bridgecommander`,
      `${ts(5 * 60 * 1000)} WARN  request_id=3a91 /refresh 401 duration=9ms`,
      `${ts(3 * 60 * 1000)} INFO  rollback_candidate=2026.04.12-rc.9`,
    ],
  };
}

function createAgentRouter() {
  const router = express.Router();

  router.post("/api/agent/query", async (req, res, next) => {
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

    try {
      const query = value.query.trim();
      const normalized = query.toLowerCase();

      let incident = null;
      if (value.incidentId) {
        incident = await Incident.findByPk(value.incidentId);
        if (!incident) {
          return res.status(404).json({ error: "incident_not_found" });
        }
      }

      const incidentSummary = pickIncidentSummary(incident);

      const wantsDeploy =
        normalized.includes("deploy") ||
        normalized.includes("deployment") ||
        normalized.includes("release");
      const wantsLogs = normalized.includes("log");

      let result = { type: "unknown" };
      let answer =
        'Try asking about "deploy" for deployment info or "logs" for recent logs.';

      if (wantsDeploy && wantsLogs) {
        const deployment = buildDeploymentInfo(incidentSummary);
        const logs = buildLogsInfo();

        result = { type: "deploy+logs", deployment, logs };
        answer =
          "I pulled the latest deployment details and a small slice of recent logs for auth-service.";
      } else if (wantsDeploy) {
        const deployment = buildDeploymentInfo(incidentSummary);
        result = { type: "deploy", deployment };
        answer = "Here’s the latest deployment info for auth-service.";
      } else if (wantsLogs) {
        const logs = buildLogsInfo();
        result = { type: "logs", logs };
        answer = "Here are recent auth-service log lines around the failure window.";
      }

      return res.json({
        incident: incidentSummary,
        query,
        answer,
        result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAgentRouter };
