const { User } = require("../models");

async function getMe(req, res, next) {
  try {
    const user = await User.findOne({ order: [["createdAt", "ASC"]] });
    if (!user) {
      return res.status(404).json({ error: "user_not_found" });
    }

    return res.json({
      name: user.name,
      email: user.email,
      role: user.role,
      workspace: user.workspace,
      lastLoginAt: user.lastLoginAt,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getMe };
