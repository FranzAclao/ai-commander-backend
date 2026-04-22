const Joi = require("joi");
const { AgentDispatchClient } = require("livekit-server-sdk");

const bodySchema = Joi.object({
  roomName: Joi.string().min(1).max(200).required(),
});

function getAgentName() {
  const name =
    process.env.INSIGHTCOPILOT_AGENT_NAME || process.env.LIVEKIT_AGENT_NAME;
  return typeof name === "string" ? name.trim() : "";
}

async function postAgentJoin(req, res, next) {
  const { value, error } = bodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      error: "invalid_request",
      details: error.details.map((d) => d.message),
    });
  }

  const roomName = value.roomName.trim();

  try {
    const livekitUrl = process.env.LIVEKIT_URL;
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const agentName = getAgentName();

    if (!livekitUrl || !apiKey || !apiSecret) {
      console.error(
        "[livekit] Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET env vars"
      );
      return res.status(500).json({
        error: "livekit_not_configured",
        message:
          "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set",
      });
    }

    if (!agentName) {
      console.error(
        "[livekit] Missing INSIGHTCOPILOT_AGENT_NAME or LIVEKIT_AGENT_NAME env var"
      );
      return res.status(500).json({
        error: "agent_not_configured",
        message: "Set INSIGHTCOPILOT_AGENT_NAME (or LIVEKIT_AGENT_NAME)",
      });
    }

    const client = new AgentDispatchClient(livekitUrl, apiKey, apiSecret);
    await client.createDispatch(roomName, agentName);

    return res.json({ ok: true, roomName });
  } catch (err) {
    console.error("[livekit] dispatch failed:", err);
    return res.status(500).json({
      error: "agent_dispatch_failed",
      message: err && err.message ? String(err.message) : "Dispatch failed",
    });
  }
}

module.exports = { postAgentJoin };

