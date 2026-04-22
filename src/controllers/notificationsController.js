const Joi = require("joi");
const { User, Notification } = require("../models");

const querySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(6),
});

async function listNotifications(req, res, next) {
  const { value, error } = querySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    return res.status(400).json({
      error: "invalid_query_params",
      details: error.details.map((d) => d.message),
    });
  }

  try {
    const user = await User.findOne({ order: [["createdAt", "ASC"]] });
    if (!user) return res.json([]);

    const notifications = await Notification.findAll({
      where: { userId: user.id },
      order: [["createdAt", "DESC"]],
      limit: value.limit,
    });

    return res.json(
      notifications.map((n) => ({
        id: n.id,
        title: n.title,
        createdAt: n.createdAt,
        unread: n.unread,
      }))
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { listNotifications };

