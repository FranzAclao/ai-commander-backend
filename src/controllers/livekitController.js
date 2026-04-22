const { AccessToken } = require("livekit-server-sdk");

async function getLivekitToken(req, res, next) {
  try {
    const roomName =
      typeof req.query.roomName === "string" ? req.query.roomName.trim() : "";
    const identity =
      typeof req.query.identity === "string" ? req.query.identity.trim() : "";

    if (!roomName || !identity) {
      return res.status(400).json({
        error: "missing_required_query_params",
        message: "roomName and identity are required",
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error(
        "[livekit] Missing LIVEKIT_API_KEY or LIVEKIT_API_SECRET env vars"
      );
      return res.status(500).json({
        error: "livekit_not_configured",
        message: "LIVEKIT_API_KEY and LIVEKIT_API_SECRET must be set",
      });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity });
    at.addGrant({ roomJoin: true, room: roomName });

    const token = await at.toJwt();
    return res.json({ token });
  } catch (error) {
    next(error);
  }
}

module.exports = { getLivekitToken };

